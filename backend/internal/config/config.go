package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	Port          string
	DBHost        string
	DBPort        string
	DBDatabase    string
	DBUsername    string
	DBPassword    string
	ContenidoDir  string
	BibliotecaDir string
	DistDir       string
}

func Load() Config {
	loadDotEnv(".env")
	loadDotEnv("../.env")

	contenido := envOr("CONTENIDO_DIR", firstExisting("../contenido", "./contenido"))
	biblioteca := envOr("BIBLIOTECA_DIR", firstExisting("../biblioteca", "./biblioteca"))
	dist := envOr("DIST_DIR", firstExisting("../frontend/dist", "./frontend/dist", "./dist"))

	return Config{
		Port:          envOr("PORT", "8000"),
		DBHost:        envOr("DB_HOST", "127.0.0.1"),
		DBPort:        envOr("DB_PORT", "3306"),
		DBDatabase:    envOr("DB_DATABASE", "egelsoft"),
		DBUsername:    envOr("DB_USERNAME", "root"),
		DBPassword:    envOr("DB_PASSWORD", ""),
		ContenidoDir:  contenido,
		BibliotecaDir: biblioteca,
		DistDir:       dist,
	}
}

func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func firstExisting(paths ...string) string {
	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			if abs, err := filepath.Abs(p); err == nil {
				return abs
			}
			return p
		}
	}
	return paths[0]
}

func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.IndexByte(line, '=')
		if idx <= 0 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		val := strings.TrimSpace(line[idx+1:])
		if len(val) >= 2 && ((val[0] == '"' && val[len(val)-1] == '"') || (val[0] == '\'' && val[len(val)-1] == '\'')) {
			val = val[1 : len(val)-1]
		}
		if os.Getenv(key) == "" {
			_ = os.Setenv(key, val)
		}
	}
}
