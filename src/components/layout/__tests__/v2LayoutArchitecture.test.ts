import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('V2 Base Layout & Adaptive Navigation Architecture', () => {
  const layoutDir = path.resolve('src/components/layout');
  const v2Dir = path.resolve('src/components/v2');

  it('should verify all core V2 layout components exist', () => {
    assert.ok(fs.existsSync(layoutDir), 'src/components/layout directory must exist');
    const layoutFiles = [
      'RootLayout.tsx',
      'LeftNavSidebar.tsx',
      'TopNavBar.tsx',
      'StatusBar.tsx',
      'TimelineScrubber.tsx',
    ];

    for (const file of layoutFiles) {
      assert.ok(
        fs.existsSync(path.join(layoutDir, file)),
        `Layout component ${file} must exist in src/components/layout/`
      );
    }
  });

  it('should verify LeftNavSidebar contains complete navigation hierarchy and footer widgets', () => {
    const sidebarContent = fs.readFileSync(path.join(layoutDir, 'LeftNavSidebar.tsx'), 'utf-8');

    // Media Cataloger logo & branding
    assert.ok(sidebarContent.includes('Media Cataloger'), 'Sidebar must include Media Cataloger branding');
    assert.ok(sidebarContent.includes('Cataloger V2'), 'Sidebar must include Cataloger V2 brand label');

    // Core navigation routes
    const expectedRoutes = [
      'Фото',
      'Поиск',
      'Карта',
      'Люди',
      'Семейное древо',
      'Общие',
      'Библиотека',
      'Избранное',
      'Альбомы',
      'Утилиты',
      'Архив',
      'Личная папка',
      'Корзина',
    ];

    for (const route of expectedRoutes) {
      assert.ok(
        sidebarContent.includes(route),
        `LeftNavSidebar must include navigation item: ${route}`
      );
    }

    // Storage Widget & Server Status Pill
    assert.ok(sidebarContent.includes('Хранилище'), 'Sidebar must contain StorageUsageWidget');
    assert.ok(sidebarContent.includes('Сервер в сети'), 'Sidebar must display live server health pill');
    assert.ok(sidebarContent.includes('Клиент: v1.0.0'), 'Sidebar must display client version');
  });

  it('should verify TopNavBar contains search pill, upload CTA, and profile popover', () => {
    const topBarContent = fs.readFileSync(path.join(layoutDir, 'TopNavBar.tsx'), 'utf-8');

    assert.ok(topBarContent.includes('Поиск фотографий'), 'TopNavBar must include search input placeholder');
    assert.ok(topBarContent.includes('⌘K'), 'TopNavBar must show keyboard shortcut badge');
    assert.ok(topBarContent.includes('Загрузить'), 'TopNavBar must include upload CTA');
    assert.ok(topBarContent.includes('toggleThemeMode'), 'TopNavBar must integrate theme mode toggle');
    assert.ok(topBarContent.includes('Настройки учётной записи'), 'TopNavBar must have profile popover with settings link');
    assert.ok(topBarContent.includes('logout'), 'TopNavBar profile menu must provide logout action');
  });

  it('should verify StatusBar complies with accessible progress bar contract', () => {
    const statusContent = fs.readFileSync(path.join(layoutDir, 'StatusBar.tsx'), 'utf-8');

    assert.ok(statusContent.includes('role="progressbar"'), 'StatusBar must define role="progressbar"');
    assert.ok(statusContent.includes('aria-valuenow'), 'StatusBar must provide aria-valuenow');
    assert.ok(statusContent.includes('aria-valuemin'), 'StatusBar must provide aria-valuemin');
    assert.ok(statusContent.includes('aria-valuemax'), 'StatusBar must provide aria-valuemax');
    assert.ok(statusContent.includes('Фоновое сканирование'), 'StatusBar must support background process title');
  });

  it('should verify TimelineScrubber provides vertical year milestones', () => {
    const scrubberContent = fs.readFileSync(path.join(layoutDir, 'TimelineScrubber.tsx'), 'utf-8');

    assert.ok(scrubberContent.includes('2025'), 'TimelineScrubber must contain year milestone anchors');
    assert.ok(scrubberContent.includes('onSelectYear'), 'TimelineScrubber must provide year selection handler');
    assert.ok(scrubberContent.includes('hoveredItem'), 'TimelineScrubber must support hover preview tooltip');
  });

  it('should verify all V2 screens exist and are registered in AppRouter', () => {
    assert.ok(fs.existsSync(v2Dir), 'src/components/v2 directory must exist');
    const v2Screens = [
      'SearchHubScreen.tsx',
      'GeoMapScreen.tsx',
      'PeopleFacesScreen.tsx',
      'AlbumsScreen.tsx',
      'FavoritesScreen.tsx',
      'SharedScreen.tsx',
      'ArchiveScreen.tsx',
      'LockedFolderScreen.tsx',
      'TrashScreen.tsx',
      'UserSettingsScreen.tsx',
    ];

    for (const screen of v2Screens) {
      assert.ok(
        fs.existsSync(path.join(v2Dir, screen)),
        `V2 screen ${screen} must exist in src/components/v2/`
      );
    }

    const routerContent = fs.readFileSync(path.resolve('src/AppRouter.tsx'), 'utf-8');
    const requiredRoutes = [
      '/search',
      '/map',
      '/people',
      '/shared',
      '/favorites',
      '/albums',
      '/duplicates',
      '/archive',
      '/locked-folder',
      '/trash',
      '/settings',
      '/admin',
    ];

    for (const route of requiredRoutes) {
      assert.ok(
        routerContent.includes(`path: "${route}"`),
        `AppRouter must register route: ${route}`
      );
    }
  });

  it('should verify RootLayout stitches all layout components together', () => {
    const rootLayoutContent = fs.readFileSync(path.join(layoutDir, 'RootLayout.tsx'), 'utf-8');

    assert.ok(rootLayoutContent.includes('<LeftNavSidebar'), 'RootLayout must mount LeftNavSidebar');
    assert.ok(rootLayoutContent.includes('<TopNavBar'), 'RootLayout must mount TopNavBar');
    assert.ok(rootLayoutContent.includes('<StatusBar'), 'RootLayout must mount StatusBar');
    assert.ok(rootLayoutContent.includes('<TimelineScrubber'), 'RootLayout must mount TimelineScrubber');
    assert.ok(rootLayoutContent.includes('<Outlet />'), 'RootLayout must render router Outlet');
  });
});
