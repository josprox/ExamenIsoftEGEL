# ============================================================
# EGEL Plus ISOFT — Single-Container Dockerfile (Coolify)
# Frontend (Bun + React + Vite) + Backend (PHP 8.4 + Laravel + Nginx)
# ============================================================

# --- Stage 1: Build Frontend con Bun ---
FROM oven/bun:1-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY frontend/ ./
RUN bun run build

# --- Stage 2: Composer Dependencies ---
FROM composer:2 AS backend-vendor
WORKDIR /app/backend
COPY backend/composer.json backend/composer.lock* ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts

# --- Stage 3: Runtime PHP-FPM + Nginx ---
FROM php:8.4-fpm-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
        nginx \
        libzip-dev \
        libonig-dev \
        libpng-dev \
        unzip \
        curl \
        wget \
    && docker-php-ext-install pdo_mysql mbstring bcmath opcache zip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

# Copiar contenido, biblioteca y backend
COPY contenido/ /var/www/html/contenido/
COPY biblioteca/ /var/www/html/biblioteca/
COPY backend/ /var/www/html/backend/
COPY --from=backend-vendor /app/backend/vendor /var/www/html/backend/vendor

# Copiar frontend compilado dentro de backend/public (index.html -> app.html para no pisar index.php)
COPY --from=frontend-builder /app/frontend/dist/assets /var/www/html/backend/public/assets
COPY --from=frontend-builder /app/frontend/dist/index.html /var/www/html/backend/public/app.html

# Configuración Nginx y Entrypoint
COPY docker/nginx.conf /etc/nginx/sites-available/default
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p /var/www/html/backend/storage/framework/sessions \
                /var/www/html/backend/storage/framework/views \
                /var/www/html/backend/storage/framework/cache \
                /var/www/html/backend/storage/logs \
                /var/www/html/backend/bootstrap/cache \
    && chown -R www-data:www-data /var/www/html/backend/storage /var/www/html/backend/bootstrap/cache

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
