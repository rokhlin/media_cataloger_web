import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Family Tree Settings & UI Features', () => {
  const componentsDir = path.resolve(__dirname, '..');

  it('should verify TreeSettingsTab.tsx exists and contains all 5 configuration sections', () => {
    const settingsPath = path.join(componentsDir, 'settings', 'TreeSettingsTab.tsx');
    assert.ok(fs.existsSync(settingsPath), 'TreeSettingsTab.tsx should exist');

    const content = fs.readFileSync(settingsPath, 'utf8');

    // 1. Tree Node View Style
    assert.ok(content.includes('Tree Node View Style'), 'Should contain Tree Node View Style section');
    assert.ok(content.includes('setNodeViewStyle(\'default\')'), 'Should allow default style');
    assert.ok(content.includes('setNodeViewStyle(\'circle\')'), 'Should allow circle style');
    assert.ok(content.includes('setNodeViewStyle(\'square\')'), 'Should allow square style');

    // 2. Celebration Badges
    assert.ok(content.includes('Celebration & Milestone Badges'), 'Should contain Celebration Badges section');
    assert.ok(content.includes('celebrationConfig'), 'Should use celebrationConfig');
    assert.ok(content.includes('daysThreshold'), 'Should configure daysThreshold');
    assert.ok(content.includes('showBirthday'), 'Should configure showBirthday');
    assert.ok(content.includes('showAnniversary'), 'Should configure showAnniversary');
    assert.ok(content.includes('showMemorial'), 'Should configure showMemorial');

    // 3. Date Formats & Display
    assert.ok(content.includes('Date Formats & Date Picker Configuration'), 'Should contain Date Formats section');
    assert.ok(content.includes('setDateFormatStyle'), 'Should configure dateFormatStyle');
    assert.ok(content.includes('YYYY-MM-DD'), 'Should support YYYY-MM-DD');
    assert.ok(content.includes('DD Month YYYY'), 'Should support DD Month YYYY');
    assert.ok(content.includes('DD.MM.YYYY'), 'Should support DD.MM.YYYY');
    assert.ok(content.includes('MM/DD/YYYY'), 'Should support MM/DD/YYYY');

    // 4. Life Facts & Relatives Filtering
    assert.ok(content.includes('Person Life Facts & Relatives Filtering'), 'Should contain Life Facts configuration section');
    assert.ok(content.includes('showOwnFacts'), 'Should configure showOwnFacts');
    assert.ok(content.includes('showParentsFacts'), 'Should configure showParentsFacts');
    assert.ok(content.includes('showSiblingsFacts'), 'Should configure showSiblingsFacts');
    assert.ok(content.includes('showChildrenFacts'), 'Should configure showChildrenFacts');
    assert.ok(content.includes('showGrandparentsFacts'), 'Should configure showGrandparentsFacts');
    assert.ok(content.includes('showSpousesFacts'), 'Should configure showSpousesFacts');
    assert.ok(content.includes('includedFactTypes'), 'Should configure includedFactTypes');

    // 5. CSV Export & Import
    assert.ok(content.includes('Export & Import Family Tree (.csv)'), 'Should contain CSV section');
    assert.ok(content.includes('exportTreeToCSV'), 'Should call exportTreeToCSV');
    assert.ok(content.includes('parseTreeFromCSV'), 'Should call parseTreeFromCSV');
    assert.ok(content.includes('getSampleTreeCSV'), 'Should provide sample CSV');
  });

  it('should verify FamilyTreeTab.tsx renders subtab switcher for Tree and Settings', () => {
    const tabPath = path.join(componentsDir, 'FamilyTreeTab.tsx');
    const content = fs.readFileSync(tabPath, 'utf8');

    assert.ok(content.includes('TreeSettingsTab'), 'FamilyTreeTab should import TreeSettingsTab');
    assert.ok(content.includes('subtab-family-tree-canvas'), 'FamilyTreeTab should have Interactive Tree subtab');
    assert.ok(content.includes('subtab-family-tree-settings'), 'FamilyTreeTab should have Tree Settings subtab');
    assert.ok(content.includes('activeSubTab === \'settings\''), 'FamilyTreeTab should toggle TreeSettingsTab');
  });

  it('should verify CanvasToolbar.tsx has a shortcut to open Tree Settings', () => {
    const toolbarPath = path.join(componentsDir, 'canvas', 'controls', 'CanvasToolbar.tsx');
    const content = fs.readFileSync(toolbarPath, 'utf8');

    assert.ok(content.includes('toolbar-tree-settings-btn'), 'CanvasToolbar should have Settings button');
    assert.ok(content.includes('setActiveSubTab(\'settings\')'), 'Clicking Settings button should open settings');
  });

  it('should verify PersonCardNode.tsx renders spouse details and click action', () => {
    const nodePath = path.join(componentsDir, 'canvas', 'nodes', 'PersonCardNode.tsx');
    const content = fs.readFileSync(nodePath, 'utf8');

    assert.ok(content.includes('renderSpouseBadge'), 'PersonCardNode should have renderSpouseBadge');
    assert.ok(content.includes('openDrawer(\'family\', person.id)'), 'Clicking spouse badge should open drawer family tab');
    assert.ok(content.includes('DIVORCED'), 'Should support DIVORCED spouse distinction');
  });

  it('should verify PersonTimelineView.tsx aggregates relatives life facts when enabled', () => {
    const timelinePath = path.join(componentsDir, 'timeline', 'PersonTimelineView.tsx');
    const content = fs.readFileSync(timelinePath, 'utf8');

    assert.ok(content.includes('relativeEvents'), 'PersonTimelineView should track relativeEvents');
    assert.ok(content.includes('showParentsFacts'), 'PersonTimelineView should check showParentsFacts');
    assert.ok(content.includes('showChildrenFacts'), 'PersonTimelineView should check showChildrenFacts');
  });
});
