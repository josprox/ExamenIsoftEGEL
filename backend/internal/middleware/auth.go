package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/josprox/examen-isoft-egel/backend/internal/models"
	"golang.org/x/time/rate"
	"gorm.io/gorm"
)

type ctxKey string

const (
	UserContextKey    ctxKey = "egel_user"
	TokenIDContextKey ctxKey = "egel_token_id"
)

func UserFromContext(ctx context.Context) (models.User, bool) {
	u, ok := ctx.Value(UserContextKey).(models.User)
	return u, ok
}

func TokenIDFromContext(ctx context.Context) (uint64, bool) {
	id, ok := ctx.Value(TokenIDContextKey).(uint64)
	return id, ok
}

func AuthenticateToken(db *gorm.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if !strings.HasPrefix(authHeader, "Bearer ") {
				writeJSONError(w, http.StatusUnauthorized, "No autenticado.")
				return
			}
			plain := strings.TrimPrefix(authHeader, "Bearer ")
			sum := sha256.Sum256([]byte(plain))
			hashed := hex.EncodeToString(sum[:])

			var tokenRec models.UserToken
			err := db.Preload("User").
				Where("token = ? AND (expires_at IS NULL OR expires_at > ?)", hashed, time.Now()).
				First(&tokenRec).Error
			if err != nil || tokenRec.User.ID == 0 {
				writeJSONError(w, http.StatusUnauthorized, "Token inválido o expirado.")
				return
			}

			ctx := context.WithValue(r.Context(), UserContextKey, tokenRec.User)
			ctx = context.WithValue(ctx, TokenIDContextKey, tokenRec.ID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func RateLimit(perMinute int, burst int) func(http.Handler) http.Handler {
	var mu sync.Mutex
	visitors := make(map[string]*visitor)

	rps := rate.Limit(float64(perMinute) / 60.0)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r)
			mu.Lock()
			v, exists := visitors[ip]
			if !exists {
				v = &visitor{limiter: rate.NewLimiter(rps, burst), lastSeen: time.Now()}
				visitors[ip] = v
			}
			v.lastSeen = time.Now()
			allowed := v.limiter.Allow()
			// Limpieza ligera si crece mucho
			if len(visitors) > 2000 {
				cutoff := time.Now().Add(-10 * time.Minute)
				for k, vis := range visitors {
					if vis.lastSeen.Before(cutoff) {
						delete(visitors, k)
					}
				}
			}
			mu.Unlock()

			if !allowed {
				writeJSONError(w, http.StatusTooManyRequests, "Demasiadas solicitudes. Intenta en un momento.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func writeJSONError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": msg})
}
