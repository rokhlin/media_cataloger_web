import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { MediaService } from '../media.service.js';
import { DatabaseService } from '../../database/database.service.js';
import { AppConfigService } from '../../config/config.service.js';

describe('Media Editing Suite (FEAT-030: Crop, Scale, Rotate, Style Transfer)', () => {
  let mediaService: MediaService;
  let dbService: DatabaseService;
  let tmpDir: string;
  let inputDir: string;
  let dbPath: string;
  let testPhotoPath: string;

  before(async () => {
    tmpDir = path.join(process.cwd(), 'media_output', `test_edit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
    inputDir = path.join(tmpDir, 'photos');
    fs.mkdirSync(inputDir, { recursive: true });
    dbPath = path.join(tmpDir, 'test_edit.db');

    testPhotoPath = path.join(inputDir, 'landscape_4k.jpg');
    // Create a real valid 200x100 test image using sharp
    await sharp({
      create: {
        width: 200,
        height: 100,
        channels: 3,
        background: { r: 120, g: 180, b: 240 },
      },
    })
      .jpeg()
      .toFile(testPhotoPath);

    const mockConfig = {
      dbPath: dbPath,
      inputFolders: [inputDir],
      outputFolder: tmpDir,
      projectRoot: tmpDir,
      supportedPhotoExts: new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']),
      supportedVideoExts: new Set(['.mp4', '.mov', '.avi']),
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

  it('1. should crop and downscale image as a new copy by default', async () => {
    const result = await mediaService.cropAndScaleImage({
      filePath: testPhotoPath,
      crop: { left: 10, top: 10, width: 80, height: 80 },
      targetResolution: { width: 50, height: 50 },
      saveAsCopy: true,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isCopy, true);
    assert.ok(result.filename.includes('_edited'));
    assert.ok(fs.existsSync(result.filePath));

    // Verify cropped dimensions
    const meta = await sharp(result.filePath).metadata();
    assert.strictEqual(meta.width, 50);
    assert.strictEqual(meta.height, 50);

    // Verify original remains intact
    const origMeta = await sharp(testPhotoPath).metadata();
    assert.strictEqual(origMeta.width, 200);
    assert.strictEqual(origMeta.height, 100);
  });

  it('2. should crop and downscale image in-place (overwrite)', async () => {
    // Create a separate file to overwrite
    const overwritePath = path.join(inputDir, 'photo_to_overwrite.jpg');
    await sharp({
      create: {
        width: 150,
        height: 150,
        channels: 3,
        background: { r: 50, g: 200, b: 100 },
      },
    })
      .jpeg()
      .toFile(overwritePath);

    const result = await mediaService.cropAndScaleImage({
      filePath: overwritePath,
      crop: { left: 0, top: 0, width: 100, height: 100 },
      targetResolution: { width: 80, height: 80 },
      saveAsCopy: false,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isCopy, false);
    assert.strictEqual(result.filePath, overwritePath);

    const meta = await sharp(overwritePath).metadata();
    assert.strictEqual(meta.width, 80);
    assert.strictEqual(meta.height, 80);
  });

  it('3. should apply style transfer preset and generate styled copy', async () => {
    const result = await mediaService.applyStyleTransfer({
      filePath: testPhotoPath,
      presetId: 'hollywood_warm',
      saveAsCopy: true,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isCopy, true);
    assert.strictEqual(result.presetId, 'hollywood_warm');
    assert.ok(fs.existsSync(result.filePath));

    const meta = await sharp(result.filePath).metadata();
    assert.strictEqual(meta.format, 'jpeg');
  });

  it('4. should apply B&W high-contrast Tri-X style transfer preset', async () => {
    const result = await mediaService.applyStyleTransfer({
      filePath: testPhotoPath,
      presetId: 'kodak_tri_x',
      saveAsCopy: true,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isCopy, true);
    assert.ok(fs.existsSync(result.filePath));
  });

  it('5. should rotate image by 90 degrees and update orientation', async () => {
    const rotPath = path.join(inputDir, 'rot_sample.jpg');
    await sharp({
      create: { width: 120, height: 60, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .jpeg()
      .toFile(rotPath);

    const result = await mediaService.rotateImage(rotPath, 90);
    assert.strictEqual(result.success, true);

    const meta = await sharp(rotPath).metadata();
    assert.strictEqual(meta.width, 60);
    assert.strictEqual(meta.height, 120);
  });

  it('6. should crop image in circular mode and save as PNG copy with transparency (CR-001)', async () => {
    const result = await mediaService.cropAndScaleImage({
      filePath: testPhotoPath,
      crop: { left: 20, top: 10, width: 60, height: 60 },
      targetResolution: { width: 50, height: 50 },
      shape: 'circle',
      saveAsCopy: true,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isCopy, true);
    assert.ok(result.filename.endsWith('.png'), 'Circular crop copy should be saved as PNG for transparency');
    assert.ok(fs.existsSync(result.filePath));

    const meta = await sharp(result.filePath).metadata();
    assert.strictEqual(meta.width, 50);
    assert.strictEqual(meta.height, 50);
    assert.strictEqual(meta.channels, 4, 'PNG should have 4 channels including alpha transparency');
    assert.strictEqual(meta.hasAlpha, true);
  });

  it('7. should crop image in circular mode with in-place overwrite flattening background (CR-001)', async () => {
    const circleOverwritePath = path.join(inputDir, 'photo_circle_overwrite.jpg');
    await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 10, g: 100, b: 200 } },
    })
      .jpeg()
      .toFile(circleOverwritePath);

    const result = await mediaService.cropAndScaleImage({
      filePath: circleOverwritePath,
      crop: { left: 10, top: 10, width: 80, height: 80 },
      shape: 'circle',
      saveAsCopy: false,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isCopy, false);
    assert.strictEqual(result.filePath, circleOverwritePath);

    const meta = await sharp(circleOverwritePath).metadata();
    assert.strictEqual(meta.width, 80);
    assert.strictEqual(meta.height, 80);
    assert.strictEqual(meta.format, 'jpeg');
  });
});

