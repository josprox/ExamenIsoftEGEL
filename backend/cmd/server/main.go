package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/josprox/examen-isoft-egel/backend/internal/config"
	"github.com/josprox/examen-isoft-egel/backend/internal/content"
	"github.com/josprox/examen-isoft-egel/backend/internal/models"
	"github.com/josprox/examen-isoft-egel/backend/internal/server"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	importOnly := flag.Bool("import", false, "Solo sincronizar contenido/ hacia MySQL y salir")
	flag.Parse()

	cfg := config.Load()

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.DBUsername,
		cfg.DBPassword,
		cfg.DBHost,
		cfg.DBPort,
		cfg.DBDatabase,
	)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Error),
	})
	if err != nil {
		log.Fatalf("[egel-go] Error conectando a MySQL (%s:%s/%s): %v", cfg.DBHost, cfg.DBPort, cfg.DBDatabase, err)
	}

	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxOpenConns(25)
		sqlDB.SetMaxIdleConns(10)
		sqlDB.SetConnMaxLifetime(30 * time.Minute)
	}

	if err := db.AutoMigrate(
		&models.User{},
		&models.UserToken{},
		&models.Pregunta{},
		&models.Recurso{},
		&models.Intento{},
		&models.Respuesta{},
	); err != nil {
		log.Fatalf("[egel-go] Error en AutoMigrate: %v", err)
	}

	loader := content.NewLoader(cfg.ContenidoDir)
	pCount, rCount, err := loader.ImportarTodo(db)
	if err != nil {
		log.Printf("[egel-go] Aviso al sincronizar contenido: %v", err)
	} else {
		log.Printf("[egel-go] Sincronizado contenido/: %d preguntas, %d recursos", pCount, rCount)
	}

	if *importOnly {
		return
	}

	router := server.NewRouter(db, cfg, loader, nil)
	addr := ":" + cfg.Port
	log.Printf("[egel-go] Servidor Go escuchando en http://0.0.0.0%s", addr)

	srv := &http.Server{
		Addr:              addr,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[egel-go] Error en servidor HTTP: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("[egel-go] Señal de apagado recibida, cerrando servidor...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("[egel-go] Error en cierre limpio HTTP: %v", err)
	}
	if sqlDB, err := db.DB(); err == nil {
		_ = sqlDB.Close()
	}
}
