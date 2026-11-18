package handlers

import (
	"encoding/json"
	"math"
	"net/http"
	"strconv"
	"sync"

	"github.com/go-chi/chi/v5"
	"github.com/josprox/examen-isoft-egel/backend/internal/content"
	"github.com/josprox/examen-isoft-egel/backend/internal/middleware"
	"github.com/josprox/examen-isoft-egel/backend/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type IntentoHandler struct {
	DB     *gorm.DB
	Loader *content.Loader
	Hub    *WSHub
}

func (h *IntentoHandler) notifySync(userID uint64, action string, intentoID uint64, extra ...map[string]any) {
	if h.Hub != nil {
		msg := map[string]any{
			"type":       "intento_sync",
			"action":     action,
			"intento_id": intentoID,
		}
		for _, e := range extra {
			for k, v := range e {
				msg[k] = v
			}
		}
		h.Hub.BroadcastUser(userID, msg)
	}
}

type areaStat struct {
	Total      int `json:"total"`
	Aciertos   int `json:"aciertos"`
	Porcentaje int `json:"porcentaje"`
}

func (h *IntentoHandler) Index(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserFromContext(r.Context())
	ctx := r.Context()

	type groupRow struct {
		Key      string
		Total    int64
		Aciertos int64
	}

	var (
		intentos   []models.Intento
		tot        struct {
			Total    int64
			Aciertos int64
		}
		areaRows   []groupRow
		subRows    []groupRow
		erroresRaw []string
		wg         sync.WaitGroup
	)

	wg.Add(5)

	go func() {
		defer wg.Done()
		h.DB.WithContext(ctx).Where("user_id = ?", user.ID).Order("created_at DESC").Limit(30).Find(&intentos)
	}()

	go func() {
		defer wg.Done()
		h.DB.WithContext(ctx).Model(&models.Respuesta{}).
			Select("COUNT(*) as total, COALESCE(SUM(CASE WHEN es_correcta = 1 THEN 1 ELSE 0 END), 0) as aciertos").
			Where("user_id = ?", user.ID).
			Scan(&tot)
	}()

	go func() {
		defer wg.Done()
		h.DB.WithContext(ctx).Model(&models.Respuesta{}).
			Select("area as `key`, COUNT(*) as total, COALESCE(SUM(CASE WHEN es_correcta = 1 THEN 1 ELSE 0 END), 0) as aciertos").
			Where("user_id = ?", user.ID).
			Group("area").
			Scan(&areaRows)
	}()

	go func() {
		defer wg.Done()
		h.DB.WithContext(ctx).Model(&models.Respuesta{}).
			Select("subarea as `key`, COUNT(*) as total, COALESCE(SUM(CASE WHEN es_correcta = 1 THEN 1 ELSE 0 END), 0) as aciertos").
			Where("user_id = ?", user.ID).
			Group("subarea").
			Order("subarea ASC").
			Scan(&subRows)
	}()

	go func() {
		defer wg.Done()
		h.DB.WithContext(ctx).Model(&models.Respuesta{}).
			Where("user_id = ? AND es_correcta = ?", user.ID, false).
			Order("created_at DESC").
			Limit(30).
			Pluck("pregunta_id", &erroresRaw)
	}()

	wg.Wait()

	if intentos == nil {
		intentos = []models.Intento{}
	}

	porArea := make(map[string]areaStat, len(areaRows))
	for _, row := range areaRows {
		pct := 0
		if row.Total > 0 {
			pct = int(math.Round(float64(row.Aciertos) / float64(row.Total) * 100))
		}
		porArea[row.Key] = areaStat{Total: int(row.Total), Aciertos: int(row.Aciertos), Porcentaje: pct}
	}

	porSubarea := make(map[string]areaStat, len(subRows))
	for _, row := range subRows {
		pct := 0
		if row.Total > 0 {
			pct = int(math.Round(float64(row.Aciertos) / float64(row.Total) * 100))
		}
		porSubarea[row.Key] = areaStat{Total: int(row.Total), Aciertos: int(row.Aciertos), Porcentaje: pct}
	}

	seenErr := make(map[string]bool)
	erroresRecientes := []string{}
	for _, pid := range erroresRaw {
		if !seenErr[pid] {
			seenErr[pid] = true
			erroresRecientes = append(erroresRecientes, pid)
		}
	}

	completados := 0
	for _, it := range intentos {
		if it.Completado {
			completados++
		}
	}

	precisionGlobal := 0
	if tot.Total > 0 {
		precisionGlobal = int(math.Round(float64(tot.Aciertos) / float64(tot.Total) * 100))
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"intentos": intentos,
		"estadisticas": map[string]any{
			"total_intentos":    completados,
			"total_respuestas":  int(tot.Total),
			"total_aciertos":    int(tot.Aciertos),
			"precision_global":  precisionGlobal,
			"por_area":          porArea,
			"por_subarea":       porSubarea,
			"errores_recientes": erroresRecientes,
		},
	})
}

func (h *IntentoHandler) Store(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserFromContext(r.Context())

	var count int64
	h.DB.Model(&models.Pregunta{}).Count(&count)
	if count == 0 && h.Loader != nil {
		_, _, _ = h.Loader.ImportarTodo(h.DB)
	}

	var req struct {
		Modo           string   `json:"modo"`
		AreaFiltro     *string  `json:"area_filtro"`
		BancoFiltro    *string  `json:"banco_filtro"`
		TotalPreguntas int      `json:"total_preguntas"`
		PreguntaIDs    []string `json:"pregunta_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusUnprocessableEntity, "Datos inválidos.")
		return
	}
	if req.Modo != "inmediato" && req.Modo != "examen" {
		writeErr(w, http.StatusUnprocessableEntity, "Modo inválido.")
		return
	}
	if req.TotalPreguntas < 1 {
		writeErr(w, http.StatusUnprocessableEntity, "total_preguntas debe ser al menos 1.")
		return
	}

	intento := models.Intento{
		UserID:         user.ID,
		Modo:           req.Modo,
		AreaFiltro:     req.AreaFiltro,
		BancoFiltro:    req.BancoFiltro,
		PreguntaIDs:    req.PreguntaIDs,
		TotalPreguntas: req.TotalPreguntas,
	}
	if err := h.DB.Create(&intento).Error; err != nil {
		writeErr(w, http.StatusInternalServerError, "No se pudo crear el intento.")
		return
	}

	h.notifySync(user.ID, "created", intento.ID)
	writeJSON(w, http.StatusCreated, map[string]any{"intento": intento})
}

func (h *IntentoHandler) Show(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserFromContext(r.Context())
	intento, ok := h.findOwnedIntento(w, r, user.ID)
	if !ok {
		return
	}

	var respuestas []models.Respuesta
	h.DB.Where("intento_id = ?", intento.ID).Find(&respuestas)

	ids := intento.PreguntaIDs
	if len(ids) == 0 {
		for _, resp := range respuestas {
			ids = append(ids, resp.PreguntaID)
		}
	}

	pregMap := make(map[string]models.Pregunta)
	if len(ids) > 0 {
		var list []models.Pregunta
		h.DB.Where("id IN ?", ids).Find(&list)
		for _, p := range list {
			pregMap[p.ID] = p
		}
	}

	ocultar := !intento.Completado && intento.Modo == "examen"
	preguntasOut := make([]any, 0, len(ids))
	for _, id := range ids {
		if p, exists := pregMap[id]; exists {
			if ocultar {
				preguntasOut = append(preguntasOut, p.OcultarRespuestas())
			} else {
				preguntasOut = append(preguntasOut, p)
			}
		}
	}

	respOut := make([]map[string]any, 0, len(respuestas))
	for _, resp := range respuestas {
		var esCorrecta any = nil
		if intento.Completado || intento.Modo == "inmediato" {
			esCorrecta = resp.EsCorrecta
		}
		respOut = append(respOut, map[string]any{
			"pregunta_id":  resp.PreguntaID,
			"seleccionada": resp.Seleccionada,
			"es_correcta":  esCorrecta,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"intento":    intento,
		"preguntas":  preguntasOut,
		"respuestas": respOut,
	})
}

func (h *IntentoHandler) GuardarRespuesta(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserFromContext(r.Context())
	intento, ok := h.findOwnedIntento(w, r, user.ID)
	if !ok {
		return
	}
	if intento.Completado {
		writeErr(w, http.StatusConflict, "El intento ya terminó.")
		return
	}

	var req struct {
		PreguntaID   string `json:"pregunta_id"`
		Seleccionada *int   `json:"seleccionada"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.PreguntaID == "" || req.Seleccionada == nil || *req.Seleccionada < 0 {
		writeErr(w, http.StatusUnprocessableEntity, "Datos de respuesta inválidos.")
		return
	}

	var pregunta models.Pregunta
	if err := h.DB.Where("id = ?", req.PreguntaID).First(&pregunta).Error; err != nil {
		writeErr(w, http.StatusUnprocessableEntity, "La pregunta no existe.")
		return
	}
	if *req.Seleccionada >= len(pregunta.Opciones) {
		writeErr(w, http.StatusUnprocessableEntity, "Opción inválida.")
		return
	}

	resp := models.Respuesta{
		IntentoID:    intento.ID,
		UserID:       user.ID,
		PreguntaID:   pregunta.ID,
		Area:         pregunta.Area,
		Subarea:      pregunta.Subarea,
		Seleccionada: *req.Seleccionada,
		Correcta:     pregunta.Correcta,
		EsCorrecta:   *req.Seleccionada == pregunta.Correcta,
	}

	err := h.DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "intento_id"}, {Name: "pregunta_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"seleccionada", "correcta", "es_correcta", "updated_at"}),
	}).Create(&resp).Error
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "No se pudo guardar la respuesta.")
		return
	}

	h.recalcularIntento(&intento)
	h.notifySync(user.ID, "updated", intento.ID, map[string]any{
		"pregunta_id":  req.PreguntaID,
		"seleccionada": req.Seleccionada,
	})
	writeJSON(w, http.StatusOK, map[string]any{"intento": intento})
}

func (h *IntentoHandler) Finalizar(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserFromContext(r.Context())
	intento, ok := h.findOwnedIntento(w, r, user.ID)
	if !ok {
		return
	}

	var req struct {
		DuracionSegundos *int `json:"duracion_segundos"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	h.recalcularIntento(&intento)
	if req.DuracionSegundos != nil && *req.DuracionSegundos >= 0 {
		intento.DuracionSegundos = *req.DuracionSegundos
	}
	intento.Completado = true
	h.DB.Save(&intento)

	preguntasOut := []models.Pregunta{}
	if len(intento.PreguntaIDs) > 0 {
		var list []models.Pregunta
		h.DB.Where("id IN ?", intento.PreguntaIDs).Find(&list)
		byID := make(map[string]models.Pregunta, len(list))
		for _, p := range list {
			byID[p.ID] = p
		}
		for _, id := range intento.PreguntaIDs {
			if p, exists := byID[id]; exists {
				preguntasOut = append(preguntasOut, p)
			}
		}
	}

	h.notifySync(user.ID, "finished", intento.ID)
	writeJSON(w, http.StatusOK, map[string]any{
		"intento":   intento,
		"preguntas": preguntasOut,
	})
}

func (h *IntentoHandler) Destroy(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserFromContext(r.Context())
	intento, ok := h.findOwnedIntento(w, r, user.ID)
	if !ok {
		return
	}

	h.DB.Where("intento_id = ?", intento.ID).Delete(&models.Respuesta{})
	h.DB.Delete(&intento)
	h.notifySync(user.ID, "deleted", intento.ID)

	writeJSON(w, http.StatusOK, map[string]string{"message": "Intento eliminado."})
}

func (h *IntentoHandler) findOwnedIntento(w http.ResponseWriter, r *http.Request, userID uint64) (models.Intento, bool) {
	idStr := chi.URLParam(r, "intento")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		writeErr(w, http.StatusNotFound, "Intento no encontrado.")
		return models.Intento{}, false
	}

	var intento models.Intento
	if err := h.DB.First(&intento, id).Error; err != nil {
		writeErr(w, http.StatusNotFound, "Intento no encontrado.")
		return models.Intento{}, false
	}
	if intento.UserID != userID {
		writeErr(w, http.StatusForbidden, "No autorizado.")
		return models.Intento{}, false
	}
	return intento, true
}

func (h *IntentoHandler) recalcularIntento(intento *models.Intento) {
	var aciertos, errores int64
	h.DB.Model(&models.Respuesta{}).Where("intento_id = ? AND es_correcta = ?", intento.ID, true).Count(&aciertos)
	h.DB.Model(&models.Respuesta{}).Where("intento_id = ? AND es_correcta = ?", intento.ID, false).Count(&errores)
	total := intento.TotalPreguntas
	if total < 1 {
		total = 1
	}
	pct := int(math.Round(float64(aciertos) / float64(total) * 100))
	intento.Aciertos = int(aciertos)
	intento.Errores = int(errores)
	intento.Porcentaje = pct
	h.DB.Model(intento).Updates(map[string]any{
		"aciertos":   intento.Aciertos,
		"errores":    intento.Errores,
		"porcentaje": intento.Porcentaje,
	})
}
