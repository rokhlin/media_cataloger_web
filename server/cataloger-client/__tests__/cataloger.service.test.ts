import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CatalogerClientService } from '../cataloger.service.js';
import { AppConfigService } from '../../config/config.service.js';

describe('CatalogerClientService', () => {
  let catalogerService: CatalogerClientService;
  let tmpDir: string;
  let logFile: string;

  before(() => {
    tmpDir = path.join(process.cwd(), 'media_output', `test_cataloger_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    logFile = path.join(tmpDir, 'cataloger_run.log');

    const mockConfig = {
      catalogerApiUrl: 'http://127.0.0.1:59999', // Non-existent test port to test fallback behavior
      outputFolder: tmpDir,
    } as AppConfigService;

    catalogerService = new CatalogerClientService(mockConfig);
  });

  after(() => {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  it('should return idle fallback structure when cataloger service is offline', async () => {
    const status = await catalogerService.getStatus();
    assert.strictEqual(status.status, 'idle');
    assert.strictEqual(status.current_task, null);
    assert.ok(status.progress, 'progress object should exist');
    assert.strictEqual(status.progress.current, 0);
    assert.ok(status.progress.stage.includes('offline') || status.progress.stage.includes('idle'));
  });

  it('should read fallback logs from local file if remote service is offline', async () => {
    fs.writeFileSync(logFile, 'Line 1: Starting sync\nLine 2: Processed item_1\nLine 3: Complete');

    const logRes = await catalogerService.getLogs();
    assert.ok(logRes.logs.includes('Starting sync'));
    assert.ok(logRes.logs.includes('Processed item_1'));
  });

  it('should clear local logs file if remote service is offline', async () => {
    fs.writeFileSync(logFile, 'Some old logs to clear');
    assert.ok(fs.readFileSync(logFile, 'utf-8').length > 0);

    const clearRes = await catalogerService.clearLogs();
    assert.strictEqual(clearRes.status, 'success');
    assert.strictEqual(fs.readFileSync(logFile, 'utf-8'), '');
  });

  it('should throw error when triggering run on unreachable server', async () => {
    await assert.rejects(
      async () => {
        await catalogerService.triggerRun(true);
      },
      (err: Error) => {
        assert.ok(err.message.includes('Cataloger service error'));
        return true;
      }
    );
  });
});
