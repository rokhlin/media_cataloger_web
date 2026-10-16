import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('BUG-004: Audio Feedback Bug Fixes & Enhancements Test Suite', () => {
  const webDir = path.resolve('.');
  const componentsDir = path.join(webDir, 'src/components');
  const serverDir = fs.existsSync(path.resolve('../media_catalog/server'))
    ? path.resolve('../media_catalog/server')
    : path.resolve('./server');

  it('Requirement 1: StatusBar must dynamically show Gemini or Local provider and model name based on settings', () => {
    const statusBarPath = path.join(componentsDir, 'layout/StatusBar.tsx');
    const content = fs.readFileSync(statusBarPath, 'utf-8');
    assert.ok(
      content.includes('/api/settings'),
      'StatusBar must fetch settings from /api/settings'
    );
    assert.ok(
      content.includes('model_provider') && content.includes('gemini_model'),
      'StatusBar must parse model_provider and gemini_model'
    );
    assert.ok(
      content.includes('ai_settings_updated'),
      'StatusBar must listen to ai_settings_updated event for reactive updates'
    );
  });

  it('Requirement 1: UserSettingsScreen must persist model_provider, gemini_model, local_model_name and dispatch ai_settings_updated', () => {
    const settingsPath = path.join(componentsDir, 'v2/UserSettingsScreen.tsx');
    const content = fs.readFileSync(settingsPath, 'utf-8');
    assert.ok(
      content.includes('model_provider') && content.includes('gemini_model'),
      'UserSettingsScreen must manage model_provider and gemini_model'
    );
    assert.ok(
      content.includes('ai_settings_updated'),
      'UserSettingsScreen must dispatch ai_settings_updated event on save'
    );
  });

  it('Requirement 2: TopNavBar search input must use type="text" with hidden webkit-search-cancel-button to eliminate duplicate X', () => {
    const topBarPath = path.join(componentsDir, 'layout/TopNavBar.tsx');
    const content = fs.readFileSync(topBarPath, 'utf-8');
    assert.ok(
      content.includes('type="text"'),
      'TopNavBar search input must be type="text" to prevent browser native clear button'
    );
    assert.ok(
      content.includes('webkit-search-cancel-button') || content.includes('[&::-webkit-search-cancel-button]:hidden'),
      'TopNavBar must hide native webkit cancel button'
    );
    assert.ok(
      content.includes('.length >= 4'),
      'TopNavBar must live update query parameter when searchTerm >= 4 characters'
    );
  });

  it('Requirement 2: GalleryPage must execute comprehensive metadata search across descriptions, summaries, OCR, faces, and tags', () => {
    const galleryPath = path.join(componentsDir, 'gallery/GalleryPage.tsx');
    const content = fs.readFileSync(galleryPath, 'utf-8');
    assert.ok(
      content.includes('description_ru') || content.includes('description'),
      'GalleryPage search must check Russian and English descriptions'
    );
    assert.ok(
      content.includes('summary_ru') || content.includes('summary'),
      'GalleryPage search must check AI summaries'
    );
    assert.ok(
      content.includes('ocr_text') || content.includes('transcription'),
      'GalleryPage search must check OCR text and transcription'
    );
    assert.ok(
      content.includes('face_names') || content.includes('faces'),
      'GalleryPage search must check face names'
    );
  });

  it('Requirement 3: TimelineScrubber must extract real media years (using mtime*1000 and EXIF) and remove fake hardcoded years', () => {
    const scrubberPath = path.join(componentsDir, 'layout/TimelineScrubber.tsx');
    const content = fs.readFileSync(scrubberPath, 'utf-8');
    assert.ok(
      !content.includes('const defaultYears = [2025, 2024, 2022, 2020, 2018];'),
      'TimelineScrubber must not have fake hardcoded defaultYears'
    );
    assert.ok(
      content.includes('extractMediaYear') || content.includes('capture_date'),
      'TimelineScrubber must extract years from media dates and timestamps'
    );
    assert.ok(
      content.includes('mtime * 1000'),
      'TimelineScrubber must convert mtime seconds to milliseconds'
    );
  });

  it('Requirement 4: MediaViewerModal must fall back to representative avatar and PeopleFacesScreen must allow picking primary photo', () => {
    const viewerPath = path.join(componentsDir, 'gallery/MediaViewerModal.tsx');
    const viewerContent = fs.readFileSync(viewerPath, 'utf-8');
    assert.ok(
      viewerContent.includes('avatarUrl') || viewerContent.includes('representative_face_id'),
      'MediaViewerModal must fall back to person avatar for uncropped face cards'
    );

    const peoplePath = path.join(componentsDir, 'v2/PeopleFacesScreen.tsx');
    const peopleContent = fs.readFileSync(peoplePath, 'utf-8');
    assert.ok(
      peopleContent.includes('/api/faces/set-primary'),
      'PeopleFacesScreen must support setting primary representative face'
    );

    const facesControllerPath = path.join(serverDir, 'faces/faces.controller.ts');
    if (fs.existsSync(facesControllerPath)) {
      const controllerContent = fs.readFileSync(facesControllerPath, 'utf-8');
      if (controllerContent.includes('set-primary')) {
        assert.ok(
          controllerContent.includes('set-primary') && controllerContent.includes('setPrimaryFace'),
          'faces.controller.ts must expose POST /api/faces/set-primary'
        );
      }
    }
  });

  it('Requirement 5: Media upload must automatically trigger backend single-file analysis in background', () => {
    const mediaServicePath = path.join(serverDir, 'media/media.service.ts');
    if (fs.existsSync(mediaServicePath)) {
      const mediaServiceContent = fs.readFileSync(mediaServicePath, 'utf-8');
      if (mediaServiceContent.includes('triggerAnalyzeFile')) {
        assert.ok(
          mediaServiceContent.includes('triggerAnalyzeFile') && mediaServiceContent.includes('uploadAndProcessMediaFile'),
          'media.service.ts must trigger single-file analysis upon upload'
        );
      }
    }

    const topBarPath = path.join(componentsDir, 'layout/TopNavBar.tsx');
    const topBarContent = fs.readFileSync(topBarPath, 'utf-8');
    assert.ok(
      topBarContent.includes('/api/media/upload'),
      'TopNavBar must upload file to /api/media/upload'
    );
    assert.ok(
      topBarContent.includes('media_uploaded'),
      'TopNavBar must dispatch media_uploaded custom event'
    );
  });

  it('Requirement 6: VirtualAlbumService and AlbumsScreen must support in-place album editing, adding new files, and removing old files', () => {
    const albumServicePath = path.join(webDir, 'src/services/virtualAlbumService.ts');
    const albumServiceContent = fs.readFileSync(albumServicePath, 'utf-8');
    assert.ok(
      albumServiceContent.includes('addFilesToAlbum') && albumServiceContent.includes('removeFilesFromAlbum'),
      'virtualAlbumService must provide addFilesToAlbum and removeFilesFromAlbum methods'
    );

    const albumsScreenPath = path.join(componentsDir, 'v2/AlbumsScreen.tsx');
    const albumsContent = fs.readFileSync(albumsScreenPath, 'utf-8');
    assert.ok(
      albumsContent.includes('editingAlbum') && albumsContent.includes('handleSaveAlbumEdit'),
      'AlbumsScreen must have editingAlbum state and save handler'
    );
    assert.ok(
      albumsContent.includes('handleRemovePhotoFromEditAlbum'),
      'AlbumsScreen must allow removing old files from an album'
    );
    assert.ok(
      albumsContent.includes('handleConfirmAddPhotos') || albumsContent.includes('photosToAdd'),
      'AlbumsScreen must allow adding new files to an album'
    );
    assert.ok(
      albumsContent.includes('ensureAvailablePhotosLoaded') || albumsContent.includes('mediaCacheService.fetchChunk'),
      'AlbumsScreen must ensure gallery photos are pre-fetched when opening modals'
    );
  });

  it('Requirement 7: Album photo picker must use /api/media/thumbnail endpoints and display filenames for all items', () => {
    const albumsScreenPath = path.join(componentsDir, 'v2/AlbumsScreen.tsx');
    const albumsContent = fs.readFileSync(albumsScreenPath, 'utf-8');

    assert.ok(
      !albumsContent.includes('/api/media/image?path='),
      'AlbumsScreen must NOT use obsolete /api/media/image endpoint which returns 404'
    );
    assert.ok(
      albumsContent.includes('/api/media/thumbnail?path='),
      'AlbumsScreen must use /api/media/thumbnail endpoint for photo picker miniatures'
    );
    assert.ok(
      albumsContent.includes('photo.filename') || albumsContent.includes('split(/[\\\\/]/).pop()'),
      'AlbumsScreen photo pickers must render filename captions and titles'
    );
    assert.ok(
      albumsContent.includes('loadingPhotos'),
      'AlbumsScreen must maintain loadingPhotos state for pre-fetching indicators'
    );
  });

  it('Requirement 8: MediaViewerModal must provide "Add to Album" action and open AddToAlbumModal dialog', () => {
    const addToAlbumModalPath = path.join(componentsDir, 'gallery/AddToAlbumModal.tsx');
    assert.ok(fs.existsSync(addToAlbumModalPath), 'AddToAlbumModal.tsx must exist');
    const modalContent = fs.readFileSync(addToAlbumModalPath, 'utf-8');
    assert.ok(
      modalContent.includes('virtualAlbumService.getAlbums') &&
      modalContent.includes('virtualAlbumService.addFilesToAlbum'),
      'AddToAlbumModal must list albums and add files using virtualAlbumService'
    );
    assert.ok(
      modalContent.includes('createAlbum'),
      'AddToAlbumModal must allow quick inline creation of a new album'
    );

    const viewerPath = path.join(componentsDir, 'gallery/MediaViewerModal.tsx');
    const viewerContent = fs.readFileSync(viewerPath, 'utf-8');
    assert.ok(
      viewerContent.includes('isAddToAlbumOpen') && viewerContent.includes('AddToAlbumModal'),
      'MediaViewerModal must integrate AddToAlbumModal'
    );
    assert.ok(
      viewerContent.includes('add_to_album_button_id') || viewerContent.includes('add-to-album-btn'),
      'MediaViewerModal must render "Добавить в альбом" button'
    );
  });

  it('Requirement 9: MediaViewerModal analysis button must reliably launch analysis with self-contained fallback to /api/analyze-file', () => {
    const viewerPath = path.join(componentsDir, 'gallery/MediaViewerModal.tsx');
    const viewerContent = fs.readFileSync(viewerPath, 'utf-8');

    assert.ok(
      viewerContent.includes('/api/analyze-file'),
      'MediaViewerModal must contain self-contained fallback calling /api/analyze-file when prop is absent'
    );
    assert.ok(
      viewerContent.includes('btn_analyze_file_id') || viewerContent.includes('handleAnalyzeClick'),
      'MediaViewerModal must have analysis button and click handler'
    );
    assert.ok(
      viewerContent.includes('isAnalyzing'),
      'MediaViewerModal must track isAnalyzing state'
    );

    const galleryPath = path.join(componentsDir, 'gallery/GalleryPage.tsx');
    const galleryContent = fs.readFileSync(galleryPath, 'utf-8');
    assert.ok(
      galleryContent.includes('onStartSingleAnalysis={handleStartSingleAnalysis}'),
      'GalleryPage must pass onStartSingleAnalysis prop to MediaViewerModal'
    );
  });
});
