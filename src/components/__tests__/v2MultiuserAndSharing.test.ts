import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webSrcDir = path.resolve(__dirname, '../..');

describe('BUG-002: Multi-User Isolation, Cookie Sessions, Shared Albums & Search Consolidation', () => {

  it('1. Cookie Session Management: authContext must use cookie-based session storage', () => {
    const authContextPath = path.join(webSrcDir, 'services', 'authContext.tsx');
    assert.ok(fs.existsSync(authContextPath), 'authContext.tsx must exist');
    const content = fs.readFileSync(authContextPath, 'utf-8');

    // Must handle cookies for media_cataloger_session
    assert.ok(
      content.includes('media_cataloger_session') || content.includes('cookieSession') || content.includes('document.cookie'),
      'authContext.tsx must utilize cookie-based session persistence (media_cataloger_session)'
    );
    assert.ok(
      content.includes('clearCache') || content.includes('mediaCacheService'),
      'authContext.tsx must clear media cache on logout or user switch'
    );
  });

  it('2. Cache Purge: MediaCacheService must provide clearCache() to isolate user data', async () => {
    const mediaCachePath = path.join(webSrcDir, 'services', 'mediaCacheService.ts');
    assert.ok(fs.existsSync(mediaCachePath), 'mediaCacheService.ts must exist');
    const content = fs.readFileSync(mediaCachePath, 'utf-8');

    assert.ok(
      content.includes('clearCache'),
      'MediaCacheService must implement clearCache() to purge previous user gallery data on logout/switch'
    );
  });

  it('3. TopNavBar: must render Login button when logged out and support Ctrl+K search shortcut', () => {
    const topNavPath = path.join(webSrcDir, 'components', 'layout', 'TopNavBar.tsx');
    assert.ok(fs.existsSync(topNavPath), 'TopNavBar.tsx must exist');
    const content = fs.readFileSync(topNavPath, 'utf-8');

    // Must have a Login link/button for unauthenticated state
    assert.ok(
      content.includes('/login') && (content.includes('Войти') || content.includes('Вход')),
      'TopNavBar must render a clear "Войти" (Login) button when user is unauthenticated or logged out'
    );

    // Must handle Ctrl+K / Cmd+K shortcut
    assert.ok(
      (content.includes('ctrlKey') || content.includes('metaKey')) && content.includes("'k'"),
      'TopNavBar must handle Ctrl+K / Cmd+K keyboard shortcut to focus search'
    );

    // Setup wizard should NOT be in the TopNavBar dropdown
    assert.ok(
      !content.includes('Мастер настройки (С нуля)'),
      'TopNavBar must not contain "Мастер настройки (С нуля)" in user dropdown'
    );
  });

  it('4. Setup Wizard Relocation: LeftNavSidebar and StatusBar must not show Setup Wizard by default', () => {
    const sidebarPath = path.join(webSrcDir, 'components', 'layout', 'LeftNavSidebar.tsx');
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');
    assert.ok(
      !sidebarContent.includes('Мастер настройки'),
      'LeftNavSidebar must not display "Мастер настройки"'
    );

    const statusBarPath = path.join(webSrcDir, 'components', 'layout', 'StatusBar.tsx');
    const statusBarContent = fs.readFileSync(statusBarPath, 'utf-8');
    assert.ok(
      !statusBarContent.includes('Мастер настройки'),
      'StatusBar must not display "Мастер настройки"'
    );

    // Must be relocated into UserSettingsScreen
    const settingsPath = path.join(webSrcDir, 'components', 'v2', 'UserSettingsScreen.tsx');
    const settingsContent = fs.readFileSync(settingsPath, 'utf-8');
    assert.ok(
      settingsContent.includes('Мастер') && settingsContent.includes('/onboarding'),
      'UserSettingsScreen must contain the Setup Wizard card linking to /onboarding'
    );
  });

  it('5. Status Bar Scope: StatusBar must suppress idle ready badge on non-gallery routes', () => {
    const statusBarPath = path.join(webSrcDir, 'components', 'layout', 'StatusBar.tsx');
    const content = fs.readFileSync(statusBarPath, 'utf-8');

    // Must inspect location and suppress when not on gallery
    assert.ok(
      content.includes('useLocation') || content.includes('location.pathname'),
      'StatusBar must use route location to conditionally render the idle status bar'
    );
    assert.ok(
      content.includes('/photos') || content.includes("location.pathname === '/'"),
      'StatusBar must verify route is gallery before showing idle ready badge'
    );
  });

  it('6. Gallery Search Deduplication: GalleryPage must not duplicate the global search bar', () => {
    const galleryPath = path.join(webSrcDir, 'components', 'gallery', 'GalleryPage.tsx');
    const content = fs.readFileSync(galleryPath, 'utf-8');

    // Should NOT have an internal search input with "Поиск в галерее" or duplicate search input
    assert.ok(
      !content.includes('Поиск в галерее'),
      'GalleryPage must not have a duplicate "Поиск в галерее" input'
    );
  });

  it('7. Virtual Albums & Public Sharing: virtualAlbumService must manage albums and public links', () => {
    const servicePath = path.join(webSrcDir, 'services', 'virtualAlbumService.ts');
    assert.ok(fs.existsSync(servicePath), 'virtualAlbumService.ts must exist');
    const content = fs.readFileSync(servicePath, 'utf-8');

    assert.ok(content.includes('createAlbum') || content.includes('saveAlbum'), 'virtualAlbumService must support creating albums');
    assert.ok(content.includes('shareToken') || content.includes('shareUrl'), 'virtualAlbumService must support share token / link generation');
    assert.ok(content.includes('getAlbumByShareToken'), 'virtualAlbumService must support resolving album by public share token without auth');
  });

  it('8. Public Route & Shared Screens: PublicSharedAlbumView and SharedScreen integration', () => {
    const publicViewPath = path.join(webSrcDir, 'components', 'v2', 'PublicSharedAlbumView.tsx');
    assert.ok(fs.existsSync(publicViewPath), 'PublicSharedAlbumView.tsx must exist for unauthenticated viewers');

    const routerPath = path.join(webSrcDir, 'AppRouter.tsx');
    const routerContent = fs.readFileSync(routerPath, 'utf-8');
    assert.ok(
      routerContent.includes('/shared/:token') || routerContent.includes('/shared/:id'),
      'AppRouter must include public route for shared albums'
    );

    const sharedScreenPath = path.join(webSrcDir, 'components', 'v2', 'SharedScreen.tsx');
    const sharedContent = fs.readFileSync(sharedScreenPath, 'utf-8');
    assert.ok(
      !sharedContent.includes('Семейный архив 2024') || sharedContent.includes('virtualAlbumService') || sharedContent.includes('createAlbum'),
      'SharedScreen must be wired to real virtual album management'
    );
  });

  it('9. GeoMap Screen: must not use static mock pins; must show real geo media or clean empty state', () => {
    const mapScreenPath = path.join(webSrcDir, 'components', 'v2', 'GeoMapScreen.tsx');
    const content = fs.readFileSync(mapScreenPath, 'utf-8');

    assert.ok(
      !content.includes('mockPlaces') && !content.includes('Красная площадь, Москва'),
      'GeoMapScreen must not contain hardcoded mock places ("Красная площадь, Москва")'
    );
    assert.ok(
      content.includes('empty') || content.includes('геометк') || content.includes('coordinates'),
      'GeoMapScreen must render real geo media or a clean empty state when no geotagged photos exist'
    );
  });

});
