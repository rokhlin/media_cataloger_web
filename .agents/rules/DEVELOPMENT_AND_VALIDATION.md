# Development, Architecture & Validation Guide

This guide establishes the architecture, workflow rules, multi-environment run configurations, and validation procedures for **`media_cataloger_web`** and its integration with the separated **`media_cataloger` (AI Engine)**.

---

## 1. System Architecture & Separation of Concerns

```
+-------------------------------------------------------------------------+
|                           media_cataloger_web                           |
|                      (Client & Media Library Host)                      |
|                                                                         |
|  * React 19 SPA (Dashboard, Media Viewer, Family Tree, Face Tagging)    |
|  * NestJS Backend Server (Port 8000)                                    |
|  * Single Source of Truth for Paths & Runtime Configuration             |
|  * Manages SQLite databases (family_tree.db, read-only catalog_history) |
|  * Streams media files via `/api/media/file`                            |
+-------------------------------------------------------------------------+
                                    │
                                    │ HTTP REST (JSON)
                                    │ Endpoint: CATALOGER_API_URL (:8001)
                                    ▼
+-------------------------------------------------------------------------+
|                            media_cataloger                              |
|                          (Python AI Engine)                             |
|          Location: C:\Users\rokhl\.gemini\antigravity\scratch\media_cataloger |
|                                                                         |
|  * FastAPI Service Worker (Port 8001)                                   |
|  * AI Inference: InsightFace, Gemini / Local LLMs, Whisper ASR          |
|  * Media Metadata Extraction & Embedding Generation                     |
|  * Writes to: catalog_history.db, face crops, cataloger_run.log         |
+-------------------------------------------------------------------------+
```

### Core Responsibilities
1. **AI Logic Isolation**:
   - All computer vision, face embedding/clustering algorithms, transcription, and LLM prompting remain strictly on the `media_cataloger` side.
   - `media_cataloger_web` manages the user experience, family tree graph modeling (ELK layout), face assignment/tagging database updates, configuration persistence, and proxying/triggering AI operations.
2. **Paths Management (Source of Truth)**:
   - `media_cataloger_web` is responsible for specifying and managing:
     - **Input Folders**: Directory paths for source photos and videos.
     - **Output Folder**: Directory where `catalog_history.db`, face crops (`faces/` or `facess/`), and `family_tree.db` are stored.
   - `media_cataloger_web` sends resolved file lists, metadata, `output_folder`, and runtime settings directly in the payload when calling `media_cataloger` (`/api/run`, `/api/analyze-file`).

---

## 2. Deployment & Execution Topologies

The system must support and seamlessly handle all of the following deployment configurations:

| Run Configuration | `media_cataloger_web` | `media_cataloger` | Path Handling & Media Streaming |
| :--- | :--- | :--- | :--- |
| **Topology 1: Local Development (Bare Metal)** | Local Node.js (`localhost:8000`) | Local Python (`localhost:8001`) | Direct OS filesystem paths (Windows drive letters / POSIX paths). |
| **Topology 2: Single-Host Docker** | Docker Container (`:8000`) | Docker Container (`:8001`) | Shared Docker volume mounts (`/app/media_input`, `/app/media_output`). |
| **Topology 3: Distributed Multi-Machine** | Remote Server / NAS (Docker / Node) | Workstation / GPU Box (Python / Docker) | Web provides HTTP `stream_url` (`http://machine-a:8000/api/media/file?path=...`) and mapped network storage paths. |

> [!IMPORTANT]
> When modifying path resolution code (e.g. in `server/config/config.service.ts`), ensure paths work across Windows paths (`C:\...`), UNC shares (`\\server\share`), relative dev paths, and Docker POSIX paths (`/app/...`).

---

## 3. Strict Rules for Modifying Code

1. **AI Engine Guardrail (`media_cataloger`)**:
   - **ALWAYS ask before making changes** if a bug fix or feature requires modifying the AI engine code in `C:\Users\rokhl\.gemini\antigravity\scratch\media_cataloger`.
   - Provide the user with the rationale, the proposed changes, and the exact files to be updated on the `media_cataloger` side before touching them.
2. **Contract Compatibility**:
   - Maintain API contract compatibility between `media_cataloger_web` (`CatalogerClientService`) and `media_cataloger` (`FastAPI` routes: `/api/run`, `/api/analyze-file`, `/api/status`, `/api/pause`, `/api/resume`, `/api/stop`, `/api/logs`).
3. **Service Restart & Live Validation**:
   - After applying changes to either backend service, restart the service and run validation scripts.

---

## 4. Development & Validation Workflow

Whenever a change, feature, or bug fix is implemented, follow these steps:

### Step 1: Code Quality & Type Safety Checks
Run static analysis and test suites on `media_cataloger_web`:
```bash
# In media_cataloger_web directory:
npm run lint          # Fast linting with Oxlint
npm run typecheck     # TypeScript strict compilation check
npm test              # Full test suite (NestJS server + React frontend)
```

### Step 2: Restart Services
Rerun or reload the affected service:
```bash
# For local development of media_cataloger_web:
npm run server:dev    # Starts NestJS server on port 8000 with auto-reload

# For local development of media_cataloger:
# Run FastAPI server on port 8001
```

### Step 3: Verify Communication & Endpoints
Execute live endpoint verification:
```bash
# Run the built-in NestJS endpoint verification script:
npx tsx server/verify-server.ts
```

Direct API health check against both services:
```bash
# Verify media_cataloger_web status & cataloger connection
curl http://localhost:8000/api/status

# Verify direct cataloger AI service status
curl http://localhost:8001/api/status
```

### Step 4: Validate End-to-End Functionality
1. **Cataloger Run Trigger**: Trigger scan from UI or via `POST http://localhost:8000/api/cataloger/run` and observe live logs via `GET http://localhost:8000/api/cataloger/logs`.
2. **Database & Faces**: Verify that `media_cataloger_web` loads updated media from `catalog_history.db` and faces from `faces/` / `facess/`.
3. **Family Tree**: Verify family tree graph creation and node links in `family_tree.db`.
