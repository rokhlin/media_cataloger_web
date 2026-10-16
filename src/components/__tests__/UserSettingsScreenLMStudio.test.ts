import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('UserSettingsScreen: Dynamic LM Studio Model Querying & Switching', () => {
  const root = path.resolve('.');
  const settingsPath = path.join(root, 'src', 'components', 'v2', 'UserSettingsScreen.tsx');

  it('1. UserSettingsScreen: must query /api/models/local for installed LM Studio models', () => {
    assert.ok(fs.existsSync(settingsPath), 'UserSettingsScreen.tsx must exist');
    const content = fs.readFileSync(settingsPath, 'utf-8');

    assert.ok(
      content.includes('/api/models/local'),
      'UserSettingsScreen must fetch models from /api/models/local'
    );
  });

  it('2. UserSettingsScreen: must render dynamic LM Studio models in select dropdown', () => {
    const content = fs.readFileSync(settingsPath, 'utf-8');

    assert.ok(
      content.includes('localModels.map'),
      'UserSettingsScreen must map localModels in options'
    );
    assert.ok(
      content.includes('Локальная модель LM Studio'),
      'UserSettingsScreen must label the local model selector clearly'
    );
  });

  it('3. UserSettingsScreen: must provide Refresh button and Custom model toggle', () => {
    const content = fs.readFileSync(settingsPath, 'utf-8');

    assert.ok(
      content.includes('fetchLocalModels'),
      'UserSettingsScreen must provide fetchLocalModels function'
    );
    assert.ok(
      content.includes('loadingLocalModels'),
      'UserSettingsScreen must manage loading state for local models'
    );
    assert.ok(
      content.includes('isCustomLocalModel'),
      'UserSettingsScreen must allow toggling custom model ID input'
    );
  });

  it('4. UserSettingsScreen: must support loading selected model into LM Studio memory via /api/models/local/load', () => {
    const content = fs.readFileSync(settingsPath, 'utf-8');

    assert.ok(
      content.includes('/api/models/local/load'),
      'UserSettingsScreen must call /api/models/local/load for preloading'
    );
    assert.ok(
      content.includes('handleLoadModelIntoRam') || content.includes('loadModelIntoRam'),
      'UserSettingsScreen must define model preloading handler'
    );
  });

  it('5. UserSettingsScreen: must display LM Studio connection status and RAM indicators', () => {
    const content = fs.readFileSync(settingsPath, 'utf-8');

    assert.ok(
      content.includes('isLmStudioConnected'),
      'UserSettingsScreen must track LM Studio connection status'
    );
    assert.ok(
      content.includes('isLoaded') || content.includes('В памяти RAM'),
      'UserSettingsScreen must display whether model is loaded in RAM'
    );
  });
});
