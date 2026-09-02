import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('MediaViewerModal & Theme Adaptability', () => {
  it('should have dedicated MediaViewerModal component exported', async () => {
    const componentPath = path.resolve('src/components/MediaViewerModal.tsx');
    assert.ok(fs.existsSync(componentPath), 'MediaViewerModal.tsx should exist');

    const content = fs.readFileSync(componentPath, 'utf8');
    assert.ok(content.includes('export default function MediaViewerModal'), 'Must export MediaViewerModal component');
    assert.ok(content.includes('interface MediaViewerModalProps'), 'Must define MediaViewerModalProps interface');
    assert.ok(content.includes('useLanguage'), 'Must utilize i18n Language context');
    assert.ok(content.includes('useAuth'), 'Must utilize Auth context');
    assert.ok(content.includes('useVault'), 'Must utilize Vault context');
  });

  it('should have dedicated MediaViewerModal.css utilizing CSS theme variables', () => {
    const cssPath = path.resolve('src/components/MediaViewerModal.css');
    assert.ok(fs.existsSync(cssPath), 'MediaViewerModal.css should exist');

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
    const galleryPath = path.resolve('src/components/MediaGallery.tsx');
    const galleryContent = fs.readFileSync(galleryPath, 'utf8');

    assert.ok(galleryContent.includes('import MediaViewerModal from \'./MediaViewerModal\';'), 'MediaGallery must import MediaViewerModal');
    assert.ok(galleryContent.includes('<MediaViewerModal'), 'MediaGallery must render MediaViewerModal component');
    assert.ok(!galleryContent.includes('className="modal-card media-lightbox-card"'), 'MediaGallery must not render inline lightbox card markup');
  });
});
