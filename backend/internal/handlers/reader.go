package handlers

import (
	"context"
	"encoding/json"
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
	reGitHubRepo = regexp.MustCompile(`^/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)(?:/.*)?$`)
)

func extractGitHubRepo(u *url.URL) (string, string, bool) {
	host := strings.ToLower(u.Hostname())
	if host != "github.com" && host != "www.github.com" {
		return "", "", false
	}
	m := reGitHubRepo.FindStringSubmatch(strings.TrimSuffix(u.Path, "/"))
	if len(m) < 3 {
		return "", "", false
	}
	owner, repo := m[1], strings.TrimSuffix(m[2], ".git")
	reserved := map[string]bool{
		"topics": true, "search": true, "explore": true, "marketplace": true,
		"orgs": true, "settings": true, "features": true, "sponsors": true,
	}
	if reserved[strings.ToLower(owner)] {
		return "", "", false
	}
	return owner, repo, true
}

func (h *ReaderHandler) fetchGitHubReadme(ctx context.Context, owner, repo string) (string, bool) {
	apiURL := "https://api.github.com/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(repo) + "/readme"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err == nil {
		req.Header.Set("User-Agent", "ExamenIsoftEGEL/1.0")
		req.Header.Set("Accept", "application/vnd.github.raw+json")
		if resp, err := h.Client.Do(req); err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				if body, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024)); err == nil {
					txt := strings.TrimSpace(string(body))
					if txt != "" {
						return txt, true
					}
				}
			}
		}
	}

	for _, branch := range []string{"HEAD", "main", "master"} {
		for _, fname := range []string{"README.md", "readme.md", "README.MD"} {
			rawURL := "https://raw.githubusercontent.com/" + url.PathEscape(owner) + "/" + url.PathEscape(repo) + "/" + branch + "/" + fname
			req2, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
			if err != nil {
				continue
			}
			req2.Header.Set("User-Agent", "ExamenIsoftEGEL/1.0")
			resp2, err := h.Client.Do(req2)
			if err != nil {
				continue
			}
			body, readErr := io.ReadAll(io.LimitReader(resp2.Body, 1024*1024))
			resp2.Body.Close()
			if resp2.StatusCode == http.StatusOK && readErr == nil {
				txt := strings.TrimSpace(string(body))
				if txt != "" {
					return txt, true
				}
			}
		}
	}
	return "", false
}

type readerBlock struct {
	Tag  string `json:"tag"`
	Text string `json:"text"`
}

func (h *ReaderHandler) fetchWikipediaArticle(ctx context.Context, u *url.URL) (string, string, []readerBlock, bool) {
	host := strings.ToLower(u.Hostname())
	if !strings.HasSuffix(host, ".wikipedia.org") {
		return "", "", nil, false
	}
	if !strings.HasPrefix(u.Path, "/wiki/") {
		return "", "", nil, false
	}
	rawTitle := strings.TrimPrefix(u.Path, "/wiki/")
	if rawTitle == "" || strings.Contains(rawTitle, ":") {
		return "", "", nil, false
	}
	decodedTitle, err := url.PathUnescape(rawTitle)
	if err != nil {
		decodedTitle = rawTitle
	}

	apiURL := "https://" + host + "/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=" +
		url.QueryEscape(decodedTitle)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return "", "", nil, false
	}
	req.Header.Set("User-Agent", "ExamenIsoftEGEL/1.0")
	resp, err := h.Client.Do(req)
	if err != nil {
		return "", "", nil, false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", "", nil, false
	}

	var parsed struct {
		Query struct {
			Pages map[string]struct {
				Title   string `json:"title"`
				Extract string `json:"extract"`
			} `json:"pages"`
		} `json:"query"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1024*1024)).Decode(&parsed); err != nil {
		return "", "", nil, false
	}

	var pageTitle, extract string
	for _, p := range parsed.Query.Pages {
		if p.Extract != "" {
			pageTitle = p.Title
			extract = p.Extract
			break
		}
	}
	if extract == "" {
		return "", "", nil, false
	}

	lines := strings.Split(extract, "\n")
	blocks := make([]readerBlock, 0, 40)
	var firstPara string
	for _, rawLine := range lines {
		line := strings.TrimSpace(rawLine)
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "===") && strings.HasSuffix(line, "===") {
			heading := strings.TrimSpace(strings.Trim(line, "="))
			if heading != "" {
				blocks = append(blocks, readerBlock{Tag: "h3", Text: heading})
			}
			continue
		}
		if strings.HasPrefix(line, "==") && strings.HasSuffix(line, "==") {
			heading := strings.TrimSpace(strings.Trim(line, "="))
			if heading != "" {
				blocks = append(blocks, readerBlock{Tag: "h2", Text: heading})
			}
			continue
		}
		if firstPara == "" {
			firstPara = line
		} else {
			blocks = append(blocks, readerBlock{Tag: "p", Text: line})
		}
		if len(blocks) >= 50 {
			break
		}
	}

	return pageTitle, firstPara, blocks, true
}

func (h *ReaderHandler) fetchWikidataEntity(ctx context.Context, u *url.URL) (string, string, []readerBlock, bool) {
	host := strings.ToLower(u.Hostname())
	if host != "www.wikidata.org" && host != "wikidata.org" {
		return "", "", nil, false
	}

	var entityID string
	for _, prefix := range []string{"/wiki/", "/entity/"} {
		if strings.HasPrefix(u.Path, prefix) {
			candidate := strings.Trim(strings.TrimPrefix(u.Path, prefix), "/")
			if idx := strings.IndexByte(candidate, '/'); idx >= 0 {
				candidate = candidate[:idx]
			}
			upper := strings.ToUpper(candidate)
			if len(upper) >= 2 && (upper[0] == 'Q' || upper[0] == 'P' || upper[0] == 'L') {
				entityID = upper
			}
			break
		}
	}
	if entityID == "" {
		return "", "", nil, false
	}

	apiURL := "https://www.wikidata.org/wiki/Special:EntityData/" + url.PathEscape(entityID) + ".json"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return "", "", nil, false
	}
	req.Header.Set("User-Agent", "EGELPlusReader/2.0 (+https://egelsoftback.astriom.org)")
	req.Header.Set("Accept", "application/json")

	resp, err := h.Client.Do(req)
	if err != nil {
		return "", "", nil, false
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", nil, false
	}

	var payload struct {
		Entities map[string]struct {
			ID           string `json:"id"`
			Labels       map[string]struct {
				Value string `json:"value"`
			} `json:"labels"`
			Descriptions map[string]struct {
				Value string `json:"value"`
			} `json:"descriptions"`
			Aliases      map[string][]struct {
				Value string `json:"value"`
			} `json:"aliases"`
			Sitelinks map[string]struct {
				Title string `json:"title"`
			} `json:"sitelinks"`
		} `json:"entities"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 2*1024*1024)).Decode(&payload); err != nil {
		return "", "", nil, false
	}

	ent, ok := payload.Entities[entityID]
	if !ok {
		for _, first := range payload.Entities {
			ent = first
			ok = true
			break
		}
	}
	if !ok {
		return "", "", nil, false
	}

	pickLang := func(m map[string]struct {
		Value string `json:"value"`
	}) string {
		if v, exists := m["es"]; exists && v.Value != "" {
			return v.Value
		}
		if v, exists := m["en"]; exists && v.Value != "" {
			return v.Value
		}
		for _, v := range m {
			if v.Value != "" {
				return v.Value
			}
		}
		return ""
	}

	title := pickLang(ent.Labels)
	if title == "" {
		title = entityID
	} else {
		title = title + " (" + entityID + ")"
	}
	desc := pickLang(ent.Descriptions)

	blocks := make([]readerBlock, 0, 24)
	aliasList := ent.Aliases["es"]
	if len(aliasList) == 0 {
		aliasList = ent.Aliases["en"]
	}
	if len(aliasList) > 0 {
		blocks = append(blocks, readerBlock{Tag: "h2", Text: "También conocido como"})
		limit := len(aliasList)
		if limit > 8 {
			limit = 8
		}
		for _, a := range aliasList[:limit] {
			if strings.TrimSpace(a.Value) != "" {
				blocks = append(blocks, readerBlock{Tag: "li", Text: a.Value})
			}
		}
	}

	wikiHost := ""
	wikiLangLabel := ""
	wikiArticleTitle := ""
	if sl, exists := ent.Sitelinks["eswiki"]; exists && sl.Title != "" {
		wikiHost = "es.wikipedia.org"
		wikiLangLabel = "Wikipedia en español"
		wikiArticleTitle = sl.Title
	} else if sl, exists := ent.Sitelinks["enwiki"]; exists && sl.Title != "" {
		wikiHost = "en.wikipedia.org"
		wikiLangLabel = "Wikipedia en inglés"
		wikiArticleTitle = sl.Title
	}

	if wikiHost != "" && wikiArticleTitle != "" {
		wikiURL := &url.URL{
			Scheme: "https",
			Host:   wikiHost,
			Path:   "/wiki/" + strings.ReplaceAll(wikiArticleTitle, " ", "_"),
		}
		if _, wikiDesc, wikiBlocks, found := h.fetchWikipediaArticle(ctx, wikiURL); found {
			blocks = append(blocks, readerBlock{Tag: "h2", Text: wikiLangLabel + " · " + wikiArticleTitle})
			if wikiDesc != "" {
				blocks = append(blocks, readerBlock{Tag: "p", Text: wikiDesc})
			}
			maxWiki := len(wikiBlocks)
			if maxWiki > 20 {
				maxWiki = 20
			}
			blocks = append(blocks, wikiBlocks[:maxWiki]...)
		}
	}

	if len(blocks) == 0 && desc == "" {
		return "", "", nil, false
	}

	return title, desc, blocks, true
}

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

	if owner, repo, isGH := extractGitHubRepo(u); isGH {
		if md, found := h.fetchGitHubReadme(r.Context(), owner, repo); found {
			writeJSON(w, http.StatusOK, map[string]any{
				"url":         u.String(),
				"host":        "github.com",
				"status":      http.StatusOK,
				"title":       owner + "/" + repo + " · README.md",
				"description": "",
				"markdown":    md,
				"is_readme":   true,
				"blocks":      []any{},
			})
			return
		}
	}

	if wikiTitle, wikiDesc, wikiBlocks, found := h.fetchWikipediaArticle(r.Context(), u); found {
		writeJSON(w, http.StatusOK, map[string]any{
			"url":         u.String(),
			"host":        u.Hostname(),
			"status":      http.StatusOK,
			"title":       wikiTitle + " · Wikipedia",
			"description": wikiDesc,
			"blocks":      wikiBlocks,
		})
		return
	}

	if wdTitle, wdDesc, wdBlocks, found := h.fetchWikidataEntity(r.Context(), u); found {
		writeJSON(w, http.StatusOK, map[string]any{
			"url":         u.String(),
			"host":        "wikidata.org",
			"status":      http.StatusOK,
			"title":       wdTitle + " · Wikidata",
			"description": wdDesc,
			"blocks":      wdBlocks,
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
