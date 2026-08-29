# Media Cataloger Web (`media_cataloger_web`)

Modern, high-performance Web UI Dashboard, Interactive Family Tree Explorer, Media Viewer, Face Tagging Suite, and REST API server for the Media Archive Cataloger system.

---

## 🏛 System Overview

`media_cataloger_web` is designed as the client and media management tier (Machine A) in a decoupled multi-machine architecture:

```
+-------------------------------------------------------+                 REST / HTTP (JSON)                +-------------------------------------------------------+
|                 media_cataloger_web                   | ------------------------------------------------> |                    media_cataloger                    |
|           Frontend & Media Library Service            |              CATALOGER_API_URL=:8001              |                Media Cataloger AI Service             |
|                                                       | <------------------------------------------------ |                                                       |
|  * React 19 SPA (Gallery, Family Tree, Face Tagging)  |               Status, Logs, Triggers              |  * Python 3.10 + OpenCV + FFmpeg Engine               |
|  * NestJS High-Speed REST Server (:8000)              |                                                   |  * InsightFace + Gemini / Local LLM / Whisper AI      |
|  * Local or Shared Media Storage & SQLite Database    |                                                   |  * FastAPI Remote Control & Pipeline Worker (:8001)   |
|  * Docker Image: media_cataloger_web                  |                                                   |  * Docker Image: media_cataloger                      |
+-------------------------------------------------------+                                                   +-------------------------------------------------------+
```

### ✨ Key Features:
- **Interactive Family Tree Explorer**: Powered by ELK (Eclipse Layout Kernel) layered graph algorithms with kinship calculation, life events, partner unions, and ancestor/descendant navigation.
- **Rich Media Viewer & Gallery**: Instant photo viewing, full video streaming, EXIF timeline, AI semantic descriptions (English/Russian), and face highlights.
- **Face Recognition & Tagging**: Face crop viewer, person naming, manual face pinning, unrecognized face clustering.
- **Settings & Remote AI Control**: Manage folders, switch between Cloud (Gemini) and Local LLM (LM Studio / Ollama), trigger media scans, pause/resume/cancel pipeline, and view live real-time logs from the AI engine.
- **Multi-language Support**: Full English and Russian localization.
- **Theme Customization**: Sleek modern glassmorphism design with preset themes and custom color accents.

---

## 🚀 Quick Start with Docker

```bash
# 1. Clone repository
git clone https://github.com/rokhlin/media_cataloger_web.git
cd media_cataloger_web

# 2. Configure environment
cp .env.example .env

# Set CATALOGER_API_URL to point to your AI engine (Machine B), e.g.:
# CATALOGER_API_URL=http://192.168.1.50:8001

# 3. Launch container on port 8000
docker compose up -d
```

Open `http://localhost:8000` in your browser!

---

## 🛠 Local Development

### Prerequisites:
- Node.js 20+ (Node.js 22 recommended)
- npm 10+

### Install Dependencies:
```bash
npm install
```

### Available Scripts:
| Command | Description |
| :--- | :--- |
| `npm run dev` | Launch Vite frontend dev server with hot-reload |
| `npm run server:dev` | Launch NestJS backend server with TypeScript auto-reload (`tsx watch`) |
| `npm run build` | Build production React 19 SPA bundle |
| `npm run server:build` | Compile NestJS server to `dist-server/` |
| `npm run start` | Run compiled production server (`node dist-server/main.js`) |
| `npm test` | Run complete unit and integration test suite |
| `npm run test:server` | Run server tests (NestJS controllers, services, kinship engine) |
| `npm run test:client` | Run client tests (React components, layout engine, i18n) |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run Oxlint fast linter |

---

## ⚙️ Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8000` | HTTP port for the web application and REST API |
| `CATALOGER_API_URL` | `http://localhost:8001` | URL of the `media_cataloger` Python AI Engine |
| `MEDIA_INPUT` | `./media_input` | Path to media directory containing source photos & videos |
| `MEDIA_OUTPUT` | `./media_output` | Path to output directory containing catalog DB & face crops |
| `CONFIG_PATH` | `./data/config` | Directory storing persistent configuration and `settings.json` |
| `FAMILY_TREE_DB_PATH` | `./media_output/family_tree.db` | Explicit SQLite database path for family tree |

---

## 📦 Docker Container Images

Multi-architecture images (`linux/amd64`, `linux/arm64`) are automatically published to GitHub Container Registry:
- **Web UI & Server**: `ghcr.io/rokhlin/media_cataloger_web:latest`

Compatible with **Docker Compose**, **ZimaOS**, **CasaOS**, and standalone Docker hosts.
