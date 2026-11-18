package server

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/josprox/examen-isoft-egel/backend/internal/config"
	"github.com/josprox/examen-isoft-egel/backend/internal/content"
	"github.com/josprox/examen-isoft-egel/backend/internal/handlers"
	"github.com/josprox/examen-isoft-egel/backend/internal/middleware"
	"gorm.io/gorm"
)

func NewRouter(db *gorm.DB, cfg config.Config, loader *content.Loader, webHandler *handlers.WebSearchHandler) http.Handler {
	r := chi.NewRouter()
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(chimw.Compress(5))

	authH := &handlers.AuthHandler{DB: db}
	egelH := &handlers.EgelHandler{DB: db, Loader: loader}
	intentoH := &handlers.IntentoHandler{DB: db, Loader: loader}
	if webHandler == nil {
		webHandler = handlers.NewWebSearchHandler()
	}

	r.Get("/up", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	r.Route("/api", func(api chi.Router) {
		// Autenticación
		api.Route("/auth", func(auth chi.Router) {
			auth.With(middleware.RateLimit(15, 10)).Post("/register", authH.Register)
			auth.With(middleware.RateLimit(15, 10)).Post("/login", authH.Login)

			auth.Group(func(priv chi.Router) {
				priv.Use(middleware.AuthenticateToken(db))
				priv.Get("/me", authH.Me)
				priv.Post("/logout", authH.Logout)
			})
		})

		// Catálogos públicos
		api.Get("/temario", egelH.Temario)
		api.Get("/biblioteca", egelH.Biblioteca)
		api.Get("/guias", egelH.Guias)
		api.Get("/comandos", egelH.Comandos)
		api.Get("/buscar", egelH.Buscar)
		api.With(middleware.RateLimit(120, 40)).Get("/buscar-web", webHandler.BuscarWeb)

		// Simulador, progreso e intentos (requiere login)
		api.Group(func(priv chi.Router) {
			priv.Use(middleware.AuthenticateToken(db))
			priv.Get("/preguntas", egelH.Preguntas)
			priv.Get("/intentos", intentoH.Index)
			priv.Post("/intentos", intentoH.Store)
			priv.Get("/intentos/{intento}", intentoH.Show)
			priv.Post("/intentos/{intento}/respuestas", intentoH.GuardarRespuesta)
			priv.Post("/intentos/{intento}/finalizar", intentoH.Finalizar)
			priv.Delete("/intentos/{intento}", intentoH.Destroy)
		})
	})

	// Servir documentos de biblioteca de forma segura
	r.Get("/biblioteca-files/*", func(w http.ResponseWriter, r *http.Request) {
		baseAbs, err := filepath.Abs(cfg.BibliotecaDir)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		rel := chi.URLParam(r, "*")
		rel = filepath.FromSlash(rel)
		target := filepath.Clean(filepath.Join(baseAbs, rel))
		if !strings.HasPrefix(target, baseAbs+string(filepath.Separator)) {
			http.NotFound(w, r)
			return
		}
		info, err := os.Stat(target)
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, target)
	})

	// SPA React en producción o estado de API en desarrollo
	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"message":"Ruta no encontrada."}`))
			return
		}

		if cfg.DistDir != "" {
			clean := filepath.Clean(filepath.FromSlash(r.URL.Path))
			candidate := filepath.Join(cfg.DistDir, clean)
			if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
				if strings.HasPrefix(r.URL.Path, "/assets/") {
					w.Header().Set("Cache-Control", "public, max-age=2592000, immutable")
				}
				http.ServeFile(w, r, candidate)
				return
			}
			indexHTML := filepath.Join(cfg.DistDir, "index.html")
			if _, err := os.Stat(indexHTML); err == nil {
				http.ServeFile(w, r, indexHTML)
				return
			}
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"app":"EGEL Plus ISOFT API (Go)","status":"ok"}`))
	})

	return r
}
