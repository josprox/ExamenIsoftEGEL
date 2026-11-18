package handlers

import (
	"html"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

type ReaderHandler struct {
	Client *http.Client
}

func NewReaderHandler() *ReaderHandler {
	return &ReaderHandler{
		Client: &http.Client{
			Timeout: 7 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        40,
				MaxIdleConnsPerHost: 4,
				IdleConnTimeout:     60 * time.Second,
			},
		},
	}
}

var (
	reNoiseTags = []*regexp.Regexp{
		regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`),
		regexp.MustCompile(`(?is)<style[^>]*>.*?</style>`),
		regexp.MustCompile(`(?is)<noscript[^>]*>.*?</noscript>`),
		regexp.MustCompile(`(?is)<svg[^>]*>.*?</svg>`),
		regexp.MustCompile(`(?is)<nav[^>]*>.*?</nav>`),
		regexp.MustCompile(`(?is)<footer[^>]*>.*?</footer>`),
	}
	reTitleTag   = regexp.MustCompile(`(?is)<title[^>]*>(.*?)</title>`)
	reMetaDesc   = regexp.MustCompile(`(?is)<meta[^>]+(?:name=["']description["']|property=["']og:description["'])[^>]+content=["']([^"']+)["']`)
	reMetaTitle  = regexp.MustCompile(`(?is)<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']`)
	reBlocks     = regexp.MustCompile(`(?is)<(h1|h2|h3|p|li|blockquote|pre)[^>]*>(.*?)</(?:h1|h2|h3|p|li|blockquote|pre)>`)
	reStripTags  = regexp.MustCompile(`(?s)<[^>]+>`)
	reMultiSpace = regexp.MustCompile(`\s+`)
)

func isSafePublicURL(raw string) (*url.URL, bool) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return nil, false
	}
	host := u.Hostname()
	if host == "" || strings.EqualFold(host, "localhost") || strings.HasSuffix(strings.ToLower(host), ".local") {
		return nil, false
	}
	if ip := net.ParseIP(host); ip != nil {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsMulticast() || ip.IsUnspecified() {
			return nil, false
		}
	}
	return u, true
}

func cleanHTMLText(s string) string {
	s = reStripTags.ReplaceAllString(s, " ")
	s = html.UnescapeString(s)
	s = reMultiSpace.ReplaceAllString(s, " ")
	return strings.TrimSpace(s)
}

func (h *ReaderHandler) Leer(w http.ResponseWriter, r *http.Request) {
	rawURL := r.URL.Query().Get("url")
	u, ok := isSafePublicURL(rawURL)
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"message": "URL inválida o no permitida.",
		})
		return
	}

	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, u.String(), nil)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"message": "No se pudo construir la petición."})
		return
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; EGELPlusReader/2.0; +https://egelsoftback.astriom.org)")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "es-MX,es;q=0.9,en;q=0.8")

	resp, err := h.Client.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]any{
			"message": "El sitio externo no respondió a tiempo.",
			"url":     u.String(),
		})
		return
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 1500*1024))
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]any{
			"message": "No se pudo leer el contenido externo.",
			"url":     u.String(),
		})
		return
	}

	rawHTML := string(bodyBytes)
	title := ""
	if m := reMetaTitle.FindStringSubmatch(rawHTML); len(m) > 1 {
		title = cleanHTMLText(m[1])
	}
	if title == "" {
		if m := reTitleTag.FindStringSubmatch(rawHTML); len(m) > 1 {
			title = cleanHTMLText(m[1])
		}
	}

	description := ""
	if m := reMetaDesc.FindStringSubmatch(rawHTML); len(m) > 1 {
		description = cleanHTMLText(m[1])
	}

	cleaned := rawHTML
	for _, re := range reNoiseTags {
		cleaned = re.ReplaceAllString(cleaned, " ")
	}
	matches := reBlocks.FindAllStringSubmatch(cleaned, 120)

	type readerBlock struct {
		Tag  string `json:"tag"`
		Text string `json:"text"`
	}
	blocks := make([]readerBlock, 0, len(matches))
	seen := make(map[string]bool)

	for _, m := range matches {
		tag := strings.ToLower(m[1])
		txt := cleanHTMLText(m[2])
		if len([]rune(txt)) < 20 && tag != "h1" && tag != "h2" && tag != "h3" {
			continue
		}
		if len([]rune(txt)) < 4 || seen[txt] {
			continue
		}
		seen[txt] = true
		blocks = append(blocks, readerBlock{Tag: tag, Text: txt})
		if len(blocks) >= 55 {
			break
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"url":         u.String(),
		"host":        u.Hostname(),
		"status":      resp.StatusCode,
		"title":       title,
		"description": description,
		"blocks":      blocks,
	})
}
