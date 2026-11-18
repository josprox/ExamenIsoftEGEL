package handlers

import (
	"bufio"
	"context"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/josprox/examen-isoft-egel/backend/internal/models"
	"gorm.io/gorm"
)

const wsGUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

type wsClient struct {
	userID uint64
	conn   net.Conn
	mu     sync.Mutex
	closed bool
}

func (c *wsClient) writeFrame(opcode byte, payload []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return io.ErrClosedPipe
	}
	_ = c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))

	n := len(payload)
	var header []byte
	if n < 126 {
		header = []byte{0x80 | opcode, byte(n)}
	} else if n < 65536 {
		header = make([]byte, 4)
		header[0] = 0x80 | opcode
		header[1] = 126
		binary.BigEndian.PutUint16(header[2:], uint16(n))
	} else {
		header = make([]byte, 10)
		header[0] = 0x80 | opcode
		header[1] = 127
		binary.BigEndian.PutUint64(header[2:], uint64(n))
	}

	if _, err := c.conn.Write(header); err != nil {
		return err
	}
	if n > 0 {
		if _, err := c.conn.Write(payload); err != nil {
			return err
		}
	}
	return nil
}

func (c *wsClient) close() {
	c.mu.Lock()
	if !c.closed {
		c.closed = true
		_ = c.conn.Close()
	}
	c.mu.Unlock()
}

type WSHub struct {
	mu      sync.RWMutex
	clients map[uint64]map[*wsClient]struct{}
}

func NewWSHub() *WSHub {
	return &WSHub{
		clients: make(map[uint64]map[*wsClient]struct{}),
	}
}

func (h *WSHub) add(c *wsClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	set := h.clients[c.userID]
	if set == nil {
		set = make(map[*wsClient]struct{})
		h.clients[c.userID] = set
	}
	set[c] = struct{}{}
}

func (h *WSHub) remove(c *wsClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if set := h.clients[c.userID]; set != nil {
		delete(set, c)
		if len(set) == 0 {
			delete(h.clients, c.userID)
		}
	}
	c.close()
}

func (h *WSHub) BroadcastUser(userID uint64, payload any) {
	if h == nil || userID == 0 {
		return
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return
	}

	h.mu.RLock()
	set := h.clients[userID]
	targets := make([]*wsClient, 0, len(set))
	for c := range set {
		targets = append(targets, c)
	}
	h.mu.RUnlock()

	for _, c := range targets {
		if err := c.writeFrame(0x1, raw); err != nil {
			h.remove(c)
		}
	}
}

func (h *WSHub) ServeWS(db *gorm.DB, webHandler *WebSearchHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		plain := strings.TrimSpace(r.URL.Query().Get("token"))
		if plain == "" {
			authHeader := r.Header.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				plain = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}
		if plain == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]any{"message": "No autenticado."})
			return
		}

		sum := sha256.Sum256([]byte(plain))
		hashed := hex.EncodeToString(sum[:])

		var tokenRec models.UserToken
		if err := db.Preload("User").
			Where("token = ? AND (expires_at IS NULL OR expires_at > ?)", hashed, time.Now()).
			First(&tokenRec).Error; err != nil || tokenRec.User.ID == 0 {
			writeJSON(w, http.StatusUnauthorized, map[string]any{"message": "Token inválido."})
			return
		}

		key := r.Header.Get("Sec-WebSocket-Key")
		if key == "" || !strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
			writeJSON(w, http.StatusBadRequest, map[string]any{"message": "Se requiere WebSocket."})
			return
		}

		hijacker, ok := w.(http.Hijacker)
		if !ok {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"message": "Hijack no soportado."})
			return
		}
		conn, bufrw, err := hijacker.Hijack()
		if err != nil {
			return
		}

		acceptSum := sha1.Sum([]byte(key + wsGUID))
		accept := base64.StdEncoding.EncodeToString(acceptSum[:])
		resp := "HTTP/1.1 101 Switching Protocols\r\n" +
			"Upgrade: websocket\r\n" +
			"Connection: Upgrade\r\n" +
			"Sec-WebSocket-Accept: " + accept + "\r\n\r\n"
		if _, err := bufrw.WriteString(resp); err != nil {
			_ = conn.Close()
			return
		}
		if err := bufrw.Flush(); err != nil {
			_ = conn.Close()
			return
		}

		client := &wsClient{userID: tokenRec.User.ID, conn: conn}
		h.add(client)
		defer h.remove(client)

		_ = client.writeFrame(0x1, []byte(`{"type":"connected"}`))

		done := make(chan struct{})
		go func() {
			ticker := time.NewTicker(25 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-done:
					return
				case <-ticker.C:
					if err := client.writeFrame(0x9, []byte("ping")); err != nil {
						client.close()
						return
					}
				}
			}
		}()

		readWSLoop(bufrw.Reader, client, webHandler)
		close(done)
	}
}

func readWSLoop(br *bufio.Reader, client *wsClient, webHandler *WebSearchHandler) {
	hdr := make([]byte, 2)
	var searchCancel context.CancelFunc
	defer func() {
		if searchCancel != nil {
			searchCancel()
		}
	}()

	for {
		if _, err := io.ReadFull(br, hdr); err != nil {
			return
		}
		opcode := hdr[0] & 0x0F
		masked := (hdr[1] & 0x80) != 0
		payloadLen := uint64(hdr[1] & 0x7F)

		if payloadLen == 126 {
			ext := make([]byte, 2)
			if _, err := io.ReadFull(br, ext); err != nil {
				return
			}
			payloadLen = uint64(binary.BigEndian.Uint16(ext))
		} else if payloadLen == 127 {
			ext := make([]byte, 8)
			if _, err := io.ReadFull(br, ext); err != nil {
				return
			}
			payloadLen = binary.BigEndian.Uint64(ext)
		}

		if payloadLen > 1<<20 {
			return
		}

		var mask [4]byte
		if masked {
			if _, err := io.ReadFull(br, mask[:]); err != nil {
				return
			}
		}

		payload := make([]byte, payloadLen)
		if payloadLen > 0 {
			if _, err := io.ReadFull(br, payload); err != nil {
				return
			}
		}

		if masked {
			for i := range payload {
				payload[i] ^= mask[i%4]
			}
		}

		if opcode == 0x8 {
			_ = client.writeFrame(0x8, nil)
			return
		}
		if opcode == 0x9 {
			_ = client.writeFrame(0xA, payload)
			continue
		}
		if opcode == 0x1 && webHandler != nil {
			var req struct {
				Type      string `json:"type"`
				Q         string `json:"q"`
				Fuente    string `json:"fuente"`
				RequestID string `json:"request_id"`
			}
			if err := json.Unmarshal(payload, &req); err == nil && req.Type == "buscar_web" {
				if searchCancel != nil {
					searchCancel()
				}
				ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
				searchCancel = cancel
				go func(c context.Context, q, fuente, reqID string) {
					defer cancel()
					webHandler.StreamBuscarWeb(c, q, fuente, func(source string, items []ConceptoWeb) {
						raw, err := json.Marshal(map[string]any{
							"type":       "web_search_chunk",
							"request_id": reqID,
							"source":     source,
							"conceptos":  items,
						})
						if err == nil {
							_ = client.writeFrame(0x1, raw)
						}
					})
					if c.Err() == nil {
						rawDone, err := json.Marshal(map[string]any{
							"type":       "web_search_done",
							"request_id": reqID,
						})
						if err == nil {
							_ = client.writeFrame(0x1, rawDone)
						}
					}
				}(ctx, req.Q, req.Fuente, req.RequestID)
			}
		}
	}
}
