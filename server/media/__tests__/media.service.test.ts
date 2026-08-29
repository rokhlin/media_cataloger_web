import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MediaService } from '../media.service.js';
import { DatabaseService } from '../../database/database.service.js';
import { AppConfigService } from '../../config/config.service.js';

describe('MediaService', () => {
  let mediaService: MediaService;
  let dbService: DatabaseService;
  let tmpDir: string;
  let inputDir: string;
  let dbPath: string;

  before(() => {
    tmpDir = path.join(process.cwd(), 'media_output', `test_media_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
    inputDir = path.join(tmpDir, 'input_photos');
    fs.mkdirSync(inputDir, { recursive: true });
    dbPath = path.join(tmpDir, 'test_media.db');

    // Create test files
    fs.writeFileSync(path.join(inputDir, 'vacation.jpg'), 'fake-image-data');
    fs.writeFileSync(path.join(inputDir, 'clip.mp4'), 'fake-video-data');
    fs.writeFileSync(path.join(inputDir, 'notes.txt'), 'text data'); // Should be ignored

    // Create subfolder
    const subDir = path.join(inputDir, '2024');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'beach.png'), 'fake-png-data');

    // Create ignored folder
    const pycache = path.join(inputDir, '__pycache__');
    fs.mkdirSync(pycache, { recursive: true });
    fs.writeFileSync(path.join(pycache, 'ignored.jpg'), 'ignored-image');

    const mockConfig = {
      dbPath: dbPath,
      inputFolders: [inputDir],
      outputFolder: tmpDir,
      projectRoot: tmpDir,
      supportedPhotoExts: new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic']),
      supportedVideoExts: new Set(['.mp4', '.mov', '.avi', '.mkv']),
    } as unknown as AppConfigService;

    dbService = new DatabaseService(mockConfig);
    dbService.initDb();

    mediaService = new MediaService(mockConfig, dbService);
  });

  after(() => {
    try {
      dbService.close();
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  it('should scan input folders filtering supported media extensions and ignoring excluded directories', () => {
    const scanned = mediaService.scanInputFolders();
    const filenames = scanned.map((s) => path.basename(s.filePath));

    assert.ok(filenames.includes('vacation.jpg'), 'Should include vacation.jpg');
    assert.ok(filenames.includes('clip.mp4'), 'Should include clip.mp4');
    assert.ok(filenames.includes('beach.png'), 'Should include beach.png from subfolder');
    assert.strictEqual(filenames.includes('notes.txt'), false, 'Should ignore notes.txt');
    assert.strictEqual(filenames.includes('ignored.jpg'), false, 'Should ignore files in __pycache__');
  });

  it('should list media files and associate with database records', async () => {
    const db = dbService.getDb();
    const vacationPath = path.join(inputDir, 'vacation.jpg');

    db.prepare(`
      INSERT INTO sync_history (file_path, file_size, mtime, status, sidecar_path)
      VALUES (?, ?, ?, ?, ?)
    `).run(vacationPath, 15, 1700000000, 'COMPLETED', '/output/vacation.json');

    db.prepare(`
      INSERT INTO media_items (id, file_path, file_name, media_type, file_size, media_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('item_vacation', vacationPath, 'vacation.jpg', 'photo', 15, '2024-07-01');

    db.prepare(`
      INSERT INTO media_metadata (media_id, summary, location_name)
      VALUES (?, ?, ?)
    `).run('item_vacation', 'Sunny beach vacation', 'Malibu');

    const result = await mediaService.listMediaFiles();
    assert.ok(Array.isArray(result.files), 'Result should contain files array');
    assert.ok(result.files.length >= 3, 'Should list scanned files');

    const vacationItem = result.files.find((f: any) => f.filename === 'vacation.jpg');
    assert.ok(vacationItem, 'vacation.jpg should be found');
    assert.strictEqual(vacationItem.status, 'COMPLETED');
    assert.strictEqual(vacationItem.summary, 'Sunny beach vacation');
    assert.strictEqual(vacationItem.is_image, true);
  });
});
