# ============================================================
# EGEL Plus ISOFT — Single-Container Dockerfile (Coolify)
# Frontend (Bun + React + Vite) + Backend (Go + GORM + Chi)
# ============================================================

# --- Stage 1: Build Frontend con Bun ---
FROM oven/bun:1-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY frontend/ ./
RUN bun run build

# --- Stage 2: Build Backend en Go ---
FROM golang:1.27-alpine AS backend-builder
ENV GOTOOLCHAIN=auto
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /egel-server ./cmd/server

# --- Stage 3: Runtime Alpine mínimo ---
FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata wget
WORKDIR /app

COPY --from=backend-builder /egel-server /app/egel-server
COPY --from=frontend-builder /app/frontend/dist /app/dist
COPY contenido/ /app/contenido/
COPY biblioteca/ /app/biblioteca/

ENV PORT=80 \
    CONTENIDO_DIR=/app/contenido \
    BIBLIOTECA_DIR=/app/biblioteca \
    DIST_DIR=/app/dist

EXPOSE 80

CMD ["/app/egel-server"]
