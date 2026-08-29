import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import DatabaseConstructor, { Database } from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
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

      // Initialize schema
      this.createTables();
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
        status TEXT NOT NULL DEFAULT 'PROCESSED',
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_media_type ON media_items(media_type);
      CREATE INDEX IF NOT EXISTS idx_media_date ON media_items(media_date DESC);
      CREATE INDEX IF NOT EXISTS idx_media_filename ON media_items(file_name);

      CREATE TABLE IF NOT EXISTS media_metadata (
        media_id TEXT PRIMARY KEY,
        summary TEXT,
        summary_ru TEXT,
        description TEXT,
        description_ru TEXT,
        environment TEXT,
        lighting TEXT,
        weather TEXT,
        time_of_day TEXT,
        ocr_text TEXT,
        camera_make TEXT,
        camera_model TEXT,
        latitude REAL,
        longitude REAL,
        location_name TEXT,
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
        FOREIGN KEY (media_id) REFERENCES media_items(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_media_faces_media_id ON media_faces(media_id);
      CREATE INDEX IF NOT EXISTS idx_media_faces_face_id ON media_faces(face_id);

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

  // --- Sync Records ---
  getAllSyncRecords(): Record<string, any> {
    const db = this.getDb();
    const rows = db.prepare('SELECT * FROM sync_history').all() as any[];
    const result: Record<string, any> = {};
    for (const r of rows) {
      result[r.file_path] = r;
    }
    return result;
  }

  getSyncRecord(filePath: string): any {
    const db = this.getDb();
    return db.prepare('SELECT * FROM sync_history WHERE file_path = ?').get(filePath);
  }

  // --- Media Metadata ---
  getAllMediaMetadata(): Record<string, any> {
    const db = this.getDb();
    const rows = db.prepare(`
      SELECT m.id as media_id, m.file_path, m.file_name, md.*
      FROM media_items m
      LEFT JOIN media_metadata md ON m.id = md.media_id
    `).all() as any[];

    const result: Record<string, any> = {};
    for (const r of rows) {
      if (r.file_path) {
        result[r.file_path] = r;
      }
      if (r.file_name) {
        result[r.file_name.toLowerCase()] = r;
      }
    }
    return result;
  }

  // --- Face Counts & Face lists by file ---
  getFacesCountBySourceFile(): Record<string, number> {
    const db = this.getDb();
    const result: Record<string, number> = {};

    try {
      const mfRows = db.prepare(`
        SELECT m.file_path as source_file, COUNT(DISTINCT mf.face_id) as count
        FROM media_faces mf
        JOIN media_items m ON mf.media_id = m.id
        WHERE m.file_path IS NOT NULL AND m.file_path != ''
        GROUP BY m.file_path
      `).all() as any[];

      for (const r of mfRows) {
        result[r.source_file] = r.count;
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
        SELECT mf.media_id, mf.face_id, mf.person_id, mf.name, mf.confidence, mf.bbox, mf.image_path, mf.time_start, mf.time_end, m.file_path as source_file,
               COALESCE(mf.is_reference, fr.is_reference, 0) as is_reference
        FROM media_faces mf
        LEFT JOIN media_items m ON mf.media_id = m.id
        LEFT JOIN face_registry fr ON mf.face_id = fr.face_id
        ORDER BY mf.id ASC
      `).all() as any[];

      for (const r of mfRows) {
        const src = r.source_file || '';
        if (src) {
          if (!result[src]) {
            result[src] = [];
          }
          result[src].push(r);
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
      let rows = db.prepare(`
        SELECT mf.id, mf.media_id, mf.face_id, mf.person_id, mf.name, mf.confidence, mf.bbox, mf.image_path, mf.time_start, mf.time_end, m.file_path as source_file,
               COALESCE(mf.is_reference, fr.is_reference, 0) as is_reference
        FROM media_faces mf
        LEFT JOIN media_items m ON mf.media_id = m.id
        LEFT JOIN face_registry fr ON mf.face_id = fr.face_id
        WHERE LOWER(m.file_path) = LOWER(?) OR LOWER(m.file_path) LIKE ?
        ORDER BY mf.id ASC
      `).all(filePath, `%${baseName}`) as any[];

      if (rows.length > 0) {
        return rows;
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

      return rows;
    } catch {
      return [];
    }
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
    const personId = `person_${trimmed.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;

    const insertPerson = db.prepare('INSERT OR IGNORE INTO persons (id, name) VALUES (?, ?)');
    const updateRegistry = db.prepare('UPDATE face_registry SET name = ?, person_id = ?, is_reference = 1 WHERE face_id = ?');
    const updateMediaFaces = db.prepare('UPDATE media_faces SET name = ?, person_id = ? WHERE face_id = ?');

    const transaction = db.transaction(() => {
      insertPerson.run(personId, trimmed);
      updateRegistry.run(trimmed, personId, faceId);
      updateMediaFaces.run(trimmed, personId, faceId);
    });

    transaction();
    return true;
  }

  assignGroupToPerson(faceIds: string[], personName: string): boolean {
    const db = this.getDb();
    const trimmed = personName.trim();
    const personId = `person_${trimmed.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;

    const insertPerson = db.prepare('INSERT OR IGNORE INTO persons (id, name) VALUES (?, ?)');
    const updateRegistry = db.prepare('UPDATE face_registry SET name = ?, person_id = ?, is_reference = 1 WHERE face_id = ?');
    const updateMediaFaces = db.prepare('UPDATE media_faces SET name = ?, person_id = ? WHERE face_id = ?');

    const transaction = db.transaction(() => {
      insertPerson.run(personId, trimmed);
      for (const fid of faceIds) {
        updateRegistry.run(trimmed, personId, fid);
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
    const updateMediaFaces = db.prepare('UPDATE media_faces SET name = ?, person_id = NULL WHERE face_id = ?');

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
      WHERE LOWER(source_file) = LOWER(?) OR LOWER(source_file) LIKE ?
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
      INSERT INTO media_faces (face_id, person_id, name, confidence, source_file, created_at)
      VALUES (?, ?, ?, 1.0, ?, datetime('now', 'localtime'))
    `);

    const transaction = db.transaction(() => {
      insertPerson.run(personId, trimmed);
      insertMediaFace.run(syntheticFaceId, personId, trimmed, file);
    });

    transaction();
    return { face_id: syntheticFaceId, person_id: personId, name: trimmed, source_file: file };
  }

  removeFaceFromMediaFile(file: string, faceId: string): boolean {
    const db = this.getDb();
    const baseName = path.basename(file).toLowerCase();
    db.prepare(`
      DELETE FROM media_faces
      WHERE face_id = ? AND (LOWER(source_file) = LOWER(?) OR LOWER(source_file) LIKE ?)
    `).run(faceId, file, `%${baseName}`);
    return true;
  }
}
