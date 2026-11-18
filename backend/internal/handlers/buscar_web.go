package handlers

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
)

type ConceptoWeb struct {
	Title    string `json:"title"`
	Extract  string `json:"extract"`
	URL      string `json:"url"`
	Source   string `json:"source"`
	Category string `json:"category"`
}

type WebEndpoints struct {
	WikiES          string
	WikiEN          string
	MDN             string
	StackOverflow   string
	OpenLibrary     string
	OpenAlex        string
	Crossref        string
	Arxiv           string
	GitHub          string
	Wikidata        string
	SemanticScholar string
	HackerNews      string
	Reddit          string
}

func DefaultWebEndpoints() WebEndpoints {
	return WebEndpoints{
		WikiES:          "https://es.wikipedia.org/w/api.php",
		WikiEN:          "https://en.wikipedia.org/w/api.php",
		MDN:             "https://developer.mozilla.org/api/v1/search",
		StackOverflow:   "https://api.stackexchange.com/2.3/search/advanced",
		OpenLibrary:     "https://openlibrary.org/search.json",
		OpenAlex:        "https://api.openalex.org/works",
		Crossref:        "https://api.crossref.org/works",
		Arxiv:           "https://export.arxiv.org/api/query",
		GitHub:          "https://api.github.com/search/repositories",
		Wikidata:        "https://www.wikidata.org/w/api.php",
		SemanticScholar: "https://api.semanticscholar.org/graph/v1/paper/search",
		HackerNews:      "https://hn.algolia.com/api/v1/search",
		Reddit:          "https://www.reddit.com/search.json",
	}
}

type webCacheEntry struct {
	items     []ConceptoWeb
	expiresAt time.Time
}

type WebSearchHandler struct {
	Client    *http.Client
	Endpoints WebEndpoints
	mu        sync.RWMutex
	cache     map[string]webCacheEntry
}

func NewWebSearchHandler() *WebSearchHandler {
	transport := &http.Transport{
		MaxIdleConns:        120,
		MaxIdleConnsPerHost: 12,
		IdleConnTimeout:     90 * time.Second,
	}
	return &WebSearchHandler{
		Client:    &http.Client{Timeout: 2500 * time.Millisecond, Transport: transport},
		Endpoints: DefaultWebEndpoints(),
		cache:     make(map[string]webCacheEntry),
	}
}

func (h *WebSearchHandler) BuscarWeb(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	fuente := strings.TrimSpace(r.URL.Query().Get("fuente"))
	if fuente == "" {
		fuente = "todos"
	}
	if len([]rune(q)) < 2 {
		writeJSON(w, http.StatusOK, map[string]any{"conceptos": []ConceptoWeb{}})
		return
	}

	sum := sha1.Sum([]byte(fuente + "|" + strings.ToLower(q)))
	cacheKey := hex.EncodeToString(sum[:])

	h.mu.RLock()
	if entry, ok := h.cache[cacheKey]; ok && time.Now().Before(entry.expiresAt) {
		h.mu.RUnlock()
		writeJSON(w, http.StatusOK, map[string]any{"conceptos": entry.items})
		return
	}
	h.mu.RUnlock()

	items := h.fetchSources(r.Context(), q, fuente)

	h.mu.Lock()
	if len(h.cache) > 500 {
		now := time.Now()
		for k, v := range h.cache {
			if now.After(v.expiresAt) {
				delete(h.cache, k)
			}
		}
	}
	h.cache[cacheKey] = webCacheEntry{items: items, expiresAt: time.Now().Add(time.Hour)}
	h.mu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"conceptos": items})
}

func (h *WebSearchHandler) fetchSources(ctx context.Context, q, fuente string) []ConceptoWeb {
	rapidas := map[string]bool{"wikipedia": true, "wikidata": true, "mdn": true, "hackernews": true, "github": true, "stackoverflow": true}
	academicas := map[string]bool{"semanticscholar": true, "openalex": true, "openlibrary": true, "crossref": true, "arxiv": true, "reddit": true}

	want := func(name string) bool {
		if fuente == "todos" {
			return true
		}
		if fuente == "rapidas" {
			return rapidas[name]
		}
		if fuente == "academicas" {
			return academicas[name]
		}
		return fuente == name
	}

	order := []string{
		"wikipedia", "wikidata", "mdn", "stackoverflow", "hackernews", "github",
		"semanticscholar", "openalex", "openlibrary", "crossref", "arxiv", "reddit",
	}
	buckets := make([][]ConceptoWeb, len(order))
	var wg sync.WaitGroup

	run := func(idx int, name string, fn func() []ConceptoWeb) {
		if !want(name) {
			return
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			buckets[idx] = fn()
		}()
	}

	run(0, "wikipedia", func() []ConceptoWeb {
		limit := 4
		if fuente == "wikipedia" {
			limit = 6
		}
		items := h.fetchWikipedia(ctx, h.Endpoints.WikiES, "es", q, limit)
		if len(items) == 0 {
			items = h.fetchWikipedia(ctx, h.Endpoints.WikiEN, "en", q, limit)
		}
		return items
	})
	run(1, "wikidata", func() []ConceptoWeb { return h.fetchWikidata(ctx, q, fuente == "wikidata") })
	run(2, "mdn", func() []ConceptoWeb { return h.fetchMDN(ctx, q, fuente == "mdn") })
	run(3, "stackoverflow", func() []ConceptoWeb { return h.fetchStackOverflow(ctx, q, fuente == "stackoverflow") })
	run(4, "hackernews", func() []ConceptoWeb { return h.fetchHackerNews(ctx, q, fuente == "hackernews") })
	run(5, "github", func() []ConceptoWeb { return h.fetchGitHub(ctx, q, fuente == "github") })
	run(6, "semanticscholar", func() []ConceptoWeb { return h.fetchSemanticScholar(ctx, q, fuente == "semanticscholar") })
	run(7, "openalex", func() []ConceptoWeb { return h.fetchOpenAlex(ctx, q, fuente == "openalex") })
	run(8, "openlibrary", func() []ConceptoWeb { return h.fetchOpenLibrary(ctx, q, fuente == "openlibrary") })
	run(9, "crossref", func() []ConceptoWeb { return h.fetchCrossref(ctx, q, fuente == "crossref") })
	run(10, "arxiv", func() []ConceptoWeb { return h.fetchArxiv(ctx, q, fuente == "arxiv") })
	run(11, "reddit", func() []ConceptoWeb { return h.fetchReddit(ctx, q, fuente == "reddit") })

	wg.Wait()

	out := []ConceptoWeb{}
	for _, b := range buckets {
		out = append(out, b...)
	}
	return out
}

func (h *WebSearchHandler) doGet(ctx context.Context, rawURL string, headers map[string]string) ([]byte, bool) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, false
	}
	req.Header.Set("User-Agent", "ExamenIsoftEGEL/1.0 (https://egelsoft.astriom.org)")
	req.Header.Set("Accept", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := h.Client.Do(req)
	if err != nil {
		return nil, false
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, false
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	return body, err == nil
}

func (h *WebSearchHandler) fetchWikipedia(ctx context.Context, base, lang, q string, limit int) []ConceptoWeb {
	u := fmt.Sprintf("%s?action=query&generator=search&gsrsearch=%s&gsrlimit=%d&prop=extracts|info&inprop=url&exintro=1&explaintext=1&exchars=240&format=json&utf8=1",
		base, url.QueryEscape(q), limit)
	body, ok := h.doGet(ctx, u, nil)
	if !ok {
		return nil
	}
	var doc struct {
		Query struct {
			Pages map[string]struct {
				Index   int    `json:"index"`
				Title   string `json:"title"`
				Extract string `json:"extract"`
				FullURL string `json:"fullurl"`
			} `json:"pages"`
		} `json:"query"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil
	}
	type indexed struct {
		idx  int
		item ConceptoWeb
	}
	var list []indexed
	for _, p := range doc.Query.Pages {
		if p.Title == "" || p.FullURL == "" {
			continue
		}
		list = append(list, indexed{
			idx: p.Index,
			item: ConceptoWeb{
				Title:    p.Title,
				Extract:  strings.TrimSpace(p.Extract),
				URL:      p.FullURL,
				Source:   lang + ".wikipedia.org",
				Category: "wikipedia",
			},
		})
	}
	sort.Slice(list, func(i, j int) bool { return list[i].idx < list[j].idx })
	out := make([]ConceptoWeb, 0, len(list))
	for _, x := range list {
		out = append(out, x.item)
	}
	return out
}

func (h *WebSearchHandler) fetchWikidata(ctx context.Context, q string, single bool) []ConceptoWeb {
	limit := 3
	if single {
		limit = 6
	}
	u := fmt.Sprintf("%s?action=wbsearchentities&search=%s&language=es&uselang=es&type=item&limit=%d&format=json",
		h.Endpoints.Wikidata, url.QueryEscape(q), limit)
	body, ok := h.doGet(ctx, u, nil)
	if !ok {
		return nil
	}
	var doc struct {
		Search []struct {
			ID          string `json:"id"`
			Label       string `json:"label"`
			Description string `json:"description"`
			ConceptURI  string `json:"concepturi"`
		} `json:"search"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil
	}
	var out []ConceptoWeb
	for _, it := range doc.Search {
		if it.Label == "" || it.ConceptURI == "" {
			continue
		}
		title := it.Label
		if it.ID != "" {
			title += " (" + it.ID + ")"
		}
		desc := strings.TrimSpace(it.Description)
		if desc == "" {
			desc = "Entidad de conocimiento estructurado"
		}
		out = append(out, ConceptoWeb{
			Title:    title,
			Extract:  desc,
			URL:      it.ConceptURI,
			Source:   "wikidata.org",
			Category: "wikidata",
		})
	}
	return out
}

func (h *WebSearchHandler) fetchMDN(ctx context.Context, q string, single bool) []ConceptoWeb {
	limit := 3
	if single {
		limit = 6
	}
	u := fmt.Sprintf("%s?q=%s&locale=es&size=%d", h.Endpoints.MDN, url.QueryEscape(q), limit)
	body, ok := h.doGet(ctx, u, nil)
	if !ok {
		return nil
	}
	var doc struct {
		Documents []struct {
			Title   string `json:"title"`
			Summary string `json:"summary"`
			MDNURL  string `json:"mdn_url"`
		} `json:"documents"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil
	}
	var out []ConceptoWeb
	for _, d := range doc.Documents {
		if d.MDNURL == "" {
			continue
		}
		out = append(out, ConceptoWeb{
			Title:    d.Title,
			Extract:  strings.TrimSpace(d.Summary),
			URL:      "https://developer.mozilla.org" + d.MDNURL,
			Source:   "developer.mozilla.org",
			Category: "mdn",
		})
	}
	return out
}

func (h *WebSearchHandler) fetchStackOverflow(ctx context.Context, q string, single bool) []ConceptoWeb {
	limit := 3
	if single {
		limit = 6
	}
	u := fmt.Sprintf("%s?order=desc&sort=votes&q=%s&site=stackoverflow&pagesize=%d", h.Endpoints.StackOverflow, url.QueryEscape(q), limit)
	body, ok := h.doGet(ctx, u, nil)
	if !ok {
		return nil
	}
	var doc struct {
		Items []struct {
			Title       string   `json:"title"`
			Link        string   `json:"link"`
			Score       int      `json:"score"`
			AnswerCount int      `json:"answer_count"`
			Tags        []string `json:"tags"`
		} `json:"items"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil
	}
	var out []ConceptoWeb
	for _, it := range doc.Items {
		title := html.UnescapeString(it.Title)
		if title == "" || it.Link == "" {
			continue
		}
		tags := it.Tags
		if len(tags) > 4 {
			tags = tags[:4]
		}
		ext := fmt.Sprintf("Votos: %d · Respuestas: %d", it.Score, it.AnswerCount)
		if len(tags) > 0 {
			ext += " · Etiquetas: " + strings.Join(tags, ", ")
		}
		out = append(out, ConceptoWeb{
			Title:    title,
			Extract:  ext,
			URL:      it.Link,
			Source:   "stackoverflow.com",
			Category: "stackoverflow",
		})
	}
	return out
}

func (h *WebSearchHandler) fetchHackerNews(ctx context.Context, q string, single bool) []ConceptoWeb {
	limit := 3
	if single {
		limit = 6
	}
	u := fmt.Sprintf("%s?query=%s&tags=story&hitsPerPage=%d", h.Endpoints.HackerNews, url.QueryEscape(q), limit)
	body, ok := h.doGet(ctx, u, nil)
	if !ok {
		return nil
	}
	var doc struct {
		Hits []struct {
			ObjectID    string `json:"objectID"`
			Title       string `json:"title"`
			URL         string `json:"url"`
			Points      int    `json:"points"`
			NumComments int    `json:"num_comments"`
		} `json:"hits"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil
	}
	var out []ConceptoWeb
	for _, hit := range doc.Hits {
		link := hit.URL
		if link == "" && hit.ObjectID != "" {
			link = "https://news.ycombinator.com/item?id=" + hit.ObjectID
		}
		if hit.Title == "" || link == "" {
			continue
		}
		out = append(out, ConceptoWeb{
			Title:    hit.Title,
			Extract:  fmt.Sprintf("Hacker News · %d puntos · %d comentarios", hit.Points, hit.NumComments),
			URL:      link,
			Source:   "news.ycombinator.com",
			Category: "hackernews",
		})
	}
	return out
}

func (h *WebSearchHandler) fetchGitHub(ctx context.Context, q string, single bool) []ConceptoWeb {
	limit := 3
	if single {
		limit = 6
	}
	u := fmt.Sprintf("%s?q=%s&sort=stars&per_page=%d", h.Endpoints.GitHub, url.QueryEscape(q), limit)
	body, ok := h.doGet(ctx, u, map[string]string{"Accept": "application/vnd.github+json"})
	if !ok {
		return nil
	}
	var doc struct {
		Items []struct {
			FullName    string `json:"full_name"`
			HTMLURL     string `json:"html_url"`
			Description string `json:"description"`
			Language    string `json:"language"`
			Stars       int    `json:"stargazers_count"`
		} `json:"items"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil
	}
	var out []ConceptoWeb
	for _, repo := range doc.Items {
		if repo.FullName == "" || repo.HTMLURL == "" {
			continue
		}
		title := repo.FullName
		if repo.Language != "" {
			title += " (" + repo.Language + ")"
		}
		ext := fmt.Sprintf("★ %d", repo.Stars)
		if repo.Description != "" {
			ext += " · " + strings.TrimSpace(repo.Description)
		}
		out = append(out, ConceptoWeb{
			Title:    title,
			Extract:  ext,
			URL:      repo.HTMLURL,
			Source:   "github.com",
			Category: "github",
		})
	}
	return out
}

func (h *WebSearchHandler) fetchSemanticScholar(ctx context.Context, q string, single bool) []ConceptoWeb {
	limit := 3
	if single {
		limit = 6
	}
	u := fmt.Sprintf("%s?query=%s&limit=%d&fields=title,abstract,year,url,citationCount", h.Endpoints.SemanticScholar, url.QueryEscape(q), limit)
	body, ok := h.doGet(ctx, u, nil)
	if !ok {
		return nil
	}
	var doc struct {
		Data []struct {
			Title         string `json:"title"`
			Abstract      string `json:"abstract"`
			Year          *int   `json:"year"`
			URL           string `json:"url"`
			CitationCount int    `json:"citationCount"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil
	}
	var out []ConceptoWeb
	for _, p := range doc.Data {
		if p.Title == "" || p.URL == "" {
			continue
		}
		meta := fmt.Sprintf("Citas: %d", p.CitationCount)
		if p.Year != nil {
			meta = fmt.Sprintf("%d · %s", *p.Year, meta)
		}
		ext := meta
		if abs := strings.TrimSpace(p.Abstract); abs != "" {
			r := []rune(abs)
			if len(r) > 170 {
				abs = string(r[:170]) + "…"
			}
			ext = meta + " — " + abs
		}
		out = append(out, ConceptoWeb{
			Title:    p.Title,
			Extract:  ext,
			URL:      p.URL,
			Source:   "semanticscholar.org",
			Category: "semanticscholar",
		})
	}
	return out
}

func (h *WebSearchHandler) fetchOpenAlex(ctx context.Context, q string, single bool) []ConceptoWeb {
	limit := 3
	if single {
		limit = 6
	}
	u := fmt.Sprintf("%s?search=%s&per-page=%d", h.Endpoints.OpenAlex, url.QueryEscape(q), limit)
	body, ok := h.doGet(ctx, u, nil)
	if !ok {
		return nil
	}
	var doc struct {
		Results []struct {
			ID          string `json:"id"`
			DOI         string `json:"doi"`
			Title       string `json:"title"`
			Year        *int   `json:"publication_year"`
			CitedBy     int    `json:"cited_by_count"`
			Authorships []struct {
				Author struct {
					DisplayName string `json:"display_name"`
				} `json:"author"`
			} `json:"authorships"`
		} `json:"results"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil
	}
	var out []ConceptoWeb
	for _, w := range doc.Results {
		link := w.DOI
		if link == "" {
			link = w.ID
		}
		if w.Title == "" || link == "" {
			continue
		}
		var auths []string
		for i, a := range w.Authorships {
			if i >= 2 {
				break
			}
			if a.Author.DisplayName != "" {
				auths = append(auths, a.Author.DisplayName)
			}
		}
		authorTxt := "Investigación académica"
		if len(auths) > 0 {
			authorTxt = strings.Join(auths, ", ")
		}
		if w.Year != nil {
			authorTxt += fmt.Sprintf(" · %d", *w.Year)
		}
		authorTxt += fmt.Sprintf(" · Citas: %d", w.CitedBy)
		out = append(out, ConceptoWeb{
			Title:    w.Title,
			Extract:  authorTxt,
			URL:      link,
			Source:   "openalex.org",
			Category: "openalex",
		})
	}
	return out
}

func (h *WebSearchHandler) fetchOpenLibrary(ctx context.Context, q string, single bool) []ConceptoWeb {
	limit := 3
	if single {
		limit = 6
	}
	u := fmt.Sprintf("%s?q=%s&limit=%d", h.Endpoints.OpenLibrary, url.QueryEscape(q), limit)
	body, ok := h.doGet(ctx, u, nil)
	if !ok {
		return nil
	}
	var doc struct {
		Docs []struct {
			Key              string   `json:"key"`
			Title            string   `json:"title"`
			AuthorName       []string `json:"author_name"`
			FirstPublishYear *int     `json:"first_publish_year"`
		} `json:"docs"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil
	}
	var out []ConceptoWeb
	for _, d := range doc.Docs {
		if d.Key == "" || d.Title == "" {
			continue
		}
		auths := d.AuthorName
		if len(auths) > 2 {
			auths = auths[:2]
		}
		ext := "Autor no especificado"
		if len(auths) > 0 {
			ext = strings.Join(auths, ", ")
		}
		if d.FirstPublishYear != nil {
			ext += fmt.Sprintf(" (%d)", *d.FirstPublishYear)
		}
		out = append(out, ConceptoWeb{
			Title:    d.Title,
			Extract:  ext,
			URL:      "https://openlibrary.org" + d.Key,
			Source:   "openlibrary.org",
			Category: "openlibrary",
		})
	}
	return out
}

func (h *WebSearchHandler) fetchCrossref(ctx context.Context, q string, single bool) []ConceptoWeb {
	limit := 3
	if single {
		limit = 6
	}
	u := fmt.Sprintf("%s?query=%s&rows=%d", h.Endpoints.Crossref, url.QueryEscape(q), limit)
	body, ok := h.doGet(ctx, u, map[string]string{"User-Agent": "ExamenIsoftEGEL/1.0 (mailto:contacto@astriom.org)"})
	if !ok {
		return nil
	}
	var doc struct {
		Message struct {
			Items []struct {
				Title     []string `json:"title"`
				URL       string   `json:"URL"`
				Publisher string   `json:"publisher"`
				Published struct {
					DateParts [][]int `json:"date-parts"`
				} `json:"published"`
			} `json:"items"`
		} `json:"message"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil
	}
	var out []ConceptoWeb
	for _, it := range doc.Message.Items {
		if len(it.Title) == 0 || it.Title[0] == "" || it.URL == "" {
			continue
		}
		pub := it.Publisher
		if pub == "" {
			pub = "Publicación académica"
		}
		if len(it.Published.DateParts) > 0 && len(it.Published.DateParts[0]) > 0 {
			pub += fmt.Sprintf(" (%d)", it.Published.DateParts[0][0])
		}
		out = append(out, ConceptoWeb{
			Title:    it.Title[0],
			Extract:  pub,
			URL:      it.URL,
			Source:   "crossref.org",
			Category: "crossref",
		})
	}
	return out
}

func (h *WebSearchHandler) fetchArxiv(ctx context.Context, q string, single bool) []ConceptoWeb {
	limit := 3
	if single {
		limit = 6
	}
	u := fmt.Sprintf("%s?search_query=all:%s&start=0&max_results=%d", h.Endpoints.Arxiv, url.QueryEscape(q), limit)
	body, ok := h.doGet(ctx, u, map[string]string{"Accept": "application/atom+xml"})
	if !ok {
		return nil
	}
	var feed struct {
		Entries []struct {
			ID      string `xml:"id"`
			Title   string `xml:"title"`
			Summary string `xml:"summary"`
		} `xml:"entry"`
	}
	if err := xml.Unmarshal(body, &feed); err != nil {
		return nil
	}
	var out []ConceptoWeb
	for _, e := range feed.Entries {
		title := strings.TrimSpace(spaceCollapseRe.ReplaceAllString(e.Title, " "))
		link := strings.TrimSpace(e.ID)
		sum := strings.TrimSpace(spaceCollapseRe.ReplaceAllString(e.Summary, " "))
		if title == "" || link == "" {
			continue
		}
		r := []rune(sum)
		if len(r) > 200 {
			sum = string(r[:200]) + "…"
		}
		out = append(out, ConceptoWeb{
			Title:    title,
			Extract:  sum,
			URL:      link,
			Source:   "arxiv.org",
			Category: "arxiv",
		})
	}
	return out
}

func (h *WebSearchHandler) fetchReddit(ctx context.Context, q string, single bool) []ConceptoWeb {
	limit := 3
	if single {
		limit = 6
	}
	u := fmt.Sprintf("%s?q=%s&sort=relevance&limit=%d", h.Endpoints.Reddit, url.QueryEscape(q), limit)
	body, ok := h.doGet(ctx, u, map[string]string{"User-Agent": "web:ExamenIsoftEGEL:v1.0 (by /u/egel_portal)"})
	if !ok {
		return nil
	}
	var doc struct {
		Data struct {
			Children []struct {
				Data struct {
					Title       string `json:"title"`
					Permalink   string `json:"permalink"`
					Subreddit   string `json:"subreddit_name_prefixed"`
					Ups         int    `json:"ups"`
					NumComments int    `json:"num_comments"`
				} `json:"data"`
			} `json:"children"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil
	}
	var out []ConceptoWeb
	for _, ch := range doc.Data.Children {
		p := ch.Data
		if p.Title == "" || p.Permalink == "" {
			continue
		}
		sub := p.Subreddit
		if sub == "" {
			sub = "reddit"
		}
		out = append(out, ConceptoWeb{
			Title:    p.Title,
			Extract:  fmt.Sprintf("%s · %d votos · %d comentarios", sub, p.Ups, p.NumComments),
			URL:      "https://www.reddit.com" + p.Permalink,
			Source:   "reddit.com",
			Category: "reddit",
		})
	}
	return out
}
