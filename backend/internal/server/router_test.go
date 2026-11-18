package server_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/josprox/examen-isoft-egel/backend/internal/config"
	"github.com/josprox/examen-isoft-egel/backend/internal/content"
	"github.com/josprox/examen-isoft-egel/backend/internal/handlers"
	"github.com/josprox/examen-isoft-egel/backend/internal/models"
	"github.com/josprox/examen-isoft-egel/backend/internal/server"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupTestRouter(t *testing.T, web *handlers.WebSearchHandler) http.Handler {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("sqlite open: %v", err)
	}
	if sqlDB, err := db.DB(); err == nil {
		sqlDB.SetMaxOpenConns(1)
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.UserToken{},
		&models.Pregunta{},
		&models.Recurso{},
		&models.Intento{},
		&models.Respuesta{},
	); err != nil {
		t.Fatalf("automigrate: %v", err)
	}

	contenidoDir, _ := filepath.Abs(filepath.Join("..", "..", "..", "contenido"))
	bibliotecaDir, _ := filepath.Abs(filepath.Join("..", "..", "..", "biblioteca"))
	loader := content.NewLoader(contenidoDir)
	if _, _, err := loader.ImportarTodo(db); err != nil {
		t.Fatalf("importar todo: %v", err)
	}

	cfg := config.Config{
		ContenidoDir:  contenidoDir,
		BibliotecaDir: bibliotecaDir,
	}
	return server.NewRouter(db, cfg, loader, web)
}

func doReq(t *testing.T, h http.Handler, method, path, token string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatal(err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}

func registerUser(t *testing.T, h http.Handler, name, email string) string {
	t.Helper()
	rr := doReq(t, h, http.MethodPost, "/api/auth/register", "", map[string]string{
		"name":                  name,
		"email":                 email,
		"password":              "secret123",
		"password_confirmation": "secret123",
	})
	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201 on register, got %d: %s", rr.Code, rr.Body.String())
	}
	var res map[string]any
	_ = json.Unmarshal(rr.Body.Bytes(), &res)
	tok, _ := res["token"].(string)
	return tok
}

func TestAuthAndProtectedRoutes(t *testing.T) {
	h := setupTestRouter(t, nil)

	if rr := doReq(t, h, http.MethodGet, "/api/preguntas?area=A1", "", nil); rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without token, got %d", rr.Code)
	}

	token := registerUser(t, h, "Ana", "ana@example.com")

	if rr := doReq(t, h, http.MethodGet, "/api/auth/me", token, nil); rr.Code != http.StatusOK {
		t.Fatalf("expected 200 on /me, got %d", rr.Code)
	}

	if rr := doReq(t, h, http.MethodGet, "/api/preguntas?preset=egel_completo", token, nil); rr.Code != http.StatusOK {
		t.Fatalf("expected 200 on egel_completo, got %d: %s", rr.Code, rr.Body.String())
	} else {
		var out map[string]any
		_ = json.Unmarshal(rr.Body.Bytes(), &out)
		if int(out["total"].(float64)) != 203 {
			t.Fatalf("expected 203 questions in egel_completo, got %v", out["total"])
		}
	}
}

func TestCatalogosYBuscarSinFuga(t *testing.T) {
	h := setupTestRouter(t, nil)

	for _, ep := range []string{"/api/temario", "/api/biblioteca", "/api/guias", "/api/comandos"} {
		if rr := doReq(t, h, http.MethodGet, ep, "", nil); rr.Code != http.StatusOK {
			t.Fatalf("expected 200 on %s, got %d", ep, rr.Code)
		}
	}

	rr := doReq(t, h, http.MethodGet, "/api/buscar?q=ISO", "", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 on /api/buscar, got %d", rr.Code)
	}
	var res map[string]any
	_ = json.Unmarshal(rr.Body.Bytes(), &res)
	pregs, _ := res["preguntas"].([]any)
	if len(pregs) > 0 {
		first := pregs[0].(map[string]any)
		if _, has := first["correcta"]; has {
			t.Fatalf("public search must not expose correcta")
		}
	}
}

func TestIntentoFlujoCompletoYExamenOculto(t *testing.T) {
	h := setupTestRouter(t, nil)
	token := registerUser(t, h, "Carlos", "carlos@example.com")

	pregRes := doReq(t, h, http.MethodGet, "/api/preguntas?area=A1&limit=2&ocultar_respuestas=1", token, nil)
	if pregRes.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", pregRes.Code)
	}
	var pregOut map[string]any
	_ = json.Unmarshal(pregRes.Body.Bytes(), &pregOut)
	list := pregOut["preguntas"].([]any)
	if len(list) != 2 {
		t.Fatalf("expected 2 preguntas, got %d", len(list))
	}
	p0 := list[0].(map[string]any)
	if _, has := p0["correcta"]; has {
		t.Fatalf("ocultar_respuestas=1 should strip correcta")
	}
	ids := []string{p0["id"].(string), list[1].(map[string]any)["id"].(string)}

	createRes := doReq(t, h, http.MethodPost, "/api/intentos", token, map[string]any{
		"modo":            "examen",
		"area_filtro":     "A1",
		"total_preguntas": 2,
		"pregunta_ids":    ids,
	})
	if createRes.Code != http.StatusCreated {
		t.Fatalf("expected 201 on store, got %d: %s", createRes.Code, createRes.Body.String())
	}
	var createOut map[string]any
	_ = json.Unmarshal(createRes.Body.Bytes(), &createOut)
	intentoID := int(createOut["intento"].(map[string]any)["id"].(float64))

	respRes := doReq(t, h, http.MethodPost, "/api/intentos/"+itoa(intentoID)+"/respuestas", token, map[string]any{
		"pregunta_id":  ids[0],
		"seleccionada": 0,
	})
	if respRes.Code != http.StatusOK {
		t.Fatalf("expected 200 on respuesta, got %d: %s", respRes.Code, respRes.Body.String())
	}

	showRes := doReq(t, h, http.MethodGet, "/api/intentos/"+itoa(intentoID), token, nil)
	if showRes.Code != http.StatusOK {
		t.Fatalf("expected 200 on show, got %d", showRes.Code)
	}

	finRes := doReq(t, h, http.MethodPost, "/api/intentos/"+itoa(intentoID)+"/finalizar", token, map[string]any{
		"duracion_segundos": 95,
	})
	if finRes.Code != http.StatusOK {
		t.Fatalf("expected 200 on finalizar, got %d: %s", finRes.Code, finRes.Body.String())
	}
	var finOut map[string]any
	_ = json.Unmarshal(finRes.Body.Bytes(), &finOut)
	finPregs := finOut["preguntas"].([]any)
	if _, has := finPregs[0].(map[string]any)["correcta"]; !has {
		t.Fatalf("finalizar should return full preguntas with correcta")
	}

	// Verificar eliminar intento
	delRes := doReq(t, h, http.MethodDelete, "/api/intentos/"+itoa(intentoID), token, nil)
	if delRes.Code != http.StatusOK {
		t.Fatalf("expected 200 on delete, got %d", delRes.Code)
	}
	histRes := doReq(t, h, http.MethodGet, "/api/intentos", token, nil)
	var histOut map[string]any
	_ = json.Unmarshal(histRes.Body.Bytes(), &histOut)
	if len(histOut["intentos"].([]any)) != 0 {
		t.Fatalf("expected 0 intentos after delete")
	}
}

func TestBuscarWebConMock(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"query":{"pages":{"1":{"index":1,"title":"Scrum","extract":"Marco ágil","fullurl":"https://es.wikipedia.org/wiki/Scrum"}}}}`))
	}))
	defer srv.Close()

	webH := handlers.NewWebSearchHandler()
	webH.Endpoints = handlers.WebEndpoints{WikiES: srv.URL}

	h := setupTestRouter(t, webH)
	rr := doReq(t, h, http.MethodGet, "/api/buscar-web?q=Scrum&fuente=wikipedia", "", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var out map[string]any
	_ = json.Unmarshal(rr.Body.Bytes(), &out)
	conceptos := out["conceptos"].([]any)
	if len(conceptos) != 1 {
		t.Fatalf("expected 1 concepto, got %d", len(conceptos))
	}
}

func itoa(n int) string {
	b := make([]byte, 0, 12)
	if n == 0 {
		return "0"
	}
	for n > 0 {
		b = append(b, byte('0'+n%10))
		n /= 10
	}
	for i, j := 0, len(b)-1; i < j; i, j = i+1, j-1 {
		b[i], b[j] = b[j], b[i]
	}
	return string(b)
}
