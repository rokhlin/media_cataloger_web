import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('FEAT-026: Person Profile Management & Family Tree Integration', () => {
  const modalFilePath = path.resolve('src/components/v2/modals/PersonProfileModal.tsx');
  const screenFilePath = path.resolve('src/components/v2/PeopleFacesScreen.tsx');
  const viewerFilePath = path.resolve('src/components/gallery/MediaViewerModal.tsx');
  const modelFilePath = path.resolve('src/models/face.ts');

  it('Requirement 1: PersonItem model must support extended profile fields and display_name', () => {
    assert.strictEqual(fs.existsSync(modelFilePath), true, 'face.ts model must exist');
    const content = fs.readFileSync(modelFilePath, 'utf-8');
    assert.match(content, /display_name\?:/);
    assert.match(content, /first_name\?:/);
    assert.match(content, /last_name\?:/);
    assert.match(content, /middle_name\?:/);
    assert.match(content, /maiden_name\?:/);
    assert.match(content, /nickname\?:/);
    assert.match(content, /is_living\?:/);
    assert.match(content, /birth_date\?:/);
    assert.match(content, /death_date\?:/);
    assert.match(content, /notes\?:/);
    assert.match(content, /bio\?:/);
  });

  it('Requirement 2: PeopleFacesScreen must decouple card click from photo count click', () => {
    assert.strictEqual(fs.existsSync(screenFilePath), true, 'PeopleFacesScreen.tsx must exist');
    const content = fs.readFileSync(screenFilePath, 'utf-8');

    // Card click opens profile modal
    assert.match(content, /setSelectedPersonForProfile\(person\)/, 'Clicking card must open PersonProfileModal');

    // Photo count badge preserves gallery filtering
    assert.match(content, /photo-count-badge/, 'Must have photo-count-badge element');
    assert.match(content, /navigate\(`\/photos\?person=\${encodeURIComponent\(person\.name\)}`\)/, 'Clicking photo count badge must filter gallery');

    // PersonProfileModal must be rendered
    assert.match(content, /<PersonProfileModal/, 'Must render PersonProfileModal component');
  });

  it('Requirement 3: PersonProfileModal must conditionally hide death fields when is_living is true', () => {
    assert.strictEqual(fs.existsSync(modalFilePath), true, 'PersonProfileModal.tsx must exist');
    const content = fs.readFileSync(modalFilePath, 'utf-8');

    // Death date & place must be wrapped in !isLiving condition
    assert.match(content, /!isLiving && \(/, 'Death date & place must be conditionally rendered only when !isLiving');
    assert.match(content, /Жив \(снять для ушедших\)/, 'Must have living toggle label');
    assert.match(content, /Заметки и пояснения/, 'Must render arbitrary notes/explanations field');
    assert.match(content, /setNotes/, 'Must bind notes input to state');
  });

  it('Requirement 4: PersonProfileModal must support tabs (main, tree, photos, bio) and Family Tree sync', () => {
    const content = fs.readFileSync(modalFilePath, 'utf-8');
    assert.match(content, /activeTab === 'main'/);
    assert.match(content, /activeTab === 'tree'/);
    assert.match(content, /activeTab === 'photos'/);
    assert.match(content, /activeTab === 'bio'/);

    // Family Tree linking & sync
    assert.match(content, /\/api\/family-tree\/persons/, 'Must load family tree members for linking');
    assert.match(content, /sync_tree:\s*syncTree/, 'Must send sync_tree flag in payload');
    assert.match(content, /\/api\/faces\/person-profile/, 'Must call /api/faces/person-profile endpoint');
  });

  it('Requirement 5: MediaViewerModal must display composed display_name (Фамилия Имя) in dropdowns', () => {
    assert.strictEqual(fs.existsSync(viewerFilePath), true, 'MediaViewerModal.tsx must exist');
    const content = fs.readFileSync(viewerFilePath, 'utf-8');

    // Check display_name usage in select options
    assert.match(content, /p\.display_name \|\| p\.name/, 'Dropdown options must use display_name composed fallback');
  });

  it('Requirement 6: PersonProfileModal must support auto-populating fields from linked or selected Family Tree person', () => {
    assert.strictEqual(fs.existsSync(modalFilePath), true, 'PersonProfileModal.tsx must exist');
    const content = fs.readFileSync(modalFilePath, 'utf-8');

    // Check handleApplyTreeData implementation
    assert.match(content, /handleApplyTreeData/, 'Must implement handleApplyTreeData function');
    assert.match(content, /Использовать данные из Древа|Populate from Tree/, 'Must have populate from tree button in main tab');
    assert.match(content, /Заполнить анкету из Древа|Populate profile from Tree/, 'Must have populate button in tree tab');
    assert.match(content, /importSuccessMessage/, 'Must support import confirmation toast/notification');
  });
});

