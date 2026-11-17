#!/bin/sh
set -e

cd /var/www/html/backend

# Si no viene APP_KEY en variables de entorno de Coolify, generamos una para evitar fallo 500
if [ -z "${APP_KEY}" ]; then
    echo "[entrypoint] APP_KEY no definida, generando clave temporal..."
    export APP_KEY="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
fi

mkdir -p storage/framework/sessions storage/framework/views storage/framework/cache storage/logs bootstrap/cache

echo "[entrypoint] Limpiando y cacheando configuración Laravel..."
php artisan config:clear
php artisan route:clear
php artisan config:cache

echo "[entrypoint] Ejecutando migraciones en MySQL (${DB_HOST:-127.0.0.1}:${DB_PORT:-3306}/${DB_DATABASE:-egelsoft})..."
php artisan migrate --force

echo "[entrypoint] Sincronizando banco de preguntas y biblioteca..."
php artisan egel:importar

# Asegurar permisos para www-data DESPUÉS de correr artisan como root
chown -R www-data:www-data storage bootstrap/cache

echo "[entrypoint] Iniciando PHP-FPM y Nginx en puerto 80..."
php-fpm -D
exec nginx -g "daemon off;"
