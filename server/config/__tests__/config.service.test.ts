import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AppConfigService } from '../config.service.js';

describe('AppConfigService', () => {
  let tmpDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  before(() => {
    originalEnv = { ...process.env };
    tmpDir = path.join(process.cwd(), 'media_output', `test_config_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  after(() => {
    process.env = originalEnv;
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  it('should initialize and return project defaults', () => {
    const config = new AppConfigService();
    assert.ok(config.projectRoot, 'projectRoot should be defined');
    assert.ok(typeof config.port === 'number', 'port should be a number');
    assert.ok(config.catalogerApiUrl, 'catalogerApiUrl should be defined');
    assert.ok(Array.isArray(config.inputFolders), 'inputFolders should be an array');
    assert.ok(config.outputFolder, 'outputFolder should be defined');
    assert.ok(config.dbPath, 'dbPath should be defined');
    assert.ok(config.facesFolder, 'facesFolder should be defined');
    assert.ok(config.supportedPhotoExts.has('.jpg'), 'should support .jpg');
    assert.ok(config.supportedVideoExts.has('.mp4'), 'should support .mp4');
  });

  it('should allow saving and retrieving custom settings', () => {
    const customSettingsFile = path.join(tmpDir, 'custom_settings.json');
    process.env.SETTINGS_PATH = customSettingsFile;

    const config = new AppConfigService();
    assert.strictEqual(config.settingsFilePath, customSettingsFile);

    const testInputFolders = [path.join(tmpDir, 'test_input')];
    const testOutputFolder = path.join(tmpDir, 'test_output');
    const additional = { MODEL_PROVIDER: 'local', GEMINI_MAX_WORKERS: 5 };

    config.saveSettings(testInputFolders, testOutputFolder, additional);

    const saved = config.getSavedSettings();
    assert.deepStrictEqual(saved.INPUT_FOLDERS, testInputFolders);
    assert.strictEqual(saved.OUTPUT_FOLDER, testOutputFolder);
    assert.strictEqual(saved.MODEL_PROVIDER, 'local');
    assert.strictEqual(saved.GEMINI_MAX_WORKERS, 5);
    assert.ok(saved.updated_at, 'updated_at timestamp should exist');
  });

  it('should preserve Windows UNC and drive paths without corrupting with relative root', () => {
    const customSettingsFile = path.join(tmpDir, 'unc_settings.json');
    process.env.SETTINGS_PATH = customSettingsFile;

    const config = new AppConfigService();
    const uncInputs = ['\\\\ZIMABOARD\\shares\\Photo', 'C:\\Media\\Pictures'];
    const uncOutput = '\\\\ZIMABOARD\\sda1\\media_cataloger';

    config.saveSettings(uncInputs, uncOutput);

    assert.deepStrictEqual(config.inputFolders, uncInputs);
    assert.strictEqual(config.outputFolder, uncOutput);
    assert.strictEqual(config.dbPath, '\\\\ZIMABOARD\\sda1\\media_cataloger\\config\\catalog_history.db');
  });
});
