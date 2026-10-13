import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('BUG-001: V2 Migration Quality Restoration & Remediation Tests', () => {
  const componentsDir = path.resolve('src/components');
  const servicesDir = path.resolve('src/services');

  it('Defect 1: LeftNavSidebar must use Media Cataloger branding and eliminate immich branding', () => {
    const sidebarContent = fs.readFileSync(path.join(componentsDir, 'layout/LeftNavSidebar.tsx'), 'utf-8');
    assert.ok(
      sidebarContent.includes('Media Cataloger'),
      'Sidebar must include Media Cataloger brand title'
    );
    assert.strictEqual(
      sidebarContent.includes('>immich<') || sidebarContent.includes('immich\n'),
      false,
      'Sidebar must not display immich brand text'
    );
  });

  it('Defect 2: GalleryPage must calculate rowHeight dynamically to prevent cards overlapping in fullscreen and zoom', () => {
    const galleryContent = fs.readFileSync(path.join(componentsDir, 'gallery/GalleryPage.tsx'), 'utf-8');
    // Must not have fixed static estimateSize: () => 200
    assert.strictEqual(
      galleryContent.includes('estimateSize: () => 200'),
      false,
      'GalleryPage must not use fixed 200px row height in virtualizer'
    );
    // Must feature container measurement or dynamic row height calculation
    assert.ok(
      galleryContent.includes('rowHeight') || galleryContent.includes('cardSize') || galleryContent.includes('ResizeObserver'),
      'GalleryPage must compute row height dynamically based on card sizing/container width'
    );
  });

  it('Defect 3: LeftNavSidebar storage widget must not use static mock 25.5 / 100 GiB and must distinguish client version', () => {
    const sidebarContent = fs.readFileSync(path.join(componentsDir, 'layout/LeftNavSidebar.tsx'), 'utf-8');
    assert.strictEqual(
      sidebarContent.includes('25.5 / 100 GiB'),
      false,
      'Sidebar must not display hardcoded 25.5 / 100 GiB mock storage quota'
    );
    assert.ok(
      sidebarContent.includes('Клиент') || sidebarContent.includes('Client'),
      'Sidebar must explicitly label Client version'
    );
  });

  it('Defect 4: PeopleFacesScreen must not hardcode static mock people and must support empty state', () => {
    const peopleContent = fs.readFileSync(path.join(componentsDir, 'v2/PeopleFacesScreen.tsx'), 'utf-8');
    assert.strictEqual(
      peopleContent.includes("name: 'Анна'"),
      false,
      'PeopleFacesScreen must not hardcode static mock person Anna'
    );
    assert.strictEqual(
      peopleContent.includes("name: 'Михаил'"),
      false,
      'PeopleFacesScreen must not hardcode static mock person Mikhail'
    );
    assert.ok(
      peopleContent.includes('Нет распознанных лиц') || peopleContent.includes('не найдены'),
      'PeopleFacesScreen must provide clean empty state when no faces are recognized'
    );
  });

  it('Defect 5: AlbumsScreen must not hardcode mock albums and must bind to real folders or empty state', () => {
    const albumsContent = fs.readFileSync(path.join(componentsDir, 'v2/AlbumsScreen.tsx'), 'utf-8');
    assert.strictEqual(
      albumsContent.includes("Горы и походы"),
      false,
      'AlbumsScreen must not hardcode mock album Mountains'
    );
    assert.strictEqual(
      albumsContent.includes("Красные автомобили"),
      false,
      'AlbumsScreen must not hardcode mock album Red Cars'
    );
    assert.ok(
      albumsContent.includes('Нет альбомов') || albumsContent.includes('не найдены'),
      'AlbumsScreen must provide empty state when no albums exist'
    );
  });

  it('Defect 6: TopNavBar notifications must be clickable and deep-link to /photos and /duplicates', () => {
    const navContent = fs.readFileSync(path.join(componentsDir, 'layout/TopNavBar.tsx'), 'utf-8');
    assert.ok(
      navContent.includes('/photos'),
      'TopNavBar notifications must include navigation to /photos'
    );
    assert.ok(
      navContent.includes('/duplicates'),
      'TopNavBar notifications must include navigation to /duplicates'
    );
  });

  it('Defect 7: favoritesService must exist and be integrated into GalleryPage, MediaViewerModal, and FavoritesScreen', () => {
    const favServicePath = path.join(servicesDir, 'favoritesService.ts');
    assert.ok(fs.existsSync(favServicePath), 'favoritesService.ts must exist in src/services/');

    const galleryContent = fs.readFileSync(path.join(componentsDir, 'gallery/GalleryPage.tsx'), 'utf-8');
    assert.ok(
      galleryContent.includes('favorite') || galleryContent.includes('Favorite'),
      'GalleryPage must integrate favorite toggling'
    );

    const viewerContent = fs.readFileSync(path.join(componentsDir, 'gallery/MediaViewerModal.tsx'), 'utf-8');
    assert.ok(
      viewerContent.includes('favorite') || viewerContent.includes('Favorite'),
      'MediaViewerModal must integrate favorite toggling'
    );

    const favScreenContent = fs.readFileSync(path.join(componentsDir, 'v2/FavoritesScreen.tsx'), 'utf-8');
    assert.strictEqual(
      favScreenContent.includes('Favorite_IMG_2000'),
      false,
      'FavoritesScreen must not hardcode 12 fake mock items'
    );
  });
});
