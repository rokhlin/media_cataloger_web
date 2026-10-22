import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DatabaseService } from '../../database/database.service.js';
import { MediaService } from '../media.service.js';
import { AppConfigService } from '../../config/config.service.js';

describe('BUG-019: GPS Coordinates Persistence & Geotagged Media Hydration', () => {
  let tmpDir: string;
  let inputDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let mediaService: MediaService;

  before(() => {
    tmpDir = path.join(process.cwd(), 'media_output', `test_geomap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
    inputDir = path.join(tmpDir, 'photos');
    fs.mkdirSync(inputDir, { recursive: true });
    dbPath = path.join(tmpDir, 'test_geomap.db');

    const mockConfig = {
      dbPath: dbPath,
      inputFolders: [inputDir],
      outputFolder: tmpDir,
      projectRoot: tmpDir,
      supportedPhotoExts: new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic']),
      supportedVideoExts: new Set(['.mp4', '.mov']),
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
    } catch {}
  });

  it('1. DatabaseService: saveMediaMetadata & updateMediaMetadata must persist latitude & longitude', () => {
    const filePath = path.join(inputDir, 'almaty_mountains.jpg');
    fs.writeFileSync(filePath, 'fake-almaty-jpg');

    dbService.saveMediaMetadata(filePath, {
      media_type: 'image',
      summary: 'Medeu skating rink and mountains',
      location_name: 'Алматы, Медеу',
      latitude: 43.1575,
      longitude: 77.0589,
    });

    const persistedList = dbService.getAllPersistedMediaItems();
    const item = persistedList.find((i) => i.file_path === filePath);

    assert.ok(item, 'Item must exist in persisted list');
    assert.strictEqual(item.location_name, 'Алматы, Медеу');
    assert.strictEqual(typeof item.latitude, 'number', 'latitude must be saved as number');
    assert.strictEqual(item.latitude, 43.1575);
    assert.strictEqual(typeof item.longitude, 'number', 'longitude must be saved as number');
    assert.strictEqual(item.longitude, 77.0589);

    // Test updateMediaMetadata
    dbService.updateMediaMetadata(filePath, {
      latitude: 43.2389,
      longitude: 76.8897,
      location_name: 'Алматы Центр',
    });

    const updatedList = dbService.getAllPersistedMediaItems();
    const updatedItem = updatedList.find((i) => i.file_path === filePath);
    assert.strictEqual(updatedItem.latitude, 43.2389);
    assert.strictEqual(updatedItem.longitude, 76.8897);
    assert.strictEqual(updatedItem.location_name, 'Алматы Центр');
  });

  it('2. MediaService: must extract GPS coordinates from sidecar JSON files during scan and persist them', async () => {
    const photoPath = path.join(inputDir, 'rome_colosseum.jpg');
    fs.writeFileSync(photoPath, 'fake-rome-photo');

    const sidecarPath = path.join(inputDir, 'rome_colosseum.json');
    fs.writeFileSync(
      sidecarPath,
      JSON.stringify({
        summary: 'Colosseum in Rome on a sunny day',
        location_name: 'Рим, Колизей',
        gps: {
          latitude: 41.8902,
          longitude: 12.4922,
        },
      })
    );

    // Invalidate cache and scan
    mediaService.invalidateCache();
    const result = await mediaService.listMediaFiles({ limit: 50, refresh: true });

    const romeItem = result.files.find((f: any) => f.filename === 'rome_colosseum.jpg' || f.file_path === photoPath);
    assert.ok(romeItem, 'rome_colosseum.jpg must be discovered in media files');
    assert.strictEqual(romeItem.latitude, 41.8902, 'romeItem must have latitude 41.8902');
    assert.strictEqual(romeItem.longitude, 12.4922, 'romeItem must have longitude 12.4922');
    assert.strictEqual(romeItem.location_name, 'Рим, Колизей');
  });

  it('3. MediaService: hydrateItemsFromPersisted must preserve latitude & longitude for client cache', async () => {
    // Invalidate in-memory cache and fetch directly (hydrates from SQLite)
    mediaService.invalidateCache();
    const res = await mediaService.listMediaFiles({ limit: 10 });
    const almatyItem = res.files.find((f: any) => f.filename === 'almaty_mountains.jpg');

    assert.ok(almatyItem, 'almaty item must be returned from database hydration');
    assert.strictEqual(almatyItem.latitude, 43.2389);
    assert.strictEqual(almatyItem.longitude, 76.8897);
    assert.strictEqual(almatyItem.location_name, 'Алматы Центр');
  });
});
