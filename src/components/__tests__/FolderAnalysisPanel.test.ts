import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('FolderAnalysisPanel - Analysis Categories, Folder Selection, and i18n', () => {
  it('should verify translations contain sectionMediaAnalysis and analysis categories in both EN and RU', () => {
    const translationsPath = path.resolve('src/i18n/translations.ts');
    assert.ok(fs.existsSync(translationsPath), 'translations.ts should exist');

    const content = fs.readFileSync(translationsPath, 'utf8');

    // Key existence checks
    assert.ok(content.includes("sectionMediaAnalysis: 'Media Analysis'"), 'Must have EN sectionMediaAnalysis');
    assert.ok(content.includes("sectionMediaAnalysis: 'Анализ медиа'"), 'Must have RU sectionMediaAnalysis');
    assert.ok(content.includes('sectionDuplicatesManager:'), 'Must have sectionDuplicatesManager');
    assert.ok(content.includes('categoryVision:'), 'Must have categoryVision key');
    assert.ok(content.includes('categoryFaces:'), 'Must have categoryFaces key');
    assert.ok(content.includes('categoryDuplicates:'), 'Must have categoryDuplicates key');
    assert.ok(content.includes('categoryTranscribe:'), 'Must have categoryTranscribe key');
    assert.ok(content.includes('analysisCategories:'), 'Must have analysisCategories key');
  });

  it('should verify DuplicatesManagerTab renders localized subtab button with sectionMediaAnalysis', () => {
    const tabPath = path.resolve('src/components/duplicates/DuplicatesManagerTab.tsx');
    assert.ok(fs.existsSync(tabPath), 'DuplicatesManagerTab.tsx should exist');

    const content = fs.readFileSync(tabPath, 'utf8');
    assert.ok(
      content.includes("t('sectionMediaAnalysis' as any)"),
      'DuplicatesManagerTab must translate sectionMediaAnalysis'
    );
    assert.ok(
      content.includes("t('sectionDuplicatesManager' as any)"),
      'DuplicatesManagerTab must translate sectionDuplicatesManager'
    );
  });

  it('should verify FolderAnalysisPanel includes category checkboxes, default selection, and mode parameters', () => {
    const panelPath = path.resolve('src/components/duplicates/FolderAnalysisPanel.tsx');
    assert.ok(fs.existsSync(panelPath), 'FolderAnalysisPanel.tsx should exist');

    const content = fs.readFileSync(panelPath, 'utf8');

    // Categories definition
    assert.ok(content.includes("'vision'"), 'Must include vision mode');
    assert.ok(content.includes("'faces'"), 'Must include faces mode');
    assert.ok(content.includes("'duplicates'"), 'Must include duplicates mode');
    assert.ok(content.includes("'transcribe'"), 'Must include transcribe mode');

    // Default initialization with all categories enabled
    assert.ok(
      content.includes("new Set(['vision', 'faces', 'duplicates', 'transcribe'])"),
      'All 4 analysis modes must be enabled by default'
    );

    // Mode toggling and controls
    assert.ok(content.includes('handleToggleMode'), 'Must define handleToggleMode');
    assert.ok(content.includes('handleSelectAllModes'), 'Must define handleSelectAllModes');
    assert.ok(content.includes('handleDeselectAllModes'), 'Must define handleDeselectAllModes');

    // Sending modes to backend
    assert.ok(content.includes('modes: targetModesArray'), 'Payload must pass selected modes');
    assert.ok(content.includes('modesQuery'), 'Query string must pass modes');
    assert.ok(content.includes('folders: targetFoldersArray'), 'Payload must pass selected folders');
  });
});
