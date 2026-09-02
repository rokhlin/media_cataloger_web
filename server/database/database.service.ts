import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import DatabaseConstructor, { Database } from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { AppConfigService } from '../config/config.service.js';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private db: Database | null = null;

  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  onModuleInit() {
    this.initDb();
  }

  onModuleDestroy() {
    this.close();
  }

  public getDb(): Database {
    if (!this.db) {
      this.initDb();
    }
    return this.db!;
  }

  public close() {
    if (this.db) {
      try {
        this.db.close();
      } catch (err) {
        this.logger.error(`Error closing database: ${err}`);
      }
      this.db = null;
    }
  }

  public initDb(): void {
    try {
      const dbPath = this.config.dbPath;
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = new DatabaseConstructor(dbPath, { timeout: 30000 });
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('busy_timeout = 30000');
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = -64000'); // 64MB cache

      // Initialize schema, apply migrations, and create indexes
      this.createTables();
      this.migrateSchema();
      this.createIndexes();
      this.logger.log(`SQLite database connected in WAL mode at: ${dbPath}`);
    } catch (err) {
      this.logger.error(`Failed to initialize SQLite database: ${err}`);
    }
  }

  private createTables(): void {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_history (
        file_path TEXT PRIMARY KEY,
        file_size INTEGER NOT NULL,
        mtime REAL NOT NULL,
        status TEXT NOT NULL,
        processed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        sidecar_path TEXT,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS persons (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS face_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        face_id TEXT UNIQUE NOT NULL,
        person_id TEXT,
        name TEXT NOT NULL,
        embedding BLOB,
        image_path TEXT,
        confidence REAL,
        source_file TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        is_reference INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS media_items (
        id TEXT PRIMARY KEY,
        file_path TEXT UNIQUE NOT NULL,
        file_name TEXT NOT NULL,
        media_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mtime REAL,
        duration REAL,
        media_date TEXT,
        phash TEXT,
        is_vault INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'PROCESSED',
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS media_metadata (
        media_id TEXT PRIMARY KEY,
        summary TEXT,
        summary_ru TEXT,
        description TEXT,
        description_ru TEXT,
        environment TEXT,
        lighting TEXT,
        lighting_ru TEXT,
        weather TEXT,
        weather_ru TEXT,
        time_of_day TEXT,
        time_of_day_ru TEXT,
        ocr_text TEXT,
        camera_make TEXT,
        camera_model TEXT,
        latitude REAL,
        longitude REAL,
        location_name TEXT,
        exif_analysis TEXT,
        exif_analysis_ru TEXT,
        transcription TEXT,
        transcription_ru TEXT,
        timeline_events TEXT,
        raw_exif TEXT,
        raw_gemini TEXT,
        raw_defects TEXT,
        FOREIGN KEY (media_id) REFERENCES media_items(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS media_faces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        media_id TEXT,
        face_id TEXT NOT NULL,
        person_id TEXT,
        name TEXT NOT NULL,
        confidence REAL,
        bbox TEXT,
        image_path TEXT,
        time_start REAL,
        time_end REAL,
        time_intervals TEXT,
        is_reference INTEGER DEFAULT 1,
        source_file TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (media_id) REFERENCES media_items(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        permissions TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS vault_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        pin_hash TEXT,
        pin_salt TEXT,
        vault_folder TEXT,
        is_enabled INTEGER NOT NULL DEFAULT 1,
        auto_lock_minutes INTEGER NOT NULL DEFAULT 15,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS vault_items (
        file_path TEXT PRIMARY KEY,
        added_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS media_hashes (
        file_path TEXT PRIMARY KEY,
        content_hash TEXT,
        phash TEXT,
        width INTEGER,
        height INTEGER,
        file_size INTEGER,
        mtime REAL,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS duplicate_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        default_engine TEXT NOT NULL DEFAULT 'auto',
        similarity_threshold REAL NOT NULL DEFAULT 0.90,
        burst_window_seconds REAL NOT NULL DEFAULT 3.0,
        default_keep_strategy TEXT NOT NULL DEFAULT 'highest_resolution',
        target_move_folder TEXT,
        auto_scan_on_sync INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      INSERT OR IGNORE INTO duplicate_config (id, default_engine, similarity_threshold, burst_window_seconds, default_keep_strategy)
      VALUES (1, 'auto', 0.90, 3.0, 'highest_resolution');

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        duration_ms REAL
      );

      INSERT OR IGNORE INTO schema_migrations (version, name, applied_at, duration_ms)
      VALUES (1, 'initial_core_schema', datetime('now', 'localtime'), 0.0);
    `);
  }

  private migrateSchema(): void {
    if (!this.db) return;

    try {
      // Migrate media_items columns if missing
      const miCols = new Set((this.db.pragma('table_info(media_items)') as any[]).map((c: any) => c.name.toLowerCase()));
      if (!miCols.has('is_vault')) {
        this.db.exec('ALTER TABLE media_items ADD COLUMN is_vault INTEGER DEFAULT 0;');
      }

      // Migrate media_faces columns if missing
      const mfCols = new Set((this.db.pragma('table_info(media_faces)') as any[]).map((c: any) => c.name.toLowerCase()));
      if (!mfCols.has('source_file')) {
        this.db.exec('ALTER TABLE media_faces ADD COLUMN source_file TEXT;');
      }
      if (!mfCols.has('created_at')) {
        this.db.exec("ALTER TABLE media_faces ADD COLUMN created_at TEXT DEFAULT (datetime('now', 'localtime'));");
      }
      if (!mfCols.has('is_reference')) {
        this.db.exec('ALTER TABLE media_faces ADD COLUMN is_reference INTEGER DEFAULT 1;');
      }
      if (!mfCols.has('time_start')) {
        this.db.exec('ALTER TABLE media_faces ADD COLUMN time_start REAL;');
      }
      if (!mfCols.has('time_end')) {
        this.db.exec('ALTER TABLE media_faces ADD COLUMN time_end REAL;');
      }
      if (!mfCols.has('time_intervals')) {
        this.db.exec('ALTER TABLE media_faces ADD COLUMN time_intervals TEXT;');
      }

      // Deduplicate media_faces rows that share the same (source_file, face_id)
      try {
        this.db.exec(`
          DELETE FROM media_faces
          WHERE id NOT IN (
            SELECT MAX(id)
            FROM media_faces
            GROUP BY LOWER(COALESCE(source_file, '')), face_id
          );
        `);
      } catch {
        // ignore
      }

      // Migrate face_registry columns if missing
      const frCols = new Set((this.db.pragma('table_info(face_registry)') as any[]).map((c: any) => c.name.toLowerCase()));
      if (!frCols.has('source_file')) {
        this.db.exec('ALTER TABLE face_registry ADD COLUMN source_file TEXT;');
      }
      if (!frCols.has('is_reference')) {
        this.db.exec('ALTER TABLE face_registry ADD COLUMN is_reference INTEGER NOT NULL DEFAULT 1;');
      }
      if (!frCols.has('created_at')) {
        this.db.exec("ALTER TABLE face_registry ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'));");
      }

      // Migrate media_metadata columns if missing
      const mmCols = new Set((this.db.pragma('table_info(media_metadata)') as any[]).map((c: any) => c.name.toLowerCase()));
      const metaAdditions: Record<string, string> = {
        summary_ru: 'TEXT',
        description_ru: 'TEXT',
        lighting_ru: 'TEXT',
        weather_ru: 'TEXT',
        time_of_day_ru: 'TEXT',
        exif_analysis: 'TEXT',
        exif_analysis_ru: 'TEXT',
        transcription: 'TEXT',
        transcription_ru: 'TEXT',
        timeline_events: 'TEXT',
        tags: 'TEXT',
        camera_make: 'TEXT',
        camera_model: 'TEXT',
        lens_model: 'TEXT',
        location_name: 'TEXT',
      };
      for (const [col, type] of Object.entries(metaAdditions)) {
        if (!mmCols.has(col)) {
          this.db.exec(`ALTER TABLE media_metadata ADD COLUMN ${col} ${type};`);
        }
      }

      // Seed default admin account if no users exist
      try {
        const userCount = (this.db.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count || 0;
        if (userCount === 0) {
          const salt = crypto.randomBytes(16).toString('hex');
          const hash = crypto.pbkdf2Sync('admin', salt, 10000, 64, 'sha512').toString('hex');
          const defaultAdminPermissions = JSON.stringify([
            'view_media',
            'edit_metadata',
            'manage_faces',
            'admin_panel',
            'vault_access',
            'manage_users',
          ]);
          this.db.prepare(`
            INSERT INTO users (id, username, display_name, password_hash, password_salt, role, permissions, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'admin', ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
          `).run('user_admin_default', 'admin', 'Administrator', hash, salt, defaultAdminPermissions);
          this.logger.log('Seeded default administrator account (admin)');
        }
      } catch (userSeedErr) {
        this.logger.warn(`Notice during default admin check: ${userSeedErr}`);
      }
    } catch (err) {
      this.logger.warn(`Schema migration check notice: ${err}`);
    }
  }

  private createIndexes(): void {
    if (!this.db) return;

    try {
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_media_type ON media_items(media_type);
        CREATE INDEX IF NOT EXISTS idx_media_date ON media_items(media_date DESC);
        CREATE INDEX IF NOT EXISTS idx_media_filename ON media_items(file_name);
        CREATE INDEX IF NOT EXISTS idx_media_is_vault ON media_items(is_vault);
        CREATE INDEX IF NOT EXISTS idx_media_faces_media_id ON media_faces(media_id);
        CREATE INDEX IF NOT EXISTS idx_media_faces_face_id ON media_faces(face_id);
        CREATE INDEX IF NOT EXISTS idx_media_faces_source_file ON media_faces(source_file);
        CREATE INDEX IF NOT EXISTS idx_face_registry_person_id ON face_registry(person_id);
        CREATE INDEX IF NOT EXISTS idx_face_registry_face_id ON face_registry(face_id);
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      `);
    } catch (err) {
      this.logger.warn(`Index creation notice: ${err}`);
    }
  }

  // --- Sync Records ---
  getAllSyncRecords(): Record<string, any> {
    const db = this.getDb();
    const rows = db.prepare('SELECT * FROM sync_history').all() as any[];
    const result: Record<string, any> = {};
    for (const r of rows) {
      result[r.file_path] = r;
      const normalizedFwd = r.file_path.replace(/\\/g, '/');
      const normalizedBack = r.file_path.replace(/\//g, '\\');
      result[normalizedFwd] = r;
      result[normalizedBack] = r;
    }
    return result;
  }

  getSyncRecord(filePath: string): any {
    const db = this.getDb();
    const baseName = path.basename(filePath).toLowerCase();
    const exact = db.prepare('SELECT * FROM sync_history WHERE file_path = ?').get(filePath);
    if (exact) return exact;

    return db.prepare('SELECT * FROM sync_history WHERE LOWER(file_path) = LOWER(?) OR LOWER(file_path) LIKE ? LIMIT 1')
      .get(filePath, `%${baseName}`);
  }

  saveSyncRecord(record: { filePath: string; fileSize?: number; mtime?: number; status: string; sidecarPath?: string; errorMessage?: string }): void {
    const db = this.getDb();
    db.prepare(`
      INSERT INTO sync_history (file_path, file_size, mtime, status, sidecar_path, error_message, processed_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      ON CONFLICT(file_path) DO UPDATE SET
        file_size = excluded.file_size,
        mtime = excluded.mtime,
        status = excluded.status,
        sidecar_path = COALESCE(excluded.sidecar_path, sync_history.sidecar_path),
        error_message = excluded.error_message,
        processed_at = datetime('now', 'localtime')
    `).run(
      record.filePath,
      record.fileSize || 0,
      record.mtime || 0,
      record.status,
      record.sidecarPath || null,
      record.errorMessage || null
    );
  }

  // --- Media Metadata ---
  getAllMediaMetadata(): Record<string, any> {
    const db = this.getDb();
    const result: Record<string, any> = {};
    try {
      const rows = db.prepare(`
        SELECT m.id as media_id, m.file_path, m.file_name, md.*
        FROM media_items m
        LEFT JOIN media_metadata md ON m.id = md.media_id
      `).all() as any[];

      for (const r of rows) {
        if (r.file_path) {
          result[r.file_path] = r;
          result[r.file_path.replace(/\\/g, '/')] = r;
          result[r.file_path.replace(/\//g, '\\')] = r;
        }
        if (r.file_name) {
          result[r.file_name.toLowerCase()] = r;
        }
      }
    } catch {
      // ignore
    }
    return result;
  }

  getMediaMetadata(filePath: string): any {
    if (!filePath) return null;
    const db = this.getDb();
    const norm = filePath.replace(/\\/g, '/');
    const baseName = path.basename(filePath);
    try {
      const row = db.prepare(`
        SELECT m.id as media_id, m.file_path, m.file_name, md.*
        FROM media_items m
        LEFT JOIN media_metadata md ON m.id = md.media_id
        WHERE m.file_path = ? OR m.file_path = ? OR m.file_name = ? OR LOWER(m.file_name) = ?
        LIMIT 1
      `).get(filePath, norm, baseName, baseName.toLowerCase()) as any;
      return row || null;
    } catch {
      return null;
    }
  }

  saveMediaMetadata(filePath: string, metadata: Record<string, any>, mediaId?: string): void {
    const db = this.getDb();
    const mId = mediaId || `media_${Buffer.from(filePath).toString('hex').slice(0, 16)}`;
    const baseName = path.basename(filePath);

    const insertItem = db.prepare(`
      INSERT INTO media_items (id, file_path, file_name, media_type, file_size, mtime, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'PROCESSED', datetime('now', 'localtime'))
      ON CONFLICT(file_path) DO UPDATE SET
        file_name = excluded.file_name,
        status = 'PROCESSED',
        updated_at = datetime('now', 'localtime')
    `);

    const insertMeta = db.prepare(`
      INSERT INTO media_metadata (
        media_id, summary, summary_ru, description, description_ru, environment, lighting, lighting_ru,
        weather, weather_ru, time_of_day, time_of_day_ru, ocr_text, exif_analysis, exif_analysis_ru,
        transcription, transcription_ru, timeline_events, camera_make, camera_model, location_name
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(media_id) DO UPDATE SET
        summary = COALESCE(excluded.summary, media_metadata.summary),
        summary_ru = COALESCE(excluded.summary_ru, media_metadata.summary_ru),
        description = COALESCE(excluded.description, media_metadata.description),
        description_ru = COALESCE(excluded.description_ru, media_metadata.description_ru),
        environment = COALESCE(excluded.environment, media_metadata.environment),
        lighting = COALESCE(excluded.lighting, media_metadata.lighting),
        lighting_ru = COALESCE(excluded.lighting_ru, media_metadata.lighting_ru),
        weather = COALESCE(excluded.weather, media_metadata.weather),
        weather_ru = COALESCE(excluded.weather_ru, media_metadata.weather_ru),
        time_of_day = COALESCE(excluded.time_of_day, media_metadata.time_of_day),
        time_of_day_ru = COALESCE(excluded.time_of_day_ru, media_metadata.time_of_day_ru),
        ocr_text = COALESCE(excluded.ocr_text, media_metadata.ocr_text),
        exif_analysis = COALESCE(excluded.exif_analysis, media_metadata.exif_analysis),
        exif_analysis_ru = COALESCE(excluded.exif_analysis_ru, media_metadata.exif_analysis_ru),
        transcription = COALESCE(excluded.transcription, media_metadata.transcription),
        transcription_ru = COALESCE(excluded.transcription_ru, media_metadata.transcription_ru),
        timeline_events = COALESCE(excluded.timeline_events, media_metadata.timeline_events),
        camera_make = COALESCE(excluded.camera_make, media_metadata.camera_make),
        camera_model = COALESCE(excluded.camera_model, media_metadata.camera_model),
        location_name = COALESCE(excluded.location_name, media_metadata.location_name)
    `);

    const transaction = db.transaction(() => {
      insertItem.run(mId, filePath, baseName, metadata.media_type || 'image', metadata.file_size || 0, metadata.mtime || 0);
      insertMeta.run(
        mId,
        metadata.summary || null,
        metadata.summary_ru || null,
        metadata.description || null,
        metadata.description_ru || null,
        metadata.environment || null,
        metadata.lighting || null,
        metadata.lighting_ru || null,
        metadata.weather || null,
        metadata.weather_ru || null,
        metadata.time_of_day || null,
        metadata.time_of_day_ru || null,
        metadata.ocr_text || null,
        metadata.exif_analysis || null,
        metadata.exif_analysis_ru || null,
        metadata.transcription || null,
        metadata.transcription_ru || null,
        metadata.timeline_events ? (typeof metadata.timeline_events === 'string' ? metadata.timeline_events : JSON.stringify(metadata.timeline_events)) : null,
        metadata.camera_make || null,
        metadata.camera_model || null,
        metadata.location_name || null
      );
    });

    transaction();
  }

  /**
   * Update selective metadata fields for a media file.
   * Performs an atomic UPSERT on media_items and media_metadata.
   */
  updateMediaMetadata(filePath: string, updates: Record<string, any>): any {
    const db = this.getDb();
    const baseName = path.basename(filePath);
    const mId = `media_${Buffer.from(filePath).toString('hex').slice(0, 16)}`;

    let fileSize = updates.file_size || 0;
    let mtime = updates.mtime || 0;
    if (fileSize === 0) {
      try {
        if (fs.existsSync(filePath)) {
          const st = fs.statSync(filePath);
          fileSize = st.size;
          mtime = st.mtimeMs;
        }
      } catch {
        // ignore
      }
    }

    const transaction = db.transaction(() => {
      // Ensure media_items record exists
      db.prepare(`
        INSERT INTO media_items (id, file_path, file_name, media_type, file_size, mtime, status, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'PROCESSED', datetime('now', 'localtime'))
        ON CONFLICT(file_path) DO UPDATE SET
          updated_at = datetime('now', 'localtime')
      `).run(mId, filePath, baseName, updates.media_type || 'image', fileSize, mtime);

      // Ensure media_metadata row exists
      db.prepare(`
        INSERT OR IGNORE INTO media_metadata (media_id)
        VALUES (?)
      `).run(mId);

      // Build dynamic UPDATE for media_metadata
      const allowedMetaCols = [
        'summary', 'summary_ru', 'description', 'description_ru',
        'environment', 'lighting', 'lighting_ru', 'weather', 'weather_ru',
        'time_of_day', 'time_of_day_ru', 'ocr_text', 'exif_analysis', 'exif_analysis_ru',
        'transcription', 'transcription_ru', 'timeline_events',
        'camera_make', 'camera_model', 'lens_model', 'location_name', 'tags'
      ];

      const setClauses: string[] = [];
      const values: any[] = [];

      for (const col of allowedMetaCols) {
        if (col in updates) {
          setClauses.push(`${col} = ?`);
          let val = updates[col];
          if (col === 'tags' && Array.isArray(val)) {
            val = JSON.stringify(val);
          } else if (col === 'timeline_events' && typeof val === 'object' && val !== null) {
            val = JSON.stringify(val);
          }
          values.push(val === undefined ? null : val);
        }
      }

      if (setClauses.length > 0) {
        values.push(mId);
        db.prepare(`UPDATE media_metadata SET ${setClauses.join(', ')} WHERE media_id = ?`).run(...values);
      }

      if (updates.media_date !== undefined) {
        db.prepare(`UPDATE media_items SET media_date = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`)
          .run(updates.media_date, mId);
      }
    });

    transaction();

    // Fetch and return the consolidated updated record
    return db.prepare(`
      SELECT m.id as media_id, m.file_path, m.file_name, m.media_type, m.media_date, m.status, m.updated_at, md.*
      FROM media_items m
      LEFT JOIN media_metadata md ON m.id = md.media_id
      WHERE m.file_path = ? OR m.id = ?
    `).get(filePath, mId);
  }


  // --- Face Counts & Face lists by file ---
  getFacesCountBySourceFile(): Record<string, number> {
    const db = this.getDb();
    const result: Record<string, number> = {};

    try {
      const mfRows = db.prepare(`
        SELECT COALESCE(mf.source_file, m.file_path) as source_file, COUNT(DISTINCT mf.face_id) as count
        FROM media_faces mf
        LEFT JOIN media_items m ON mf.media_id = m.id
        WHERE (mf.source_file IS NOT NULL AND mf.source_file != '') OR (m.file_path IS NOT NULL AND m.file_path != '')
        GROUP BY COALESCE(mf.source_file, m.file_path)
      `).all() as any[];

      for (const r of mfRows) {
        if (r.source_file) {
          result[r.source_file] = r.count;
        }
      }
    } catch {
      // ignore
    }

    try {
      const frRows = db.prepare(`
        SELECT source_file, COUNT(DISTINCT face_id) as count
        FROM face_registry
        WHERE source_file IS NOT NULL AND source_file != ''
        GROUP BY source_file
      `).all() as any[];

      for (const r of frRows) {
        if (!result[r.source_file]) {
          result[r.source_file] = r.count;
        }
      }
    } catch {
      // ignore
    }

    return result;
  }

  getAllFacesBySourceFile(): Record<string, any[]> {
    const db = this.getDb();
    const result: Record<string, any[]> = {};

    try {
      const mfRows = db.prepare(`
        SELECT mf.id, mf.media_id, mf.face_id, mf.person_id, mf.name, mf.confidence, mf.bbox, mf.image_path, mf.time_start, mf.time_end,
               COALESCE(mf.source_file, m.file_path, fr.source_file) as source_file,
               COALESCE(mf.is_reference, fr.is_reference, 0) as is_reference
        FROM media_faces mf
        LEFT JOIN media_items m ON mf.media_id = m.id
        LEFT JOIN (
          SELECT face_id, MIN(source_file) as source_file, MAX(is_reference) as is_reference
          FROM face_registry
          GROUP BY face_id
        ) fr ON mf.face_id = fr.face_id
        ORDER BY mf.id ASC
      `).all() as any[];

      for (const r of mfRows) {
        const src = r.source_file || '';
        if (src) {
          if (!result[src]) {
            result[src] = [];
          }
          if (!result[src].some((x: any) => x.face_id === r.face_id)) {
            result[src].push(r);
          }
        }
      }
    } catch {
      // ignore
    }

    try {
      const frRows = db.prepare(`
        SELECT NULL as media_id, face_id, person_id, name, confidence, NULL as bbox, image_path, NULL as time_start, NULL as time_end, source_file,
               is_reference
        FROM face_registry
        WHERE source_file IS NOT NULL AND source_file != ''
        ORDER BY id ASC
      `).all() as any[];

      for (const r of frRows) {
        const src = r.source_file || '';
        if (src) {
          if (!result[src]) {
            result[src] = [r];
          } else if (!result[src].some((x: any) => x.face_id === r.face_id)) {
            result[src].push(r);
          }
        }
      }
    } catch {
      // ignore
    }

    return result;
  }

  getFacesBySourceFile(filePath: string): any[] {
    const db = this.getDb();
    const baseName = path.basename(filePath).toLowerCase();

    try {
      const rows = db.prepare(`
        SELECT mf.id, mf.media_id, mf.face_id, mf.person_id, mf.name, mf.confidence, mf.bbox, mf.image_path, mf.time_start, mf.time_end,
               COALESCE(mf.source_file, m.file_path, fr.source_file) as source_file,
               COALESCE(mf.is_reference, fr.is_reference, 0) as is_reference
        FROM media_faces mf
        LEFT JOIN media_items m ON mf.media_id = m.id
        LEFT JOIN (
          SELECT face_id, MIN(source_file) as source_file, MAX(is_reference) as is_reference
          FROM face_registry
          GROUP BY face_id
        ) fr ON mf.face_id = fr.face_id
        WHERE LOWER(COALESCE(mf.source_file, '')) = LOWER(?)
           OR LOWER(COALESCE(m.file_path, '')) = LOWER(?)
           OR LOWER(COALESCE(mf.source_file, '')) LIKE ?
           OR LOWER(COALESCE(m.file_path, '')) LIKE ?
        ORDER BY mf.id ASC
      `).all(filePath, filePath, `%${baseName}`, `%${baseName}`) as any[];

      if (rows.length > 0) {
        const unique = new Map<string, any>();
        for (const r of rows) {
          if (r.face_id && !unique.has(r.face_id)) {
            unique.set(r.face_id, r);
          }
        }
        return Array.from(unique.values());
      }
    } catch {
      // ignore
    }

    try {
      const rows = db.prepare(`
        SELECT id, face_id, person_id, name, confidence, NULL as bbox, image_path, NULL as time_start, NULL as time_end, source_file,
               is_reference
        FROM face_registry
        WHERE LOWER(source_file) = LOWER(?) OR LOWER(source_file) LIKE ?
        ORDER BY id ASC
      `).all(filePath, `%${baseName}`) as any[];

      const unique = new Map<string, any>();
      for (const r of rows) {
        if (r.face_id && !unique.has(r.face_id)) {
          unique.set(r.face_id, r);
        }
      }
      return Array.from(unique.values());
    } catch {
      return [];
    }
  }

  saveMediaFaces(filePath: string, faces: any[]): void {
    if (!faces || faces.length === 0) return;
    const db = this.getDb();
    const baseName = path.basename(filePath).toLowerCase();

    const insertPerson = db.prepare('INSERT OR IGNORE INTO persons (id, name) VALUES (?, ?)');
    const insertMf = db.prepare(`
      INSERT OR REPLACE INTO media_faces (
        face_id, person_id, name, confidence, bbox, image_path, time_start, time_end, time_intervals, is_reference, source_file, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);
    const insertFr = db.prepare(`
      INSERT OR IGNORE INTO face_registry (
        face_id, person_id, name, confidence, image_path, source_file, is_reference, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);
    const delExisting = db.prepare(`
      DELETE FROM media_faces
      WHERE LOWER(COALESCE(source_file, '')) = LOWER(?)
         OR LOWER(COALESCE(source_file, '')) LIKE ?
    `);

    // Deduplicate faces in memory first by face_id
    const uniqueFacesMap = new Map<string, any>();
    for (const f of faces) {
      const faceId = f.face_id || f.id || `face_${Math.random().toString(36).substring(2, 10)}`;
      if (!uniqueFacesMap.has(faceId)) {
        uniqueFacesMap.set(faceId, { ...f, face_id: faceId });
      }
    }

    const transaction = db.transaction(() => {
      delExisting.run(filePath, `%${baseName}`);
      for (const f of uniqueFacesMap.values()) {
        const faceId = f.face_id;
        const name = f.name || f.person_name || `face_${faceId.replace(/^face_/, '')}`;
        const personId = f.person_id || (name && !name.startsWith('face_') ? `person_${name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}` : null);
        const conf = typeof f.confidence === 'number' ? f.confidence : 0.95;
        const bbox = f.bbox ? (typeof f.bbox === 'string' ? f.bbox : JSON.stringify(f.bbox)) : null;
        const imgPath = f.image_path || f.crop_path || f.image || null;
        const isRef = f.is_reference !== undefined ? (f.is_reference ? 1 : 0) : (name && !name.startsWith('face_') ? 1 : 0);

        if (personId && name && !name.startsWith('face_')) {
          insertPerson.run(personId, name);
        }

        insertMf.run(
          faceId,
          personId,
          name,
          conf,
          bbox,
          imgPath,
          f.time_start ?? null,
          f.time_end ?? null,
          f.time_intervals ? (typeof f.time_intervals === 'string' ? f.time_intervals : JSON.stringify(f.time_intervals)) : null,
          isRef,
          filePath
        );

        insertFr.run(
          faceId,
          personId,
          name,
          conf,
          imgPath,
          filePath,
          isRef
        );
      }
    });

    transaction();
  }

  // --- Persons & Face Registry ---
  getAllRegisteredFaces(): any[] {
    const db = this.getDb();
    const rows = db.prepare(`
      SELECT face_id, person_id, name, confidence, image_path, source_file, is_reference, created_at
      FROM face_registry
      ORDER BY id DESC
    `).all() as any[];

    return rows.map(r => ({
      face_id: r.face_id,
      person_id: r.person_id,
      name: r.name,
      confidence: r.confidence,
      image_path: r.image_path,
      source_file: r.source_file,
      is_reference: Boolean(r.is_reference),
      created_at: r.created_at,
      embedding_shape: [512]
    }));
  }

  getKnownPersons(): any[] {
    const db = this.getDb();
    const rows = db.prepare(`
      SELECT 
        fr.face_id,
        COALESCE(fr.person_id, fr.name) as person_id,
        fr.name,
        fr.image_path,
        fr.confidence,
        fr.source_file,
        fr.created_at
      FROM face_registry fr
      WHERE fr.is_reference = 1 AND LOWER(fr.name) NOT LIKE 'face_%' AND fr.name != ''
      ORDER BY fr.name ASC, fr.created_at ASC
    `).all() as any[];

    const personsMap: Record<string, any> = {};
    for (const r of rows) {
      const pName = r.name;
      if (!personsMap[pName]) {
        personsMap[pName] = {
          person_id: r.person_id,
          name: pName,
          reference_count: 0,
          reference_face_count: 0,
          reference_faces: [],
          sample_images: [],
          sample_image: r.image_path || null,
        };
      }

      const faceItem = {
        face_id: r.face_id,
        name: r.name,
        image_path: r.image_path,
        confidence: r.confidence,
        source_file: r.source_file,
        created_at: r.created_at,
      };
      personsMap[pName].reference_faces.push(faceItem);
      personsMap[pName].reference_count += 1;
      personsMap[pName].reference_face_count += 1;
      if (r.image_path) {
        personsMap[pName].sample_images.push(r.image_path);
      }
    }

    return Object.values(personsMap);
  }

  getUnrecognizedFaces(): any[] {
    const db = this.getDb();
    return db.prepare(`
      SELECT id, face_id, name, confidence, image_path, source_file, created_at, is_reference
      FROM face_registry
      WHERE is_reference = 0 OR LOWER(name) LIKE 'face_%' OR person_id IS NULL OR person_id = face_id
      ORDER BY id DESC
    `).all() as any[];
  }

  getUnrecognizedFaceGroups(similarityThreshold: number = 0.55): any[] {
    const db = this.getDb();
    const unrec = db.prepare(`
      SELECT id, face_id, name, confidence, image_path, source_file, embedding, created_at, is_reference
      FROM face_registry
      WHERE is_reference = 0 OR LOWER(name) LIKE 'face_%' OR person_id IS NULL OR person_id = face_id
      ORDER BY id ASC
    `).all() as any[];

    if (unrec.length === 0) {
      return [];
    }

    // Helper: decode float32 numpy embedding buffer
    const parseEmbedding = (blob: Buffer | null): Float32Array | null => {
      if (!blob || blob.length === 0) return null;
      try {
        const ab = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength);
        return new Float32Array(ab);
      } catch {
        return null;
      }
    };

    const cosineSimilarity = (a: Float32Array, b: Float32Array): number => {
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      if (normA === 0 || normB === 0) return 0;
      return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    };

    const items = unrec.map(r => ({
      face_id: r.face_id,
      name: r.name,
      confidence: r.confidence,
      image_path: r.image_path,
      source_file: r.source_file,
      created_at: r.created_at,
      is_reference: r.is_reference,
      emb: parseEmbedding(r.embedding)
    }));

    const visited = new Set<string>();
    const groups: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (visited.has(item.face_id)) continue;

      const cluster = [item];
      visited.add(item.face_id);

      if (item.emb) {
        for (let j = i + 1; j < items.length; j++) {
          const other = items[j];
          if (visited.has(other.face_id) || !other.emb) continue;

          const sim = cosineSimilarity(item.emb, other.emb);
          if (sim >= similarityThreshold) {
            cluster.push(other);
            visited.add(other.face_id);
          }
        }
      }

      const faceIds = cluster.map(c => c.face_id);
      const confs = cluster.map(c => c.confidence || 0.8);
      const avgConf = confs.reduce((a, b) => a + b, 0) / confs.length;
      const sourceFiles = [...new Set(cluster.map(c => c.source_file).filter(Boolean))];
      const sampleFace = cluster.find(c => c.image_path) || cluster[0];

      const cleanMembers = cluster.map(({ emb, ...rest }) => rest);

      groups.push({
        group_id: `group_${faceIds[0]}`,
        count: cluster.length,
        avg_confidence: Math.round(avgConf * 100) / 100,
        face_ids: faceIds,
        faces: cleanMembers,
        members: cleanMembers,
        representative: cleanMembers[0],
        representative_face: cleanMembers[0],
        source_files: sourceFiles,
        sample_image: sampleFace.image_path,
        sample_face_id: sampleFace.face_id
      });
    }

    return groups;
  }

  getFaceNameMapping(): Record<string, string> {
    const db = this.getDb();
    const rows = db.prepare('SELECT face_id, name FROM face_registry').all() as any[];
    const result: Record<string, string> = {};
    for (const r of rows) {
      result[r.face_id] = r.name;
    }
    try {
      const mediaRows = db.prepare('SELECT face_id, name FROM media_faces').all() as any[];
      for (const mr of mediaRows) {
        if (!result[mr.face_id]) {
          result[mr.face_id] = mr.name;
        }
      }
    } catch {
      // ignore
    }
    return result;
  }

  // --- Face Management Actions ---
  updateFaceName(faceId: string, newName: string): boolean {
    const db = this.getDb();
    const updateRegistry = db.prepare('UPDATE face_registry SET name = ? WHERE face_id = ?');
    const updateMediaFaces = db.prepare('UPDATE media_faces SET name = ? WHERE face_id = ?');

    const transaction = db.transaction(() => {
      updateRegistry.run(newName, faceId);
      updateMediaFaces.run(newName, faceId);
    });

    transaction();
    return true;
  }

  assignFaceToPerson(faceId: string, personName: string): boolean {
    const db = this.getDb();
    const trimmed = personName.trim();
    
    // Check if person already exists by name to reuse ID
    let personId: string;
    const existingPerson = db.prepare('SELECT id FROM persons WHERE LOWER(name) = LOWER(?)').get(trimmed) as any;
    if (existingPerson && existingPerson.id) {
      personId = existingPerson.id;
    } else {
      personId = `person_${trimmed.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
    }

    const insertPerson = db.prepare('INSERT OR IGNORE INTO persons (id, name) VALUES (?, ?)');
    const updateRegistry = db.prepare('UPDATE face_registry SET name = ?, person_id = ?, is_reference = 1 WHERE face_id = ?');
    const updateMediaFaces = db.prepare('UPDATE media_faces SET name = ?, person_id = ?, is_reference = 1 WHERE face_id = ?');
    const insertRegistry = db.prepare(`
      INSERT OR IGNORE INTO face_registry (face_id, person_id, name, confidence, source_file, image_path, is_reference)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    const transaction = db.transaction(() => {
      insertPerson.run(personId, trimmed);
      const res = updateRegistry.run(trimmed, personId, faceId);
      if (res.changes === 0) {
        const mf = db.prepare('SELECT * FROM media_faces WHERE face_id = ? LIMIT 1').get(faceId) as any;
        if (mf) {
          insertRegistry.run(faceId, personId, trimmed, mf.confidence || 0.8, mf.source_file || null, mf.image_path || null);
        }
      }
      updateMediaFaces.run(trimmed, personId, faceId);
    });

    transaction();
    return true;
  }

  assignGroupToPerson(faceIds: string[], personName: string): boolean {
    const db = this.getDb();
    const trimmed = personName.trim();
    
    let personId: string;
    const existingPerson = db.prepare('SELECT id FROM persons WHERE LOWER(name) = LOWER(?)').get(trimmed) as any;
    if (existingPerson && existingPerson.id) {
      personId = existingPerson.id;
    } else {
      personId = `person_${trimmed.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
    }

    const insertPerson = db.prepare('INSERT OR IGNORE INTO persons (id, name) VALUES (?, ?)');
    const updateRegistry = db.prepare('UPDATE face_registry SET name = ?, person_id = ?, is_reference = 1 WHERE face_id = ?');
    const updateMediaFaces = db.prepare('UPDATE media_faces SET name = ?, person_id = ?, is_reference = 1 WHERE face_id = ?');
    const insertRegistry = db.prepare(`
      INSERT OR IGNORE INTO face_registry (face_id, person_id, name, confidence, source_file, image_path, is_reference)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    const transaction = db.transaction(() => {
      insertPerson.run(personId, trimmed);
      for (const fid of faceIds) {
        const res = updateRegistry.run(trimmed, personId, fid);
        if (res.changes === 0) {
          const mf = db.prepare('SELECT * FROM media_faces WHERE face_id = ? LIMIT 1').get(fid) as any;
          if (mf) {
            insertRegistry.run(fid, personId, trimmed, mf.confidence || 0.8, mf.source_file || null, mf.image_path || null);
          }
        }
        updateMediaFaces.run(trimmed, personId, fid);
      }
    });

    transaction();
    return true;
  }

  resetFaceAssignment(faceId: string): boolean {
    const db = this.getDb();
    const defaultName = `face_${faceId.replace(/^face_/, '')}`;
    const updateRegistry = db.prepare('UPDATE face_registry SET name = ?, person_id = NULL, is_reference = 0 WHERE face_id = ?');
    const updateMediaFaces = db.prepare('UPDATE media_faces SET name = ?, person_id = NULL, is_reference = 0 WHERE face_id = ?');

    const transaction = db.transaction(() => {
      updateRegistry.run(defaultName, faceId);
      updateMediaFaces.run(defaultName, faceId);
    });

    transaction();
    return true;
  }

  resetFaceAssignmentsByFilename(filename: string): { reset_count: number; face_ids: string[] } {
    const db = this.getDb();
    const baseName = path.basename(filename).toLowerCase();
    const rows = db.prepare(`
      SELECT DISTINCT face_id FROM media_faces
      WHERE LOWER(COALESCE(source_file, '')) = LOWER(?) OR LOWER(COALESCE(source_file, '')) LIKE ?
    `).all(filename, `%${baseName}`) as any[];

    const faceIds = rows.map(r => r.face_id);
    for (const fid of faceIds) {
      this.resetFaceAssignment(fid);
    }

    return {
      reset_count: faceIds.length,
      face_ids: faceIds
    };
  }

  deleteFace(faceId: string): boolean {
    const db = this.getDb();
    const delReg = db.prepare('DELETE FROM face_registry WHERE face_id = ?');
    const delMf = db.prepare('DELETE FROM media_faces WHERE face_id = ?');

    const transaction = db.transaction(() => {
      delReg.run(faceId);
      delMf.run(faceId);
    });

    transaction();
    return true;
  }

  addPersonToMediaFile(file: string, personName: string): any {
    const db = this.getDb();
    const trimmed = personName.trim();
    const personId = `person_${trimmed.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
    const syntheticFaceId = `face_manual_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const insertPerson = db.prepare('INSERT OR IGNORE INTO persons (id, name) VALUES (?, ?)');
    const insertMediaFace = db.prepare(`
      INSERT INTO media_faces (face_id, person_id, name, confidence, source_file, created_at, is_reference)
      VALUES (?, ?, ?, 1.0, ?, datetime('now', 'localtime'), 1)
    `);
    const insertRegistry = db.prepare(`
      INSERT OR IGNORE INTO face_registry (face_id, person_id, name, confidence, source_file, created_at, is_reference)
      VALUES (?, ?, ?, 1.0, ?, datetime('now', 'localtime'), 1)
    `);

    const transaction = db.transaction(() => {
      insertPerson.run(personId, trimmed);
      insertMediaFace.run(syntheticFaceId, personId, trimmed, file);
      insertRegistry.run(syntheticFaceId, personId, trimmed, file);
    });

    transaction();
    return { face_id: syntheticFaceId, person_id: personId, name: trimmed, source_file: file };
  }

  removeFaceFromMediaFile(file: string, faceId: string): boolean {
    const db = this.getDb();
    const baseName = path.basename(file).toLowerCase();
    const delMf = db.prepare(`
      DELETE FROM media_faces
      WHERE face_id = ? AND (LOWER(COALESCE(source_file, '')) = LOWER(?) OR LOWER(COALESCE(source_file, '')) LIKE ?)
    `);
    const delReg = db.prepare(`
      DELETE FROM face_registry
      WHERE face_id = ? AND (LOWER(COALESCE(source_file, '')) = LOWER(?) OR LOWER(COALESCE(source_file, '')) LIKE ?)
    `);

    const transaction = db.transaction(() => {
      delMf.run(faceId, file, `%${baseName}`);
      delReg.run(faceId, file, `%${baseName}`);
    });

    transaction();
    return true;
  }

  // --- Users & RBAC ---
  getUserByUsername(username: string): any {
    const db = this.getDb();
    const row = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username) as any;
    if (!row) return null;
    return {
      ...row,
      permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions || '[]') : row.permissions,
    };
  }

  getUserById(id: string): any {
    const db = this.getDb();
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      ...row,
      permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions || '[]') : row.permissions,
    };
  }

  listUsers(): any[] {
    const db = this.getDb();
    const rows = db.prepare('SELECT id, username, display_name, role, permissions, created_at, updated_at FROM users ORDER BY created_at ASC').all() as any[];
    return rows.map((r) => ({
      ...r,
      permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions || '[]') : r.permissions,
    }));
  }

  createUser(user: {
    id: string;
    username: string;
    displayName?: string;
    passwordHash: string;
    passwordSalt: string;
    role: string;
    permissions: string[];
  }): any {
    const db = this.getDb();
    const permJson = JSON.stringify(user.permissions || []);
    db.prepare(`
      INSERT INTO users (id, username, display_name, password_hash, password_salt, role, permissions, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `).run(
      user.id,
      user.username.trim(),
      user.displayName?.trim() || user.username.trim(),
      user.passwordHash,
      user.passwordSalt,
      user.role || 'viewer',
      permJson
    );
    return this.getUserById(user.id);
  }

  updateUser(
    id: string,
    updates: {
      displayName?: string;
      passwordHash?: string;
      passwordSalt?: string;
      role?: string;
      permissions?: string[];
    }
  ): any {
    const db = this.getDb();
    const current = this.getUserById(id);
    if (!current) return null;

    const newDisplayName = updates.displayName !== undefined ? updates.displayName : current.display_name;
    const newHash = updates.passwordHash !== undefined ? updates.passwordHash : current.password_hash;
    const newSalt = updates.passwordSalt !== undefined ? updates.passwordSalt : current.password_salt;
    const newRole = updates.role !== undefined ? updates.role : current.role;
    const newPerms = updates.permissions !== undefined ? JSON.stringify(updates.permissions) : JSON.stringify(current.permissions || []);

    db.prepare(`
      UPDATE users SET
        display_name = ?,
        password_hash = ?,
        password_salt = ?,
        role = ?,
        permissions = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(newDisplayName, newHash, newSalt, newRole, newPerms, id);

    return this.getUserById(id);
  }

  deleteUser(id: string): boolean {
    const db = this.getDb();
    const res = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return res.changes > 0;
  }

  countUsers(): number {
    const db = this.getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
    return row?.count || 0;
  }

  // --- Secret Vault Storage & Config ---
  getVaultConfig(): any {
    const db = this.getDb();
    const row = db.prepare('SELECT * FROM vault_config WHERE id = 1').get() as any;
    if (!row) return null;
    return {
      ...row,
      is_enabled: Boolean(row.is_enabled),
      has_pin: Boolean(row.pin_hash),
    };
  }

  saveVaultConfig(config: {
    pinHash?: string;
    pinSalt?: string;
    vaultFolder?: string;
    isEnabled?: boolean;
    autoLockMinutes?: number;
  }): any {
    const db = this.getDb();
    const current = this.getVaultConfig();
    const isEnabledNum = (config.isEnabled !== undefined ? config.isEnabled : current?.is_enabled ?? true) ? 1 : 0;
    const autoLock = config.autoLockMinutes !== undefined ? config.autoLockMinutes : current?.auto_lock_minutes ?? 15;
    const vaultFolder = config.vaultFolder !== undefined ? config.vaultFolder : current?.vault_folder ?? null;
    const pinHash = config.pinHash !== undefined ? config.pinHash : current?.pin_hash ?? null;
    const pinSalt = config.pinSalt !== undefined ? config.pinSalt : current?.pin_salt ?? null;

    db.prepare(`
      INSERT INTO vault_config (id, pin_hash, pin_salt, vault_folder, is_enabled, auto_lock_minutes, created_at, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
      ON CONFLICT(id) DO UPDATE SET
        pin_hash = excluded.pin_hash,
        pin_salt = excluded.pin_salt,
        vault_folder = excluded.vault_folder,
        is_enabled = excluded.is_enabled,
        auto_lock_minutes = excluded.auto_lock_minutes,
        updated_at = datetime('now', 'localtime')
    `).run(pinHash, pinSalt, vaultFolder, isEnabledNum, autoLock);

    return this.getVaultConfig();
  }

  listVaultItems(): string[] {
    const db = this.getDb();
    const rows = db.prepare('SELECT file_path FROM vault_items').all() as any[];
    return rows.map((r) => r.file_path);
  }

  addVaultItem(filePath: string, notes?: string): boolean {
    const db = this.getDb();
    const norm = filePath.replace(/\\/g, '/');
    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO vault_items (file_path, notes, added_at)
        VALUES (?, ?, datetime('now', 'localtime'))
        ON CONFLICT(file_path) DO UPDATE SET notes = COALESCE(excluded.notes, vault_items.notes)
      `).run(norm, notes || null);

      db.prepare(`
        UPDATE media_items SET is_vault = 1, updated_at = datetime('now', 'localtime')
        WHERE file_path = ? OR file_path = ? OR LOWER(file_path) = LOWER(?)
      `).run(filePath, norm, norm);
    });

    transaction();
    return true;
  }

  removeVaultItem(filePath: string): boolean {
    const db = this.getDb();
    const norm = filePath.replace(/\\/g, '/');
    const transaction = db.transaction(() => {
      db.prepare(`
        DELETE FROM vault_items
        WHERE file_path = ? OR file_path = ? OR LOWER(file_path) = LOWER(?)
      `).run(filePath, norm, norm);

      db.prepare(`
        UPDATE media_items SET is_vault = 0, updated_at = datetime('now', 'localtime')
        WHERE file_path = ? OR file_path = ? OR LOWER(file_path) = LOWER(?)
      `).run(filePath, norm, norm);
    });

    transaction();
    return true;
  }

  isItemInVault(filePath: string): boolean {
    const db = this.getDb();
    const norm = filePath.replace(/\\/g, '/');
    const row = db.prepare(`
      SELECT 1 FROM vault_items
      WHERE file_path = ? OR file_path = ? OR LOWER(file_path) = LOWER(?)
      LIMIT 1
    `).get(filePath, norm, norm);
    if (row) return true;

    // Also check if flagged in media_items
    const miRow = db.prepare(`
      SELECT is_vault FROM media_items
      WHERE file_path = ? OR file_path = ? OR LOWER(file_path) = LOWER(?)
      LIMIT 1
    `).get(filePath, norm, norm) as any;
    return Boolean(miRow?.is_vault);
  }

  // --- Duplicate & Perceptual Hash Operations ---

  getMediaHash(filePath: string): any {
    const db = this.getDb();
    const norm = filePath.replace(/\\/g, '/');
    return db.prepare(`
      SELECT * FROM media_hashes
      WHERE file_path = ? OR file_path = ? OR LOWER(file_path) = LOWER(?)
      LIMIT 1
    `).get(filePath, norm, norm);
  }

  getAllMediaHashes(): any[] {
    const db = this.getDb();
    return db.prepare(`SELECT * FROM media_hashes`).all();
  }

  saveMediaHash(data: {
    filePath: string;
    contentHash?: string | null;
    phash?: string | null;
    width?: number | null;
    height?: number | null;
    fileSize?: number | null;
    mtime?: number | null;
  }): void {
    const db = this.getDb();
    const norm = data.filePath.replace(/\\/g, '/');
    db.prepare(`
      INSERT INTO media_hashes (file_path, content_hash, phash, width, height, file_size, mtime, created_at)
      VALUES (@filePath, @contentHash, @phash, @width, @height, @fileSize, @mtime, datetime('now', 'localtime'))
      ON CONFLICT(file_path) DO UPDATE SET
        content_hash = COALESCE(excluded.content_hash, media_hashes.content_hash),
        phash = COALESCE(excluded.phash, media_hashes.phash),
        width = COALESCE(excluded.width, media_hashes.width),
        height = COALESCE(excluded.height, media_hashes.height),
        file_size = COALESCE(excluded.file_size, media_hashes.file_size),
        mtime = COALESCE(excluded.mtime, media_hashes.mtime)
    `).run({
      filePath: norm,
      contentHash: data.contentHash || null,
      phash: data.phash || null,
      width: data.width || null,
      height: data.height || null,
      fileSize: data.fileSize || 0,
      mtime: data.mtime || 0,
    });
  }

  deleteMediaHash(filePath: string): void {
    const db = this.getDb();
    const norm = filePath.replace(/\\/g, '/');
    db.prepare(`
      DELETE FROM media_hashes
      WHERE file_path = ? OR file_path = ? OR LOWER(file_path) = LOWER(?)
    `).run(filePath, norm, norm);
  }

  deleteMediaHashes(filePaths: string[]): void {
    if (!filePaths || filePaths.length === 0) return;
    const db = this.getDb();
    const transaction = db.transaction(() => {
      const stmt = db.prepare(`
        DELETE FROM media_hashes
        WHERE file_path = ? OR file_path = ? OR LOWER(file_path) = LOWER(?)
      `);
      for (const fp of filePaths) {
        const norm = fp.replace(/\\/g, '/');
        stmt.run(fp, norm, norm);
      }
    });
    transaction();
  }

  getDuplicateConfig(): {
    default_engine: string;
    similarity_threshold: number;
    burst_window_seconds: number;
    default_keep_strategy: string;
    target_move_folder: string | null;
    auto_scan_on_sync: boolean;
    updated_at: string;
  } {
    const db = this.getDb();
    const row = db.prepare(`SELECT * FROM duplicate_config WHERE id = 1`).get() as any;
    if (!row) {
      return {
        default_engine: 'auto',
        similarity_threshold: 0.90,
        burst_window_seconds: 3.0,
        default_keep_strategy: 'highest_resolution',
        target_move_folder: null,
        auto_scan_on_sync: false,
        updated_at: new Date().toISOString(),
      };
    }
    return {
      default_engine: row.default_engine || 'auto',
      similarity_threshold: Number(row.similarity_threshold) || 0.90,
      burst_window_seconds: Number(row.burst_window_seconds) || 3.0,
      default_keep_strategy: row.default_keep_strategy || 'highest_resolution',
      target_move_folder: row.target_move_folder || null,
      auto_scan_on_sync: Boolean(row.auto_scan_on_sync),
      updated_at: row.updated_at || new Date().toISOString(),
    };
  }

  saveDuplicateConfig(config: {
    default_engine?: string;
    similarity_threshold?: number;
    burst_window_seconds?: number;
    default_keep_strategy?: string;
    target_move_folder?: string | null;
    auto_scan_on_sync?: boolean;
  }): any {
    const db = this.getDb();
    const current = this.getDuplicateConfig();
    const updated = {
      default_engine: config.default_engine !== undefined ? config.default_engine : current.default_engine,
      similarity_threshold: config.similarity_threshold !== undefined ? config.similarity_threshold : current.similarity_threshold,
      burst_window_seconds: config.burst_window_seconds !== undefined ? config.burst_window_seconds : current.burst_window_seconds,
      default_keep_strategy: config.default_keep_strategy !== undefined ? config.default_keep_strategy : current.default_keep_strategy,
      target_move_folder: config.target_move_folder !== undefined ? config.target_move_folder : current.target_move_folder,
      auto_scan_on_sync: config.auto_scan_on_sync !== undefined ? (config.auto_scan_on_sync ? 1 : 0) : (current.auto_scan_on_sync ? 1 : 0),
    };

    db.prepare(`
      INSERT INTO duplicate_config (id, default_engine, similarity_threshold, burst_window_seconds, default_keep_strategy, target_move_folder, auto_scan_on_sync, updated_at)
      VALUES (1, @default_engine, @similarity_threshold, @burst_window_seconds, @default_keep_strategy, @target_move_folder, @auto_scan_on_sync, datetime('now', 'localtime'))
      ON CONFLICT(id) DO UPDATE SET
        default_engine = excluded.default_engine,
        similarity_threshold = excluded.similarity_threshold,
        burst_window_seconds = excluded.burst_window_seconds,
        default_keep_strategy = excluded.default_keep_strategy,
        target_move_folder = excluded.target_move_folder,
        auto_scan_on_sync = excluded.auto_scan_on_sync,
        updated_at = datetime('now', 'localtime')
    `).run(updated);

    return this.getDuplicateConfig();
  }
}

