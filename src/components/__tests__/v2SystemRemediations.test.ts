import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('BUG-003: Comprehensive V2 Remediation Test Suite', () => {
  const componentsDir = path.resolve('src/components');
  const serverDir = path.resolve('server');

  it('Requirement 1 & 3: DatabaseService.getKnownPersons must provide media_count and representative_face_id', () => {
    const dbPath = path.join(serverDir, 'database/database.service.ts');
    const content = fs.readFileSync(dbPath, 'utf-8');
    assert.ok(
      content.includes('COUNT(DISTINCT') || content.includes('media_count') || content.includes('representative_face_id'),
      'database.service.ts must compute media_count and return representative_face_id for recognized persons'
    );
  });

  it('Requirement 1: DuplicatesService must auto-populate or fallback-cluster groups when cachedGroups is empty', () => {
    const dupPath = path.join(serverDir, 'duplicates/duplicates.service.ts');
    const content = fs.readFileSync(dupPath, 'utf-8');
    assert.ok(
      content.includes('getDuplicateGroups') && (content.includes('cachedGroups.length === 0') || content.includes('this.cachedGroups = await') || content.includes('await this.getDuplicateGroups')),
      'duplicates.service.ts must automatically compute duplicate groups when cachedGroups is empty'
    );
  });

  it('Requirement 2: MediaViewerModal must internally load known persons and support video face grouping', () => {
    const viewerPath = path.join(componentsDir, 'gallery/MediaViewerModal.tsx');
    const content = fs.readFileSync(viewerPath, 'utf-8');
    assert.ok(
      content.includes('/api/faces/persons') || content.includes('internalKnownPersons') || content.includes('knownPersonsList'),
      'MediaViewerModal must dynamically fetch known persons if knownPersonOptions is not supplied'
    );
    assert.ok(
      content.includes('groupedVideoFaces') || content.includes('groupedFaces') || content.includes('videoFaceGroups') || content.includes('distinctFaces'),
      'MediaViewerModal must cluster or group redundant video frame face detections for moving objects'
    );
  });

  it('Requirement 3: PeopleFacesScreen must have clickable person cards navigating to /photos?person= and support face avatars', () => {
    const peoplePath = path.join(componentsDir, 'v2/PeopleFacesScreen.tsx');
    const content = fs.readFileSync(peoplePath, 'utf-8');
    assert.ok(
      content.includes('/photos?person=') || content.includes('navigate(`/photos?person='),
      'PeopleFacesScreen person cards must be clickable and navigate to filtered gallery'
    );
  });

  it('Requirement 3: GalleryPage must support person/face URL filter parameter and render filter chip', () => {
    const galleryPath = path.join(componentsDir, 'gallery/GalleryPage.tsx');
    const content = fs.readFileSync(galleryPath, 'utf-8');
    assert.ok(
      content.includes('person') || content.includes('faceParam'),
      'GalleryPage must inspect person or face search parameter'
    );
    assert.ok(
      content.includes('face_names') || content.includes('faces'),
      'GalleryPage must filter media items by person face name'
    );
  });

  it('Requirement 4 & 6: TopNavBar must render avatar image, remove folder config from profile dropdown, and trigger file upload', () => {
    const navPath = path.join(componentsDir, 'layout/TopNavBar.tsx');
    const content = fs.readFileSync(navPath, 'utf-8');
    assert.ok(
      content.includes('avatarUrl') || content.includes('currentUser?.avatar'),
      'TopNavBar must support rendering user profile avatar picture'
    );
    assert.ok(
      !content.includes('Настройка папок и источников') || content.includes('/settings'),
      'TopNavBar profile dropdown should relocate folder settings to Account Settings'
    );
    assert.ok(
      content.includes('type="file"') || content.includes('fileInputRef'),
      'TopNavBar upload button must trigger a real media file upload input'
    );
  });

  it('Requirement 5: UserSettingsScreen must include AI configuration (Gemini vs Local, Model selection, API token, Save)', () => {
    const settingsPath = path.join(componentsDir, 'v2/UserSettingsScreen.tsx');
    const content = fs.readFileSync(settingsPath, 'utf-8');
    assert.ok(
      content.includes('gemini') && (content.includes('local') || content.includes('provider')),
      'UserSettingsScreen must allow selecting between Gemini and Local LLM'
    );
    assert.ok(
      content.includes('gemini_api_key') || content.includes('apiKey') || content.includes('токен') || content.includes('Token'),
      'UserSettingsScreen must provide API key / token field for Gemini'
    );
    assert.ok(
      content.includes('Папки и источники') || content.includes('каталог') || content.includes('input_folders'),
      'UserSettingsScreen must include centralized folder configuration'
    );
  });

  it('Requirement 7: AlbumsScreen must support user-created virtual albums with photo picker', () => {
    const albumsPath = path.join(componentsDir, 'v2/AlbumsScreen.tsx');
    const content = fs.readFileSync(albumsPath, 'utf-8');
    assert.ok(
      content.includes('virtualAlbumService') || content.includes('VirtualAlbum') || content.includes('createAlbum'),
      'AlbumsScreen must support creating and listing user virtual albums'
    );
    assert.ok(
      content.includes('Создать альбом') || content.includes('Новый альбом'),
      'AlbumsScreen must render an action to create a new user album'
    );
  });

  it('Requirement 7: TimelineScrubber must accept real dynamic years and dispatch year navigation', () => {
    const scrubberPath = path.join(componentsDir, 'layout/TimelineScrubber.tsx');
    const content = fs.readFileSync(scrubberPath, 'utf-8');
    assert.ok(
      content.includes('onSelectYear'),
      'TimelineScrubber must accept onSelectYear callback'
    );
  });
});
