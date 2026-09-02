# Project Roadmap

## 🚀 Completed Features (v0.3.0)

- **Standalone Web & Server Architecture**: Decoupled `media_cataloger_web` into a dedicated full-stack TypeScript application powered by **NestJS** backend and **React 19 (Vite)** frontend with OpenAPI/Swagger at `/api/docs`.
- **High-Performance SQLite Database**: Embedded SQLite (`better-sqlite3`) in Write-Ahead Logging (WAL) mode for sub-millisecond query performance on low-power hardware.
- **Cross-Machine AI Engine Integration**: `CatalogerClientService` proxying execution controls, scan triggers, worker status, and real-time streaming logs to the Python AI service (`media_cataloger`).
- **Interactive Family Tree Explorer**: Layered graph visualization powered by `@xyflow/react` and **ELK.js (Eclipse Layout Kernel)** in a dedicated Web Worker (`elk-layout.worker.ts`) with horizontal/vertical layouts and branch folding.
- **Automated Kinship Calculation**: `KinshipEngineService` calculating multi-generational biological and non-biological family relationships.
- **Life Events & Person Timeline**: `FamilyEventsService`, `PersonTimelineView`, `AddEditFactModal`, `FactCard`, and gallery photo attachment picker.
- **Graph Integrity & Validation**: `GraphIntegrityService` detecting cycles and validating kinship consistency.
- **Face-to-Tree Linking**: `FaceLinkModal` and `PersonDetailDrawer` linking recognized media faces to tree persons.
- **Rich Media Gallery & Lightbox**: Virtualized media grid with chunked infinite scrolling, multi-source folder aggregation, timeline grouping, and full-screen Lightbox with localized EXIF/AI sidecar inspector.
- **Inline Person Tagging**: On-media face tagging and person assignment with automatic bidirectional sidecar JSON synchronization.
- **Client-Side Media Cache & Aggregator**: `MediaCacheService` (IndexedDB with memory fallback) and `MediaOrganizationWorker` for instant client-side folder and timeline grouping.
- **Automatic Thumbnail Service**: On-the-fly Sharp thumbnail generation, multi-tier disk caching, and native Apple HEIC/HEIF photo conversion (`heic-convert`).
- **Face Registry Management**: Face crop catalog, person name assignment, face re-assignment, and face clustering (`FacesService`).
- **Admin Panel & Feature Flags**: Diagnostics dashboard, system metrics, dynamic runtime feature flag toggles, and configuration export/import.
- **App Settings & Filesystem Browser**: Directory picker modal and cross-platform path normalization in `AppConfigService`.
- **Theme Engine**: 12 curated glassmorphism presets and dynamic custom theme builder.
- **Internationalization (i18n)**: 100% key parity English 🇬🇧 and Russian 🇷🇺 interface localization.
- **Developer Tooling & Testing**: Multi-architecture Docker images (`docker-publish.yml`), `run.ps1`/`run.sh` runners, and comprehensive test suite with 79 tests.

---

## 📋 Development Plan & Planned Features

### Architecture & Core Infrastructure
- [ ] **Comprehensive Documentation**: Create complete architecture, API, and setup documentation.
- [x] **Feature Development Guidelines**: Create developer guidelines and standards for contributing new features.
- [x] **TypeScript Support**: Migrate/add TypeScript support across the frontend and interface definitions.
- [x] **Modular Architecture & Interface Structuring**: Refactor files, models, and interfaces into clean, structured layers.
- [ ] **Error handling & recovery**: Handle errors gracefully and provide options for recovery. Define rules for:
    - source not available
    - file not exist / deleted
    - transcription error
    - face recognition error
    - LLM API error (Gemini, LM Studio)
    - image analysis error
    - db error
- [x] **Test Coverage**: Comprehensive unit and integration test suites covering Kinship, Family Tree, Settings, Config, Thumbnails, i18n, Themes, and Cache.
- [x] **Docker / Host Decoupling**: Separate application core dependencies from local host environment for robust Docker deployment.

### Metadata, Processing & AI Pipeline
- [ ] **Transcription Integration**: Fully embed audio transcription into the main media analysis pipeline.
- [x] **Media Tagging System**: Support custom and person tagging for media assets with sidecar synchronization.
- [x] **Metadata Editing**: Add full support for viewing and editing metadata.
- [ ] **Write Analysis to File Metadata**: Option to embed analysis results directly back into media files (EXIF/XMP/ID3). Disabled by default. This feature should be configurable in the admin panel.
- [x] **In-Viewer Metadata Editor**: Direct inline metadata editing within the preview modal/window.
- [ ] **AI Analysis Agent**: Dedicated autonomous AI agent for deep file analysis and insights.
- [ ] **Face Optimization Service**: Background service for periodic face embedding optimization and clustering.
- [ ] **Semantic Search**: Vector-based semantic search across media content, transcripts, and metadata.
- [x] **Worker Queue**: Configure a queue of media files for analysis with parallel processing capabilities.

### Grouping by Similarity
- [ ] **Similar files or series Grouping**: Group similar files or series of files based on similarity threshold. Similar files should be grouped together Show only one file from each group and a badge indicating the number of similar files. Allow user to see all files in a group in viewer. Keep analysis logic in `media_cataloger` as much as possible. File management put in `media_cataloger_web`.  
- [ ] **Advanced Duplicate Grouping**: Enhanced UI and pipeline for managing duplicate and burst photos. Duplicate finding should be a dedicated feature that allow used to clean up duplicates. Allow to process duplicates in background. After search is done, show summary of duplicates found. User should be able to review duplicates and decide which ones to keep and which ones to delete. User should be able to delete duplicates. Allow to find duplicates in chuncks of folders. Split duplicate definition (similarity threshold, grouping logic) from ai analysis results. Add configuration for duplicate definition in admin panel. Users can use it to define their own duplicate detection logic. Show duplicates in group view with one selected file and list of other files in the group. Allow user to compare selected file with other files in the group. Allow user to select files to delete. Allow to move files to another folder.Keep analysis logic in `media_cataloger` as much as possible. File management put in `media_cataloger_web`.  

### UI / UX & Visual Features
- [x] **Navigation Overhaul**: Redesign layout, sidebars, header navigation tabs, and workflow navigation.
- [x] **Internationalization (i18n)**: Multi-language interface and localization support (EN/RU).
- [x] **Theme System**: Dark, Light, and custom theme presets with glassmorphism design.
- [x] **Calendar Timeline View**: View photos and events on chronological timeline groupings by capture date/time.
- [ ] **Album Management**: Create, curate, and share custom photo and video albums.
- [x] **Family Tree**: Interactive genealogy / family relationship visualization connected to recognized faces.
- [ ] **Photo Stories**: Dynamic story creation and presentation from photo series.
- [ ] **AI Story Generation**: Automatic AI narrative and story generation based on photo context.
- [ ] **Memories & Flashbacks**: "On this day" and smart milestone memory reminders.

### Security, Access Control & Admin
- [x] **Authentication & Route Guards**: User login, JWT sessions, and route protection. Protect the admin panel and Face Registry. Only the admin should have access to these. In the first iteration, we can just have one user/admin.
- [x] **User & Role Management (RBAC)**: Multi-user support with custom roles and permission levels. Admin can give specific permissions to users. For example: view-only mode for some users. Admin can manage user accounts (create, edit, delete).
- [x] **Admin Dashboard**: System health monitoring, feature flag controls, and administrative settings.
- [x] **Secret / Vault Folder**: Encrypted private folder protected by password/PIN.
- [x] **Vault Search Exclusion**: Strictly exclude hidden and private vault items from global searches and indexing.

### Clients & Platforms
- [ ] **Mobile Application**: Dedicated mobile app support (iOS / Android / PWA) with responsive synchronization.
