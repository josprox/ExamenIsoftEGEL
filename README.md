# EGEL Plus ISOFT · Práctica, Guías y Biblioteca

Plataforma web abierta para practicar el **EGEL Plus de Ingeniería de Software (Ceneval)**, con retroalimentación inmediata desde la primera pregunta, guías por subárea, chuletario de comandos y biblioteca de documentos.

- **Pruébalo en línea:** [https://egelsoft.astriom.org](https://egelsoft.astriom.org)
- **Repositorio oficial:** [https://github.com/josprox/ExamenIsoftEGEL](https://github.com/josprox/ExamenIsoftEGEL)

El contenido se organiza con base en la [Guía para el sustentante de julio de 2026](biblioteca/general/guia-sustentante-egel-plus-isoft-julio-2026.pdf). Las preguntas son originales de práctica; no son reactivos oficiales.

## Estructura de la guía

El examen tiene **203 reactivos** en dos sesiones: **143** de la sección disciplinar y **60** de Lenguaje y Comunicación. Cada reactivo tiene tres opciones y 15 % son piloto. El simulador completo selecciona 203 preguntas por módulos con esos cupos y deja fuera el banco `reto`.

| Área | Reactivos | Distribución |
| --- | ---: | --- |
| Análisis de Sistemas de Software | 31 | 1.1: 12 · 1.2: 9 · 1.3: 10 |
| Diseño de Sistemas de Software | 33 | 2.1: 10 · 2.2: 16 · 2.3: 7 |
| Desarrollo de Sistemas de Software | 49 | 3.1: 10 · 3.2: 10 · 3.3: 10 · 3.4: 9 · 3.5: 10 |
| Gestión de Proyectos de Software | 30 | 4.1: 8 · 4.2: 10 · 4.3: 12 |
| Comprensión lectora | 30 | Estudio: 12 · Literario: 12 · Participación social: 6 |
| Redacción indirecta | 30 | Estudio: 15 · Participación social: 15 |

En Lenguaje y Comunicación, los procesos de lectura y las dimensiones de redacción se trabajan **dentro** de cada ámbito. La guía no fija un número de preguntas para cada proceso o dimensión.

La aplicación muestra aciertos y porcentajes de práctica. No convierte esos porcentajes a ICNE ni asigna un nivel oficial, pues Ceneval determina la calificación con su propio proceso.

## Iniciar el proyecto en local

Requiere **PHP 8.3+**, **Composer**, **Bun** (o Node.js) y **MySQL** (o SQLite para pruebas locales). Configura `backend/.env` con `DB_CONNECTION` y tus credenciales. Después:

```bash
cd backend
composer install
php artisan key:generate
php artisan migrate
php artisan egel:importar
php artisan serve
```

En otra terminal, para el frontend:

```bash
cd frontend
bun install
bun dev
```

Abre `http://localhost:5173`. Vite envía las solicitudes `/api` y `/biblioteca-files` a Laravel en `http://127.0.0.1:8000`. Después de editar bancos o recursos, vuelve a ejecutar `php artisan egel:importar` dentro de `backend` para actualizar la base de datos.

## Despliegue en Coolify / Docker

El repositorio incluye un [Dockerfile](Dockerfile) multi-etapa (compila `frontend/` con Bun e instala `backend/` con PHP 8.4-FPM + Nginx) y [entrypoint.sh](entrypoint.sh) que ejecuta `migrate --force` y `egel:importar` al iniciar el contenedor en el puerto `80`.

Variables recomendadas en Coolify:

```env
APP_NAME="EGEL Plus ISOFT"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://egelsoft.astriom.org
APP_KEY=base64:TU_CLAVE_DE_LARAVEL

DB_CONNECTION=mysql
DB_HOST=10.0.0.101
DB_PORT=3306
DB_DATABASE=egelsoft
DB_USERNAME=josprox
DB_PASSWORD=TU_PASSWORD
```

## Organización

| Ruta | Función |
| --- | --- |
| `frontend/` | Interfaz React + TypeScript + Tailwind + Bun |
| `backend/` | API Laravel, autenticación opcional, progreso y MySQL |
| `contenido/` | Temario, bancos de preguntas, guías, recursos y comandos |
| `biblioteca/` | Documentos de consulta y PDFs organizados por área |
| `scripts/validar.mjs` | Validación del contenido y referencias |
| `Dockerfile`, `entrypoint.sh`, `docker/` | Empaquetado único para Coolify |

El banco contiene **268 preguntas**: 72 base, 131 extendidas, 20 de refuerzo y 45 de reto. El simulacro de 203 usa los tres primeros bancos. Para contribuir, consulta [CONTRIBUTING.md](CONTRIBUTING.md) y ejecuta `node scripts/validar.mjs`.

Este proyecto no está afiliado con Ceneval. EGEL y EGEL Plus son marcas de Ceneval, A.C.
