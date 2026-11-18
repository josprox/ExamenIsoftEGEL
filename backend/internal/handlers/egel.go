package handlers

import (
	"fmt"
	"math/rand/v2"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/josprox/examen-isoft-egel/backend/internal/content"
	"github.com/josprox/examen-isoft-egel/backend/internal/models"
	"gorm.io/gorm"
)

type EgelHandler struct {
	DB       *gorm.DB
	Loader   *content.Loader
	recMu    sync.RWMutex
	recursos []models.Recurso
}

func (h *EgelHandler) InvalidateRecursosCache() {
	h.recMu.Lock()
	h.recursos = nil
	h.recMu.Unlock()
}

func (h *EgelHandler) Temario(w http.ResponseWriter, r *http.Request) {
	t, err := h.Loader.GetTemario()
	if err != nil || t == nil {
		writeErr(w, http.StatusNotFound, "Temario no encontrado.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"temario": t})
}

func (h *EgelHandler) Guias(w http.ResponseWriter, r *http.Request) {
	guias := h.Loader.GetGuias()
	if guias == nil {
		guias = []content.Guia{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"guias": guias})
}

func (h *EgelHandler) Comandos(w http.ResponseWriter, r *http.Request) {
	ramas := h.Loader.GetComandos()
	if ramas == nil {
		ramas = []map[string]any{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ramas": ramas})
}

func (h *EgelHandler) loadRecursos() []models.Recurso {
	h.recMu.RLock()
	if h.recursos != nil {
		defer h.recMu.RUnlock()
		return h.recursos
	}
	h.recMu.RUnlock()

	var count int64
	h.DB.Model(&models.Recurso{}).Count(&count)
	if count == 0 {
		_, _, _ = h.Loader.ImportarTodo(h.DB)
	}

	var list []models.Recurso
	h.DB.Order("COALESCE(prioridad, 99) ASC, titulo ASC").Find(&list)
	if list == nil {
		list = []models.Recurso{}
	}

	h.recMu.Lock()
	h.recursos = list
	h.recMu.Unlock()
	return list
}

func (h *EgelHandler) Biblioteca(w http.ResponseWriter, r *http.Request) {
	all := h.loadRecursos()
	qs := r.URL.Query()
	area := qs.Get("area")
	tipo := qs.Get("tipo")
	idioma := qs.Get("idioma")
	q := strings.ToLower(strings.TrimSpace(qs.Get("q")))
	soloArchivo := boolParam(qs.Get("solo_archivo"))
	soloOficial := boolParam(qs.Get("solo_oficial"))
	soloGratuito := boolParam(qs.Get("solo_gratuito"))
	orden := qs.Get("orden")
	if orden == "" {
		orden = "prioridad"
	}

	filtrados := make([]models.Recurso, 0, len(all))
	for _, rec := range all {
		if area != "" && !containsStr(rec.Areas, area) {
			continue
		}
		if tipo != "" && rec.Tipo != tipo {
			continue
		}
		if idioma != "" && (rec.Idioma == nil || *rec.Idioma != idioma) {
			continue
		}
		if soloArchivo && (rec.Archivo == nil || *rec.Archivo == "") {
			continue
		}
		if soloOficial && !rec.Oficial {
			continue
		}
		if soloGratuito && !rec.Gratuito {
			continue
		}
		if q != "" {
			autores := derefStr(rec.Autores)
			nota := derefStr(rec.Nota)
			hay := strings.ToLower(rec.Titulo + " " + autores + " " + nota + " " + strings.Join(rec.Subareas, " "))
			if !strings.Contains(hay, q) {
				continue
			}
		}
		filtrados = append(filtrados, rec)
	}

	if orden == "anio_desc" {
		sort.SliceStable(filtrados, func(i, j int) bool {
			return derefInt(filtrados[i].Anio) > derefInt(filtrados[j].Anio)
		})
	} else if orden == "titulo" {
		sort.SliceStable(filtrados, func(i, j int) bool {
			return strings.ToLower(filtrados[i].Titulo) < strings.ToLower(filtrados[j].Titulo)
		})
	}

	porTipo := map[string]int{}
	conArchivo, oficiales, gratuitos := 0, 0, 0
	for _, rec := range all {
		porTipo[rec.Tipo]++
		if rec.Archivo != nil && *rec.Archivo != "" {
			conArchivo++
		}
		if rec.Oficial {
			oficiales++
		}
		if rec.Gratuito {
			gratuitos++
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"recursos": filtrados,
		"total":    len(filtrados),
		"resumen": map[string]any{
			"total_catalogo": len(all),
			"con_archivo":    conArchivo,
			"oficiales":      oficiales,
			"gratuitos":      gratuitos,
			"por_tipo":       porTipo,
		},
	})
}

func (h *EgelHandler) Preguntas(w http.ResponseWriter, r *http.Request) {
	var count int64
	h.DB.Model(&models.Pregunta{}).Count(&count)
	if count == 0 {
		_, _, _ = h.Loader.ImportarTodo(h.DB)
	}

	qs := r.URL.Query()
	preset := qs.Get("preset")
	ocultar := boolParam(qs.Get("ocultar_respuestas"))

	if preset == "egel_completo" || preset == "practica_rapida" {
		temario, err := h.Loader.GetTemario()
		if err != nil {
			writeErr(w, http.StatusNotFound, "Temario no encontrado.")
			return
		}

		var todas []models.Pregunta
		h.DB.Where("banco != ?", "reto").Find(&todas)
		porSub := make(map[string][]models.Pregunta)
		for _, p := range todas {
			porSub[p.Subarea] = append(porSub[p.Subarea], p)
		}

		var seleccion []models.Pregunta
		secciones, _ := temario["secciones"].([]any)
		for _, sRaw := range secciones {
			sec, _ := sRaw.(map[string]any)
			areas, _ := sec["areas"].([]any)
			for _, aRaw := range areas {
				area, _ := aRaw.(map[string]any)
				subs, _ := area["subareas"].([]any)
				for _, subRaw := range subs {
					sub, _ := subRaw.(map[string]any)
					subID, _ := sub["id"].(string)
					tomar := int(asFloat(sub["reactivos"]))
					pool := append([]models.Pregunta(nil), porSub[subID]...)
					shufflePreguntas(pool)
					if len(pool) < tomar {
						writeErr(w, http.StatusUnprocessableEntity, fmt.Sprintf("Faltan reactivos para la subárea %s: %d de %d.", subID, len(pool), tomar))
						return
					}
					seleccion = append(seleccion, pool[:tomar]...)
				}
			}
		}

		if preset == "practica_rapida" {
			cupos := []struct {
				area string
				cupo int
			}{
				{"A1", 3}, {"A2", 3}, {"A3", 5}, {"A4", 3}, {"L1", 3}, {"L2", 3},
			}
			porArea := make(map[string][]models.Pregunta)
			for _, p := range seleccion {
				porArea[p.Area] = append(porArea[p.Area], p)
			}
			var rapida []models.Pregunta
			for _, c := range cupos {
				pool := porArea[c.area]
				shufflePreguntas(pool)
				if len(pool) > c.cupo {
					pool = pool[:c.cupo]
				}
				rapida = append(rapida, pool...)
			}
			seleccion = rapida
		}

		writePreguntasResponse(w, seleccion, ocultar)
		return
	}

	tx := h.DB.Model(&models.Pregunta{})
	if ids := strings.TrimSpace(qs.Get("ids")); ids != "" {
		var idList []string
		for _, part := range strings.Split(ids, ",") {
			part = strings.TrimSpace(part)
			if part != "" {
				idList = append(idList, part)
			}
		}
		if len(idList) > 0 {
			tx = tx.Where("id IN ?", idList)
		}
	} else {
		if area := qs.Get("area"); area != "" {
			tx = tx.Where("area = ?", area)
		}
		if subarea := qs.Get("subarea"); subarea != "" {
			tx = tx.Where("subarea = ?", subarea)
		}
		if banco := qs.Get("banco"); banco != "" {
			tx = tx.Where("banco = ?", banco)
		}
	}

	var preguntas []models.Pregunta
	tx.Find(&preguntas)
	shufflePreguntas(preguntas)

	if limitStr := qs.Get("limit"); limitStr != "" {
		if lim, err := strconv.Atoi(limitStr); err == nil && lim > 0 && lim < len(preguntas) {
			preguntas = preguntas[:lim]
		}
	}

	orden := qs.Get("orden")
	if orden == "" {
		orden = "modular"
	}
	if orden == "modular" {
		areaRank := map[string]int{"A1": 1, "A2": 2, "A3": 3, "A4": 4, "L1": 5, "L2": 6}
		sort.SliceStable(preguntas, func(i, j int) bool {
			ri := areaRank[preguntas[i].Area]
			if ri == 0 {
				ri = 99
			}
			rj := areaRank[preguntas[j].Area]
			if rj == 0 {
				rj = 99
			}
			if ri != rj {
				return ri < rj
			}
			return preguntas[i].Subarea < preguntas[j].Subarea
		})
	}

	writePreguntasResponse(w, preguntas, ocultar)
}

func writePreguntasResponse(w http.ResponseWriter, preguntas []models.Pregunta, ocultar bool) {
	if !ocultar {
		if preguntas == nil {
			preguntas = []models.Pregunta{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"preguntas": preguntas,
			"total":     len(preguntas),
		})
		return
	}

	sanitized := make([]models.PreguntaSinRespuesta, 0, len(preguntas))
	for _, p := range preguntas {
		sanitized = append(sanitized, p.OcultarRespuestas())
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"preguntas": sanitized,
		"total":     len(sanitized),
	})
}

var mdStripRe = regexp.MustCompile(`[#*\x60>_]+`)
var spaceCollapseRe = regexp.MustCompile(`\s+`)

func (h *EgelHandler) Buscar(w http.ResponseWriter, r *http.Request) {
	qs := r.URL.Query()
	q := strings.ToLower(strings.TrimSpace(qs.Get("q")))
	tipoFiltro := qs.Get("tipo")
	if tipoFiltro == "" {
		tipoFiltro = "todos"
	}

	if len([]rune(q)) < 2 {
		writeJSON(w, http.StatusOK, map[string]any{
			"guias":     []any{},
			"comandos":  []any{},
			"preguntas": []any{},
			"recursos":  []any{},
			"total":     0,
		})
		return
	}

	ctx := r.Context()

	var pCount, rCount int64
	var countWg sync.WaitGroup
	countWg.Add(2)
	go func() {
		defer countWg.Done()
		h.DB.WithContext(ctx).Model(&models.Pregunta{}).Count(&pCount)
	}()
	go func() {
		defer countWg.Done()
		h.DB.WithContext(ctx).Model(&models.Recurso{}).Count(&rCount)
	}()
	countWg.Wait()

	if pCount == 0 || rCount == 0 {
		_, _, _ = h.Loader.ImportarTodo(h.DB)
	}

	type pregHit struct {
		ID       string `json:"id"`
		Area     string `json:"area"`
		Subarea  string `json:"subarea"`
		Pregunta string `json:"pregunta"`
	}

	guiasOut := []map[string]any{}
	comandosOut := []map[string]any{}
	preguntasOut := []pregHit{}
	recursosOut := []models.Recurso{}

	like := "%" + strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(q) + "%"

	var wg sync.WaitGroup

	if tipoFiltro == "todos" || tipoFiltro == "guias" {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for _, g := range h.Loader.GetGuias() {
				if strings.Contains(strings.ToLower(g.Clave+" "+g.Titulo+" "+g.Contenido), q) {
					plain := mdStripRe.ReplaceAllString(g.Contenido, " ")
					plain = strings.TrimSpace(spaceCollapseRe.ReplaceAllString(plain, " "))
					runes := []rune(plain)
					lowerPlain := strings.ToLower(plain)
					snippet := ""
					if idx := strings.Index(lowerPlain, q); idx >= 0 {
						bytePrefix := len([]rune(plain[:idx]))
						start := max(0, bytePrefix-45)
						end := min(len(runes), start+140)
						snippet = string(runes[start:end])
					} else {
						end := min(len(runes), 120)
						snippet = string(runes[:end])
					}
					guiasOut = append(guiasOut, map[string]any{
						"clave":     g.Clave,
						"titulo":    g.Titulo,
						"contenido": g.Contenido,
						"snippet":   snippet,
					})
					if len(guiasOut) >= 8 {
						break
					}
				}
			}
		}()
	}

	if tipoFiltro == "todos" || tipoFiltro == "comandos" {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for _, rama := range h.Loader.GetComandos() {
				nombre, _ := rama["nombre"].(string)
				icono, _ := rama["icono"].(string)
				cmds, _ := rama["comandos"].([]any)
				for _, cRaw := range cmds {
					cMap, _ := cRaw.(map[string]any)
					cmd, _ := cMap["comando"].(string)
					desc, _ := cMap["descripcion"].(string)
					if strings.Contains(strings.ToLower(cmd+" "+desc+" "+nombre), q) {
						comandosOut = append(comandosOut, map[string]any{
							"rama":        nombre,
							"icono":       icono,
							"comando":     cmd,
							"descripcion": desc,
						})
						if len(comandosOut) >= 12 {
							break
						}
					}
				}
				if len(comandosOut) >= 12 {
					break
				}
			}
		}()
	}

	if tipoFiltro == "todos" || tipoFiltro == "preguntas" {
		wg.Add(1)
		go func() {
			defer wg.Done()
			h.DB.WithContext(ctx).Model(&models.Pregunta{}).
				Select("id, area, subarea, pregunta").
				Where("LOWER(id) LIKE ? OR LOWER(area) LIKE ? OR LOWER(subarea) LIKE ? OR LOWER(COALESCE(base, '')) LIKE ? OR LOWER(pregunta) LIKE ? OR LOWER(COALESCE(conceptos, '')) LIKE ?",
					like, like, like, like, like, like).
				Limit(10).
				Find(&preguntasOut)
		}()
	}

	if tipoFiltro == "todos" || tipoFiltro == "recursos" {
		wg.Add(1)
		go func() {
			defer wg.Done()
			h.DB.WithContext(ctx).Model(&models.Recurso{}).
				Where("LOWER(titulo) LIKE ? OR LOWER(COALESCE(autores, '')) LIKE ? OR LOWER(COALESCE(nota, '')) LIKE ? OR LOWER(COALESCE(subareas, '')) LIKE ?",
					like, like, like, like).
				Limit(10).
				Find(&recursosOut)
		}()
	}

	wg.Wait()

	total := len(guiasOut) + len(comandosOut) + len(preguntasOut) + len(recursosOut)
	writeJSON(w, http.StatusOK, map[string]any{
		"guias":     guiasOut,
		"comandos":  comandosOut,
		"preguntas": preguntasOut,
		"recursos":  recursosOut,
		"total":     total,
	})
}

func shufflePreguntas(list []models.Pregunta) {
	rand.Shuffle(len(list), func(i, j int) {
		list[i], list[j] = list[j], list[i]
	})
}

func boolParam(v string) bool {
	v = strings.ToLower(strings.TrimSpace(v))
	return v == "1" || v == "true" || v == "yes"
}

func containsStr(slice []string, target string) bool {
	for _, s := range slice {
		if s == target {
			return true
		}
	}
	return false
}

func derefStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func derefInt(p *int) int {
	if p == nil {
		return 0
	}
	return *p
}

func asFloat(v any) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case int:
		return float64(n)
	default:
		return 0
	}
}
