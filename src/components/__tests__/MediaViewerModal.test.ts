import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('MediaViewerModal & Theme Adaptability', () => {
  it('should have dedicated MediaViewerModal component exported', async () => {
    const componentPath = path.resolve('src/components/gallery/MediaViewerModal.tsx');
    assert.ok(fs.existsSync(componentPath), 'MediaViewerModal.tsx should exist in gallery folder');

    const content = fs.readFileSync(componentPath, 'utf8');
    assert.ok(content.includes('export default function MediaViewerModal'), 'Must export MediaViewerModal component');
    assert.ok(content.includes('interface MediaViewerModalProps'), 'Must define MediaViewerModalProps interface');
    assert.ok(content.includes('useLanguage'), 'Must utilize i18n Language context');
    assert.ok(content.includes('useAuth'), 'Must utilize Auth context');
    assert.ok(content.includes('useVault'), 'Must utilize Vault context');
  });

  it('should have dedicated MediaViewerModal.css utilizing CSS theme variables', () => {
    const cssPath = path.resolve('src/components/gallery/MediaViewerModal.css');
    assert.ok(fs.existsSync(cssPath), 'MediaViewerModal.css should exist in gallery folder');

    const cssContent = fs.readFileSync(cssPath, 'utf8');
    // Ensure it uses theme variables for background, text, and borders
    assert.ok(cssContent.includes('var(--modal-bg'), 'Media lightbox card must use var(--modal-bg)');
    assert.ok(cssContent.includes('var(--card-bg'), 'Media lightbox sidebar must use var(--card-bg)');
    assert.ok(cssContent.includes('var(--text-primary'), 'Media lightbox must use var(--text-primary)');
    assert.ok(cssContent.includes('var(--border-color'), 'Media lightbox must use var(--border-color)');
    assert.ok(cssContent.includes('var(--nav-tab-bg'), 'Media lightbox header/footer must use var(--nav-tab-bg)');

    // Ensure no hardcoded dark backgrounds on the main card or sidebar
    assert.ok(!cssContent.includes('background: rgba(13, 17, 28, 0.96);'), 'Should not have hardcoded dark background on card');
    assert.ok(!cssContent.includes('background: rgba(17, 24, 39, 0.75);'), 'Should not have hardcoded dark background on sidebar');
  });

  it('should verify MediaGallery utilizes MediaViewerModal and does not duplicate modal JSX', () => {
    const galleryPath = path.resolve('src/components/gallery/MediaGallery.tsx');
    const galleryContent = fs.readFileSync(galleryPath, 'utf8');

    assert.ok(galleryContent.includes('import MediaViewerModal from \'./MediaViewerModal\';'), 'MediaGallery must import MediaViewerModal');
    assert.ok(galleryContent.includes('<MediaViewerModal'), 'MediaGallery must render MediaViewerModal component');
    assert.ok(!galleryContent.includes('className="modal-card media-lightbox-card"'), 'MediaGallery must not render inline lightbox card markup');
  });

  it('should verify MediaViewerModal restricts btnEditMetadata to PROCESSED media and canEdit', () => {
    const modalPath = path.resolve('src/components/gallery/MediaViewerModal.tsx');
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.ok(
      content.includes("canEdit && selectedMedia.status === 'PROCESSED'"),
      'btnEditMetadata must strictly require canEdit and selectedMedia.status === "PROCESSED"'
    );
  });

  it('should verify MediaViewerModal restricts vault actions strictly to admin users', () => {
    const modalPath = path.resolve('src/components/gallery/MediaViewerModal.tsx');
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.ok(
      content.includes('{isAdmin && ('),
      'Vault actions (add/remove) must be guarded strictly by isAdmin'
    );
    assert.ok(
      !content.includes('(canEdit || isUnlocked || isAdmin) && ('),
      'Vault actions must not allow regular editors or non-admin unlocked sessions'
    );
  });

  it('should verify MediaViewerModal disables btnAnalyzeFile when AI Engine is offline', () => {
    const modalPath = path.resolve('src/components/gallery/MediaViewerModal.tsx');
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.ok(content.includes('isEngineConnected'), 'MediaViewerModal must declare isEngineConnected prop');
    assert.ok(
      content.includes('disabled={disabled || isAnalyzing || !isEngineConnected || !engineOnline}'),
      'btnAnalyzeFile must be disabled when isEngineConnected or engineOnline is false or isAnalyzing'
    );
    assert.ok(
      content.includes('aiEngineOfflineTooltip'),
      'btnAnalyzeFile must display aiEngineOfflineTooltip when disconnected'
    );
  });

  it('should verify MetadataEditorModal uses active overlay and authFetch', () => {
    const editorPath = path.resolve('src/components/gallery/MetadataEditorModal.tsx');
    const content = fs.readFileSync(editorPath, 'utf8');

    assert.ok(
      content.includes('className="modal-overlay active"'),
      'MetadataEditorModal must render with active overlay class'
    );
    assert.ok(
      content.includes('authFetch || fetch'),
      'MetadataEditorModal must use authFetch to persist metadata'
    );
  });

  it('should verify MediaViewerModal dynamically updates Family Tree Kinship on scope & tree mutations', () => {
    const modalPath = path.resolve('src/components/gallery/MediaViewerModal.tsx');
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.ok(content.includes('useFamilyTreeStore'), 'MediaViewerModal must use useFamilyTreeStore');
    assert.ok(content.includes('galleryKinshipFactsConfig'), 'MediaViewerModal must subscribe to galleryKinshipFactsConfig');
    assert.ok(content.includes('treeDataVersion'), 'MediaViewerModal must subscribe to treeDataVersion');
    assert.ok(content.includes('/api/family-tree/public/photo-kinship'), 'MediaViewerModal must query /api/family-tree/public/photo-kinship');
    assert.ok(content.includes('family_tree_updated'), 'MediaViewerModal must listen for family_tree_updated window event');
    assert.ok(content.includes('gallery_facts_scope: galleryKinshipFactsConfig.scope'), 'MediaViewerModal must pass active gallery_facts_scope');
    assert.ok(content.includes('seenCoupleKeys'), 'MediaViewerModal must deduplicate reciprocal couple partnership titles');
    assert.ok(content.includes('CATEGORY_ICONS'), 'MediaViewerModal must have category icons for timeline categories');
    assert.ok(content.includes('CATEGORY_COLORS'), 'MediaViewerModal must have category colors for timeline categories');
    assert.ok(content.includes('lightbox-family-milestones-list'), 'MediaViewerModal must render scrollable list of timeline facts');
    assert.ok(content.includes('ms.description'), 'MediaViewerModal must render fact descriptions if present');
    assert.ok(content.includes('ms.location'), 'MediaViewerModal must render fact locations if present');
  });
});

