package content

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	"github.com/josprox/examen-isoft-egel/backend/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Manifest struct {
	TemarioActivo string `json:"temarioActivo"`
	Temarios      []struct {
		ID      string            `json:"id"`
		Archivo string            `json:"archivo"`
		Bancos  []string          `json:"bancos"`
		Guias   map[string]string `json:"guias"`
	} `json:"temarios"`
	Recursos string   `json:"recursos"`
	Comandos []string `json:"comandos"`
}

type Guia struct {
	Clave     string `json:"clave"`
	Titulo    string `json:"titulo"`
	Contenido string `json:"contenido"`
}

type Loader struct {
	dir         string
	mu          sync.RWMutex
	temario     map[string]any
	guias       []Guia
	comandos    []map[string]any
	recursosCache []models.Recurso
}

func NewLoader(contenidoDir string) *Loader {
	return &Loader{dir: contenidoDir}
}

func (l *Loader) InvalidateCaches() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.temario = nil
	l.guias = nil
	l.comandos = nil
	l.recursosCache = nil
}

func (l *Loader) readManifest() (*Manifest, error) {
	raw, err := os.ReadFile(filepath.Join(l.dir, "manifest.json"))
	if err != nil {
		return nil, err
	}
	var m Manifest
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	return &m, nil
}

func (l *Loader) GetTemario() (map[string]any, error) {
	l.mu.RLock()
	if l.temario != nil {
		defer l.mu.RUnlock()
		return l.temario, nil
	}
	l.mu.RUnlock()

	m, err := l.readManifest()
	if err != nil {
		return nil, err
	}
	for _, t := range m.Temarios {
		if t.ID == m.TemarioActivo {
			raw, err := os.ReadFile(filepath.Join(l.dir, t.Archivo))
			if err != nil {
				return nil, err
			}
			var doc map[string]any
			if err := json.Unmarshal(raw, &doc); err != nil {
				return nil, err
			}
			l.mu.Lock()
			l.temario = doc
			l.mu.Unlock()
			return doc, nil
		}
	}
	return nil, os.ErrNotExist
}

var h1Re = regexp.MustCompile(`(?m)^#\s+(.+)$`)

func (l *Loader) GetGuias() []Guia {
	l.mu.RLock()
	if l.guias != nil {
		defer l.mu.RUnlock()
		return l.guias
	}
	l.mu.RUnlock()

	m, err := l.readManifest()
	if err != nil {
		return nil
	}

	var guiasMap map[string]string
	for _, t := range m.Temarios {
		if t.ID == m.TemarioActivo {
			guiasMap = t.Guias
			break
		}
	}

	// Mantener un orden estable: estrategias, temas-criticos, normas-iso y luego orden natural
	priority := []string{"estrategias", "temas-criticos", "normas-iso"}
	seen := map[string]bool{}
	var orderedKeys []string
	for _, k := range priority {
		if _, ok := guiasMap[k]; ok {
			orderedKeys = append(orderedKeys, k)
			seen[k] = true
		}
	}
	// Extraer resto de claves en orden del JSON usando lectura secuencial
	rawManifest, _ := os.ReadFile(filepath.Join(l.dir, "manifest.json"))
	keyOrder := extractGuiaKeyOrder(rawManifest, guiasMap)
	for _, k := range keyOrder {
		if !seen[k] {
			orderedKeys = append(orderedKeys, k)
			seen[k] = true
		}
	}
	for k := range guiasMap {
		if !seen[k] {
			orderedKeys = append(orderedKeys, k)
		}
	}

	var res []Guia
	for _, clave := range orderedKeys {
		ruta := guiasMap[clave]
		raw, err := os.ReadFile(filepath.Join(l.dir, ruta))
		if err != nil {
			continue
		}
		contenido := string(raw)
		titulo := clave
		if match := h1Re.FindStringSubmatch(contenido); len(match) > 1 {
			titulo = strings.TrimSpace(match[1])
		}
		res = append(res, Guia{
			Clave:     clave,
			Titulo:    titulo,
			Contenido: contenido,
		})
	}

	l.mu.Lock()
	l.guias = res
	l.mu.Unlock()
	return res
}

func extractGuiaKeyOrder(raw []byte, valid map[string]string) []string {
	var order []string
	re := regexp.MustCompile(`"([^"]+)"\s*:\s*"guias/[^"]+\.md"`)
	for _, m := range re.FindAllSubmatch(raw, -1) {
		k := string(m[1])
		if _, ok := valid[k]; ok {
			order = append(order, k)
		}
	}
	return order
}

func (l *Loader) GetComandos() []map[string]any {
	l.mu.RLock()
	if l.comandos != nil {
		defer l.mu.RUnlock()
		return l.comandos
	}
	l.mu.RUnlock()

	m, err := l.readManifest()
	if err != nil {
		return nil
	}

	var res []map[string]any
	for _, ruta := range m.Comandos {
		raw, err := os.ReadFile(filepath.Join(l.dir, ruta))
		if err != nil {
			continue
		}
		var doc map[string]any
		if err := json.Unmarshal(raw, &doc); err == nil {
			res = append(res, doc)
		}
	}

	l.mu.Lock()
	l.comandos = res
	l.mu.Unlock()
	return res
}

type bancoFile struct {
	Area      string `json:"area"`
	Banco     string `json:"banco"`
	Estimulos []struct {
		ID    string `json:"id"`
		Texto string `json:"texto"`
	} `json:"estimulos"`
	Preguntas []struct {
		ID         string          `json:"id"`
		Area       string          `json:"area"`
		Subarea    string          `json:"subarea"`
		Formato    string          `json:"formato"`
		Nivel      *string         `json:"nivel"`
		Estimulo   *string         `json:"estimulo"`
		Base       *string         `json:"base"`
		Lista      []string        `json:"lista"`
		Codigo     *string         `json:"codigo"`
		Pregunta   string          `json:"pregunta"`
		Opciones   []models.Opcion `json:"opciones"`
		Correcta   int             `json:"correcta"`
		Estrategia *string         `json:"estrategia"`
		Trampa     *string         `json:"trampa"`
		Conceptos  []string        `json:"conceptos"`
		Fuentes    []models.Fuente `json:"fuentes"`
	} `json:"preguntas"`
}

type recursosFile struct {
	Recursos []models.Recurso `json:"recursos"`
}

func (l *Loader) ImportarTodo(db *gorm.DB) (int, int, error) {
	m, err := l.readManifest()
	if err != nil {
		return 0, 0, err
	}

	var bancos []string
	for _, t := range m.Temarios {
		if t.ID == m.TemarioActivo {
			bancos = t.Bancos
			break
		}
	}

	type bancoChunk struct {
		preguntas []models.Pregunta
		err       error
	}
	chunks := make([]bancoChunk, len(bancos))

	var parseWg sync.WaitGroup
	for idx, ruta := range bancos {
		parseWg.Add(1)
		go func(i int, r string) {
			defer parseWg.Done()
			raw, err := os.ReadFile(filepath.Join(l.dir, r))
			if err != nil {
				return
			}
			var bf bancoFile
			if err := json.Unmarshal(raw, &bf); err != nil {
				chunks[i].err = err
				return
			}
			areaDef := bf.Area
			if areaDef == "" {
				areaDef = "GENERAL"
			}
			banco := bf.Banco
			if banco == "" {
				banco = "base"
			}
			estimulos := make(map[string]string, len(bf.Estimulos))
			for _, e := range bf.Estimulos {
				estimulos[e.ID] = e.Texto
			}

			out := make([]models.Pregunta, 0, len(bf.Preguntas))
			for _, p := range bf.Preguntas {
				area := p.Area
				if area == "" {
					if strings.HasPrefix(p.Subarea, "L1.") {
						area = "L1"
					} else if strings.HasPrefix(p.Subarea, "L2.") {
						area = "L2"
					} else {
						area = areaDef
					}
				}
				var estPtr *string
				if p.Estimulo != nil {
					if txt, ok := estimulos[*p.Estimulo]; ok {
						t := txt
						estPtr = &t
					}
				}
				out = append(out, models.Pregunta{
					ID:         p.ID,
					Area:       area,
					Subarea:    p.Subarea,
					Banco:      banco,
					Formato:    p.Formato,
					Nivel:      p.Nivel,
					Estimulo:   estPtr,
					Base:       p.Base,
					Lista:      p.Lista,
					Codigo:     p.Codigo,
					Pregunta:   p.Pregunta,
					Opciones:   p.Opciones,
					Correcta:   p.Correcta,
					Estrategia: p.Estrategia,
					Trampa:     p.Trampa,
					Conceptos:  p.Conceptos,
					Fuentes:    p.Fuentes,
				})
			}
			chunks[i].preguntas = out
		}(idx, ruta)
	}

	var recursosList []models.Recurso
	var recReadErr error
	parseWg.Add(1)
	go func() {
		defer parseWg.Done()
		if rawRec, err := os.ReadFile(filepath.Join(l.dir, "recursos.json")); err == nil {
			var rf recursosFile
			if err := json.Unmarshal(rawRec, &rf); err != nil {
				recReadErr = err
				return
			}
			recursosList = rf.Recursos
		}
	}()

	parseWg.Wait()

	var preguntas []models.Pregunta
	for _, ch := range chunks {
		if ch.err != nil {
			return 0, 0, ch.err
		}
		preguntas = append(preguntas, ch.preguntas...)
	}
	if recReadErr != nil {
		return len(preguntas), 0, recReadErr
	}

	var dbWg sync.WaitGroup
	var pregErr, recDBErr error
	if len(preguntas) > 0 {
		dbWg.Add(1)
		go func() {
			defer dbWg.Done()
			pregErr = db.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(preguntas, 100).Error
		}()
	}
	if len(recursosList) > 0 {
		dbWg.Add(1)
		go func() {
			defer dbWg.Done()
			recDBErr = db.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(recursosList, 100).Error
		}()
	}
	dbWg.Wait()

	if pregErr != nil {
		return 0, 0, pregErr
	}
	if recDBErr != nil {
		return len(preguntas), 0, recDBErr
	}

	l.InvalidateCaches()
	return len(preguntas), len(recursosList), nil
}
