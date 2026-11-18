package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/josprox/examen-isoft-egel/backend/internal/middleware"
	"github.com/josprox/examen-isoft-egel/backend/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SubrayadoHandler struct {
	DB  *gorm.DB
	Hub *WSHub
}

func (h *SubrayadoHandler) Index(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserFromContext(r.Context())
	rawIDs := strings.TrimSpace(r.URL.Query().Get("ids"))

	q := h.DB.Where("user_id = ?", user.ID)
	if rawIDs != "" {
		parts := strings.Split(rawIDs, ",")
		ids := make([]string, 0, len(parts))
		for _, p := range parts {
			if s := strings.TrimSpace(p); s != "" {
				ids = append(ids, s)
			}
		}
		if len(ids) > 0 {
			q = q.Where("pregunta_id IN ?", ids)
		}
	}

	var rows []models.PreguntaSubrayado
	q.Find(&rows)

	out := make(map[string]map[string][]models.HighlightRange, len(rows))
	for _, row := range rows {
		if len(row.Subrayados) > 0 {
			out[row.PreguntaID] = row.Subrayados
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"subrayados": out})
}

func (h *SubrayadoHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserFromContext(r.Context())
	preguntaID := strings.TrimSpace(chi.URLParam(r, "pregunta"))
	if preguntaID == "" {
		writeErr(w, http.StatusBadRequest, "ID de pregunta requerido.")
		return
	}

	var req struct {
		Subrayados map[string][]models.HighlightRange `json:"subrayados"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusUnprocessableEntity, "Formato de subrayados inválido.")
		return
	}

	cleaned := make(map[string][]models.HighlightRange)
	for field, list := range req.Subrayados {
		if len(list) > 0 {
			cleaned[field] = list
		}
	}

	if len(cleaned) == 0 {
		h.DB.Where("user_id = ? AND pregunta_id = ?", user.ID, preguntaID).Delete(&models.PreguntaSubrayado{})
	} else {
		rec := models.PreguntaSubrayado{
			UserID:     user.ID,
			PreguntaID: preguntaID,
			Subrayados: cleaned,
		}
		if err := h.DB.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "pregunta_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"subrayados", "updated_at"}),
		}).Create(&rec).Error; err != nil {
			writeErr(w, http.StatusInternalServerError, "No se pudieron guardar los subrayados.")
			return
		}
	}

	if h.Hub != nil {
		h.Hub.BroadcastUser(user.ID, map[string]any{
			"type":        "subrayado_sync",
			"pregunta_id": preguntaID,
			"subrayados":  cleaned,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"pregunta_id": preguntaID,
		"subrayados":  cleaned,
	})
}
