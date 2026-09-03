# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.4.0] - Unreleased

### Added
- **Native Apple HEIC/HEIF Image Support**:
  - Direct conversion and thumbnail extraction for `.heic` and `.heif` media via `heic-convert` in `ThumbnailService` and `MediaService`.
  - Comprehensive unit test coverage for HEIC/HEIF buffer conversion and error recovery.
- **Interactive Family Tree Explorer (`src/packages/family-tree/`)**:
  - Layered graph visualization powered by `@xyflow/react` and **ELK.js (Eclipse Layout Kernel)** computed in a dedicated Web Worker (`elk-layout.worker.ts`) with horizontal (LR) and vertical (TB) layouts and branch folding.
  - Automated Kinship Calculation Engine (`KinshipEngineService`) resolving complex multi-generation biological and non-biological family relationships.
  - Life Events & Timeline system (`FamilyEventsService`, `PersonTimelineView`, `AddEditFactModal`, `FactCard`) with gallery photo attachment picker.
  - Graph integrity & cycle detection service (`GraphIntegrityService`) preventing circular parentage anomalies.
  - Interactive modals: `PersonDetailDrawer`, `FaceLinkModal`, and `QuickAddRelativeModal` (with spouse dropdown and unknown second parent options for child addition).
- **Metadata Editing & In-Viewer Editor (`MetadataEditorModal`)**:
  - Full support for viewing, modifying, and persisting metadata (summaries EN/RU, descriptions EN/RU, environment, lighting, weather, time of day, location, capture date, camera make/model/lens, OCR text, audio transcriptions, and tag chips).
  - Atomic persistence in `DatabaseService` (`media_metadata` and `media_items` tables in `catalog_history.db`).
  - Automatic bidirectional synchronization with on-disk sidecar JSON files.
  - Interactive multi-tab in-viewer metadata editor modal in `MediaGallery` with instant reactive UI refresh and 100% English 🇬🇧 and Russian 🇷🇺 localization.
- **Developer Guidelines & Rules Documentation**:
  - `.agents/rules/jest-testing-for-js-ts.md`: Strict testing requirements, mock isolation, and Jest best practices.
  - `.agents/rules/nest-js-development-best-practices.md`: Modular backend architecture and clean service standards.
  - `.agents/rules/react-js-development.md`: Modern React 19 standards, hook architecture, and accessibility.
  - `.agents/rules/roadmap_and_changelog.md`: Automated GitHub tag synchronization, version grouping, and dynamic `[future_tag_version]` tracking.
  - `.agents/rules/database_migrations.md`: Comprehensive SQLite schema evolution, migration, and persistence rules.

### Fixed
- **Duplicates Manager Card & Checkbox Selection**:
  - Fixed issue where clicking a duplicate item checkbox or thumbnail image immediately closed Duplicates Manager and returned to the Media gallery tab.
  - Added `e.stopPropagation()` on checkbox click to prevent event bubbling to parent click handlers.
  - Added direct selection toggle on duplicate card/image clicks so clicking either the checkbox or card marks duplicate files for deletion.
  - Added dedicated in-place Full Preview Lightbox modal with zoom button (`dup-item-zoom-btn`), metadata view, mark/unmark actions, and Esc key dismiss without leaving the tab.
  - Removed disruptive `setActiveTab('main')` redirect from `App.tsx`.
- **Video Preview & HTTP Range Streaming**:
  - Implemented HTTP 206 Partial Content and `Range` header streaming in `server/media/media.controller.ts` (`streamFileSafely`) for seamless buffering, scrubbing, and seeking of video files.
  - Added `Accept-Ranges: bytes` and byte-range slice stream creation.
  - Mapped `.mov` and `.m4v` to `video/mp4` MIME type for native browser demuxer compatibility.
  - Added `<video>` element support with controls, high-resolution extracted poster frame, and metadata in `DuplicatesManagerTab` preview modal and side-by-side visual comparator.
  - Enhanced `MediaViewerModal` with extracted first-frame poster (`/api/media/thumbnail?size=1920`), `playsInline`, `preload="metadata"`, and graceful fallback with direct download button when browser engines cannot decode specific video codecs (e.g. HEVC in `.mov`).

---

## [0.3.0] - 2026-09-01

### Added
- **Admin Panel & System Health Dashboard**:
  - `AdminPanel` component for managing runtime feature flag configurations, system diagnostics, and hardware metric monitoring.
  - Configuration export/import profiles for portable backup and migration.
- **Automatic Thumbnail Service (`ThumbnailService`)**:
  - On-the-fly thumbnail generation using Sharp with multi-tier disk caching.
  - Video thumbnail frame extractions and multi-resolution generation (`small`, `medium`, `large`).
- **Rich Media Gallery & Viewer (`MediaGallery`)**:
  - Virtualized media grid with chunked infinite scrolling, multi-source folder aggregation, and timeline grouping.
  - Inline person tagging and face assignment directly on media files with automatic sidecar JSON synchronization.
  - Full-screen Lightbox Modal displaying EXIF metadata, camera settings, GPS coordinates, localized AI descriptions/summaries (EN/RU), detected lighting/environment, OCR text, and face highlights.
- **App Shell & Theme Customization**:
  - Sleek modern layout with responsive sidebar navigation, header status bar, and theme switcher UI.
  - 12 curated glassmorphism theme presets and dynamic custom theme builder.

---

## [0.2.0] - 2026-08-31

### Added
- **Input Sources Gallery (`InputSourcesGallery`)**:
  - Media source browsing interface with person tagging and media management capabilities.
  - Aggregation of media files across multiple configured storage input folders.
- **Media Gallery & Processing Pipeline**:
  - Face management controllers and API endpoints for linking recognized faces.
  - `CatalogerClientService` integration and media processing pipeline UI components.
  - Media source architecture refactoring (PR #2).

---

## [0.1.0] - 2026-08-30

### Added
- **Standalone Web & Server Architecture**:
  - Decoupled `media_cataloger_web` into a dedicated full-stack TypeScript application powered by **NestJS** backend and **React 19 (Vite)** frontend.
  - High-performance REST API with OpenAPI/Swagger documentation exposed at `/api/docs`.
  - Embedded **SQLite (`better-sqlite3`)** database running in Write-Ahead Logging (WAL) mode.
  - `CatalogerClientService` proxying execution controls, scan triggers, status monitoring, and real-time streaming logs to Python AI engine.
- **Media Ingestion & Client Caching**:
  - `MediaService` for folder scanning, sidecar JSON ingestion, and metadata synchronization.
  - `MediaCacheService` (IndexedDB with memory fallback) and worker-based aggregation via `MediaOrganizationWorker`.
- **Face Registry Management (`FaceRegistry`, `FacesService`)**:
  - Face crop catalog, person name assignment, face re-assignment, and face clustering.
- **App Settings & Filesystem Browser**:
  - Directory browser modal and `SettingsService` for configuring media source paths and AI processing options.
- **Internationalization (i18n)**:
  - 100% key parity English 🇬🇧 and Russian 🇷🇺 translation dictionaries (`src/i18n/translations.ts`) with `LanguageContext`.
- **Media Source Refactoring**:
  - Integrated PR #1 for media source refactoring and modular folder handling.

---

## [0.0.1] - 2026-08-29

### Added
- **Project Scaffolding & Initial Infrastructure**:
  - Standalone project structure for `media_cataloger_web`.
  - `AppConfigService` to handle cross-platform path normalization, environment variables, and configuration persistence.
  - `SettingsService` for configuration retrieval, persistence, and filesystem directory browsing.
  - Cross-platform helper runner scripts: `run.ps1` (PowerShell) and `run.sh` (Bash).
  - Core unit test suites for `CatalogerClientService`, `SettingsService`, and `AppConfigService`.
