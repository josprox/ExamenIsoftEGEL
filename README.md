# EGEL Plus ISOFT · Práctica, Guías y Biblioteca

Plataforma multiplataforma (Web, Android e iOS) para practicar el **EGEL Plus de Ingeniería de Software (Ceneval)**, con retroalimentación inmediata desde la primera pregunta, método de subrayado **DCPDV** persistente en base de datos, guías por subárea, chuletario de comandos y biblioteca integrada con 12 fuentes abiertas.

- **Pruébalo en línea:** [https://egelsoft.astriom.org](https://egelsoft.astriom.org)
- **Repositorio oficial:** [https://github.com/josprox/ExamenIsoftEGEL](https://github.com/josprox/ExamenIsoftEGEL)

El contenido se organiza con base en la [Guía para el sustentante de julio de 2026](biblioteca/general/guia-sustentante-egel-plus-isoft-julio-2026.pdf). Las preguntas son originales de práctica; no son reactivos oficiales.

---

## Características principales

- **Simulador EGEL Plus (203 reactivos o práctica por área/subárea):**
  - Módulos por área, mapa de preguntas colapsable, modo Estudio (con retroalimentación inmediata) y Examen Real.
  - **Subrayado estratégico DCPDV** (ámbar, esmeralda y rosa) sincronizado en base de datos y tiempo real.
  - Estado de simulación pausada respaldado en base de datos y **WebSockets (`/api/ws`)**.
- **Guías de estudio y Chuletario de Comandos:**
  - Resúmenes técnicos por subárea, normas ISO (25010, 9001, 27000) y **147 comandos** en 11 ramas listos para copiar.
- **Biblioteca y Explorador Web (159 recursos locales + 12 fuentes abiertas):**
  - Buscador unificado (`Ctrl+K` o pestaña Biblioteca) con streaming por WebSocket sobre Wikipedia, Wikidata, MDN Web Docs, GitHub, Stack Overflow, Hacker News, Reddit, Semantic Scholar, OpenAlex, Open Library, Crossref y arXiv.
  - **Visor integrado:** lector de PDFs locales, extracción limpia vía API oficial para **Wikipedia** y **Wikidata**, renderizado Markdown de `README.md` para **GitHub** y reproductor integrado para videos de **YouTube**, **Vimeo** y archivos directos.
- **Perfil, Progreso y Tema:**
  - Estadísticas por área/subárea, actualización de perfil y selector de tema (**Sistema**, **Claro** y **Oscuro** con detección automática en vivo).

---

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

---

## Iniciar el proyecto en local

Requiere **Go 1.23+** (con soporte de toolchain), **Node.js 18+** / **Bun** y **MySQL / MariaDB**.

### 1. Backend (Go + GORM + Chi)

Copia `backend/.env.example` a `backend/.env` y configura tus credenciales de MySQL:

```bash
cd backend
cp .env.example .env
go run ./cmd/server
```

El servidor arranca en `http://localhost:8000`, ejecuta `AutoMigrate` de las tablas en MySQL y carga automáticamente `contenido/` y `biblioteca/`.

### 2. Frontend (Expo + React Native Web + NativeWind)

En otra terminal:

```bash
cd frontend
npm install
npm run web
```

Abre `http://localhost:8081`. En desarrollo web, `api.ts` redirige automáticamente las llamadas al backend local en `http://localhost:8000`.

### 3. Probar en celular (Expo Go)

```bash
cd frontend
npm start
```

Escanea el QR con **Expo Go** (Android o iOS). Por defecto la app móvil apunta a `https://egelsoft.astriom.org`; si deseas apuntar a tu backend Go local en la misma red Wi-Fi, inicia con:

```powershell
$env:EXPO_PUBLIC_API_URL="http://TU_IP_LOCAL:8000"
npm start
```

---

## Despliegue en Coolify / Docker

El repositorio incluye un [Dockerfile](Dockerfile) multi-etapa de un solo contenedor:
1. Compila `frontend/` (`expo export -p web` → `/app/dist`) con `oven/bun:1-alpine`.
2. Compila `backend/` (`./cmd/server` → `/app/egel-server`) con `golang:1.27-alpine`.
3. Ejecuta todo en `alpine:3.21` exponiendo el puerto **`80`** (`API`, `WebSocket /api/ws`, `dist/` y `biblioteca/`).

Configuración recomendada en Coolify:
- **Build Pack:** `Dockerfile`
- **Ports Exposes:** `80`
- **Domains:** `https://egelsoft.astriom.org`
- **Environment Variables:**

```env
DB_HOST=TU_HOST_MYSQL
DB_PORT=3306
DB_DATABASE=egelsoft
DB_USERNAME=TU_USUARIO
DB_PASSWORD=TU_PASSWORD
```

*(Las variables `PORT=80`, `CONTENIDO_DIR=/app/contenido`, `BIBLIOTECA_DIR=/app/biblioteca` y `DIST_DIR=/app/dist` ya están definidas en el `Dockerfile`.)*

---

## Organización

| Ruta | Función |
| --- | --- |
| `frontend/` | App Expo (Web + Android + iOS) con React Native, NativeWind v4 y TypeScript |
| `backend/` | API REST y WebSocket en Go (Chi + GORM + MySQL) |
| `contenido/` | Temario, bancos de preguntas, guías Markdown, recursos y comandos |
| `biblioteca/` | Documentos de consulta y PDFs organizados por área |
| `scripts/validar.mjs` | Validación de integridad de bancos, guías y recursos |
| `Dockerfile` | Empaquetado único para producción / Coolify |

El banco contiene **382 preguntas** (`base`: 72, `extendido`: 131, `refuerzo`: 20, `ampliacion`: 114, `reto`: 45), **147 comandos** en 11 ramas y **159 recursos** catalogados. Para contribuir, consulta [CONTRIBUTING.md](CONTRIBUTING.md) y ejecuta:

```bash
npm run test
```

Este proyecto no está afiliado con Ceneval. EGEL y EGEL Plus son marcas de Ceneval, A.C.
