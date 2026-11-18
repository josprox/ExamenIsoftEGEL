package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/josprox/examen-isoft-egel/backend/internal/middleware"
	"github.com/josprox/examen-isoft-egel/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthHandler struct {
	DB *gorm.DB
}

type registerReq struct {
	Name                 string `json:"name"`
	Email                string `json:"email"`
	Password             string `json:"password"`
	PasswordConfirmation string `json:"password_confirmation"`
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusUnprocessableEntity, "Datos inválidos.")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if req.Name == "" || len(req.Name) > 120 {
		writeErr(w, http.StatusUnprocessableEntity, "El nombre es obligatorio (máx. 120 caracteres).")
		return
	}
	if _, err := mail.ParseAddress(req.Email); err != nil || len(req.Email) > 255 {
		writeErr(w, http.StatusUnprocessableEntity, "Ingresa un correo electrónico válido.")
		return
	}
	if len(req.Password) < 6 {
		writeErr(w, http.StatusUnprocessableEntity, "La contraseña debe tener al menos 6 caracteres.")
		return
	}
	if req.Password != req.PasswordConfirmation {
		writeErr(w, http.StatusUnprocessableEntity, "Las contraseñas no coinciden.")
		return
	}

	var existing int64
	h.DB.Model(&models.User{}).Where("email = ?", req.Email).Count(&existing)
	if existing > 0 {
		writeErr(w, http.StatusUnprocessableEntity, "Este correo ya está registrado.")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "No se pudo procesar la contraseña.")
		return
	}

	user := models.User{
		Name:     req.Name,
		Email:    req.Email,
		Password: string(hash),
	}
	if err := h.DB.Create(&user).Error; err != nil {
		writeErr(w, http.StatusInternalServerError, "No se pudo crear el usuario.")
		return
	}

	plainToken, err := createTokenForUser(h.DB, user.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "No se pudo generar el token.")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"user":  user,
		"token": plainToken,
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusUnprocessableEntity, "Datos inválidos.")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		writeErr(w, http.StatusUnprocessableEntity, "Correo y contraseña requeridos.")
		return
	}

	var user models.User
	if err := h.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		writeErr(w, http.StatusUnprocessableEntity, "Correo o contraseña incorrectos.")
		return
	}

	// bcrypt.CompareHashAndPassword soporta $2a$, $2b$ y $2y$ de PHP/Laravel
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		writeErr(w, http.StatusUnprocessableEntity, "Correo o contraseña incorrectos.")
		return
	}

	plainToken, err := createTokenForUser(h.DB, user.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "No se pudo generar el token.")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"user":  user,
		"token": plainToken,
	})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeErr(w, http.StatusUnauthorized, "No autenticado.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if tokenID, ok := middleware.TokenIDFromContext(r.Context()); ok {
		h.DB.Delete(&models.UserToken{}, tokenID)
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Sesión cerrada correctamente."})
}

func createTokenForUser(db *gorm.DB, userID uint64) (string, error) {
	buf := make([]byte, 30)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	plain := hex.EncodeToString(buf)
	sum := sha256.Sum256([]byte(plain))
	hashed := hex.EncodeToString(sum[:])

	exp := time.Now().Add(30 * 24 * time.Hour)
	rec := models.UserToken{
		UserID:    userID,
		Token:     hashed,
		ExpiresAt: &exp,
	}
	if err := db.Create(&rec).Error; err != nil {
		return "", err
	}
	return plain, nil
}
