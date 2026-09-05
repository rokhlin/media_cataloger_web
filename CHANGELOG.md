# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.8.0] - Unreleased

### Added
- **Advanced Caching Strategies & Management System**:
  - Renamed `Execution controls` settings tab to `File metadata operations` (`tabFileMetadataOperations`) with full English 🇬🇧 and Russian 🇷🇺 localization.
  - Implemented `Caching strategy` control section in `SystemSettings` featuring real-time cache metrics (item count, memory footprint, hit rate, last cache time, next scheduled run).
  - High-performance caching for static media libraries with manual single-folder or global recache triggers (`/api/media/cache/recache`).
  - Automated daily recaching background job (`checkScheduledAutomation`) with configurable time-of-day scheduling and incremental-only modes.
  - In-place warm cache recalculation on duplicate file deletion (`recalculateCacheAfterDeletion`), avoiding cold cache drops across both server and client IndexedDB.
  - Dynamic cache recalculation on folder removal and rename operations (`recalculateCacheAfterFolderChange`).
  - Added dedicated navigation link button to **Tree Settings** (`tab-settings-tree`) inside `SystemSettings` tabs navigation, automatically switching to the Family Tree screen and activating the Tree Settings subtab.

---

## [0.7.0] - 2026-09-05

### Added
- **Interactive Family Tree Explorer (`src/packages/family-tree/`)**:
  - Layered graph visualization powered by `@xyflow/react` and **ELK.js (Eclipse Layout Kernel)** computed in a dedicated Web Worker (`elk-layout.worker.ts`) with horizontal (LR) and vertical (TB) layouts, sub-tree branch folding, and navigation controls.
  - Automated Kinship Calculation Engine (`kinshipUtils.ts`, `KinshipEngineService`) resolving complex multi-generation biological and non-biological family relationships (including in-laws and step-relations).
  - Life Events & Timeline system (`FamilyEventsService`, `PersonTimelineView`, `AddEditFactModal`, `FactCard`) with gallery photo attachment picker and category filtering.
  - Graph integrity & cycle detection service (`GraphIntegrityService`) preventing circular parentage anomalies.
  - Tree settings management (`TreeSettingsTab`) with node styling options (Default, Circle, Square with mourning styling for deceased individuals), celebration badges (birthdays, anniversaries, weddings), and configurable date formats (dropdown selector).
  - Tree and timeline high-resolution export to PNG, JPG, and SVG (`treeExportService.ts`).
  - CSV Tree Import and Export with dedicated `# FACTS` lifecycle events section, syntax validation, entity reconciliation, and audit history (`ft_tree_history`).
  - Interactive modals and navigation: `PersonDetailDrawer`, `FaceLinkModal`, `QuickAddRelativeModal`, `CanvasToolbar`, and `TreeSearchBar`.
- **Timeline Calendar View (`TimelineCalendarView`)**:
  - Chronological calendar view with photo stack visualization and badges for dates with dense media capture (>10 photos).
- **UI Modularization & Component Architecture**:
  - Centralized component styling system (`screens/` directory separation, `VaultScreen`, `ViewSwitcherButtonGroup` dropdown/button modes controlled by feature flags).
  - Automatic `data/feature_flags.json` initialization from assets template on startup.
- **Native Apple HEIC/HEIF Image Support**:
  - Direct conversion and thumbnail extraction for `.heic` and `.heif` media via `heic-convert` in `ThumbnailService` and `MediaService`.
  - Comprehensive unit test coverage for HEIC/HEIF buffer conversion and error recovery.

### Fixed
- **Family Tree Life Story Facts Deduplication**:
  - Resolved duplicated facts appearing on a person's timeline when exploring with relatives enabled (spouses, parents, siblings, children).
  - Prevented reciprocal `MARRIAGE` and `DIVORCE` events from spouses from duplicating the person's own union records.
  - Filtered out a spouse's marriages to third parties (different spouses) and children with other spouses from being wrongly rendered on the person's life story.
  - Eliminated duplicate child birth facts where parent's `CHILD_BORN` event and child's `BIRTH` event were both rendered simultaneously.
  - Preserved single display of parents' marriage and divorce on child timelines.
  - Added unit test suite `timelineDeduplication.test.ts` verifying exact lifecycle event filtering.
- **Child Node Delete Action & Toolbar Display**:
  - Corrected conditional render logic in `CanvasToolbar` and `FamilyTreeTab` so child node delete/remove buttons always display when selected.
- **Filter Facts Category Responsiveness**:
  - Changed category pill container to wrap responsively (`flexWrap: 'wrap'`) and dynamically filter to categories present in active life events.
- **Canvas Top Actions Decluttering**:
  - Introduced `hide_top_screen_zoom_actions` feature flag in `CanvasToolbar` to hide duplicate top zoom buttons while preserving bottom-left canvas controls.
- **Duplicates Manager Selection & Video Streaming**:
  - Added `e.stopPropagation()` on duplicate item checkboxes and cards to prevent accidental closing of Duplicates Manager and redirection to gallery tab.
  - Added dedicated in-place Full Preview Lightbox modal with zoom button (`dup-item-zoom-btn`), metadata view, and keyboard navigation.
  - Implemented HTTP 206 Partial Content and `Range` header streaming in `server/media/media.controller.ts` for smooth video buffering, scrubbing, and seeking.

---

## [0.6.0] - 2026-09-02

### Added
- **Similar & Duplicate File Manager (`DuplicatesManagerTab`)**:
  - Dedicated duplicate and burst photo cleanup pipeline and background scanning service (`duplicates.service.ts`).
  - Configurable similarity threshold and duplicate detection criteria (exact hash/size match vs perceptual similarity).
  - Side-by-side visual comparison, metadata inspector, and batch file deletion/relocation.
  - Asynchronous organization and duplicate calculation via `mediaOrganization.worker.ts`.
- **Standalone Media Viewer Modal (`MediaViewerModal`)**:
  - Extracted standalone full-screen lightbox modal with deep image inspection, zoom controls, and EXIF/metadata drawer.
- **System Settings Overhaul (`SystemSettings`)**:
  - Replaced legacy modal with a comprehensive full-page tabbed settings interface (`SystemSettings.tsx` and `SystemSettings.css`).
  - Complete internationalization (i18n) for all settings controls.
- **Face Registry Management Component (`FaceRegistry`)**:
  - Dedicated UI for assigning, merging, and managing detected faces across media libraries.
- **Documentation & Integration Guides**:
  - Added comprehensive technical guides for AI engine integration, security, authentication setup, and SQLite schema migrations.

---

## [0.5.0] - 2026-09-01

### Added
- **Authentication & Role-Based Access Control (RBAC)**:
  - User authentication system with JWT sessions, password hashing, and route guards (`AuthGuard`, `RolesGuard`).
  - Multi-user management tab (`UserManagementTab`) with admin controls for role assignment and account creation/deletion.
  - Interactive login modal (`LoginModal`) and user profile status in `Header`.
- **Encrypted Secret Vault (`VaultModal`, `AdminVaultTab`)**:
  - Secure encrypted private vault folder protected by PIN/password.
  - Strict exclusion of vault media assets from general indexing and global search queries.
- **Metadata Editing & In-Viewer Editor (`MetadataEditorModal`)**:
  - Multi-tab in-viewer metadata editor modal in `MediaGallery` with instant reactive UI refresh and 100% English 🇬🇧 and Russian 🇷🇺 localization.
  - Atomic persistence in `DatabaseService` (`media_metadata` and `media_items` tables in `catalog_history.db`).
  - Automatic bidirectional synchronization with on-disk sidecar JSON files.

---

## [0.4.0] - 2026-09-01

### Added
- **Foundational Project Architecture & Guidelines**:
  - Modular NestJS backend structure with services, controllers, and dependency injection.
  - Standardized development rules: `.agents/rules/jest-testing-for-js-ts.md`, `.agents/rules/nest-js-development-best-practices.md`, `.agents/rules/react-js-development.md`, `.agents/rules/roadmap_and_changelog.md`, and `.agents/rules/database_migrations.md`.
  - Initial `ROADMAP.md` and `CHANGELOG.md` tracking setup.
  - Extended unit testing infrastructure for config, media, and thumbnail services.

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
