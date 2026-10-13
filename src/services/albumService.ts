import { mediaCacheService } from './mediaCacheService';
import type { GalleryMediaFile } from '../models/media';

export interface CatalogAlbum {
  id: string;
  name: string;
  path: string;
  count: number;
  coverUrl?: string;
  lastUpdated?: string;
}

/**
 * Extracts real directory catalogs and albums from media files and input settings
 */
export async function getRealAlbums(): Promise<CatalogAlbum[]> {
  try {
    // 1. Ensure cache has at least an initial chunk
    let files = mediaCacheService.getAll();
    if (files.length === 0) {
      await mediaCacheService.fetchChunk({ offset: 0, limit: 1000 });
      files = mediaCacheService.getAll();
    }

    if (files.length === 0) {
      // Direct API fallback
      const res = await fetch('/api/media/files?limit=1000');
      if (res.ok) {
        const data = await res.json();
        files = data.files || [];
      }
    }

    if (files.length === 0) {
      return [];
    }

    // 2. Group files by subfolder / directory
    const folderMap = new Map<string, GalleryMediaFile[]>();

    for (const file of files) {
      const p = file.file_path || file.filename || '';
      // Normalize slashes
      const normalized = p.replace(/\\/g, '/');
      const parts = normalized.split('/');
      
      // If there are subdirectories (e.g. Z:/diplicates/image.jpg)
      if (parts.length > 1) {
        // Folder is the immediate parent directory or subfolder
        const folderName = parts[parts.length - 2];
        if (folderName && !folderName.includes(':')) {
          const list = folderMap.get(folderName) || [];
          list.push(file);
          folderMap.set(folderName, list);
        } else if (file.folder) {
          const normFolder = file.folder.replace(/\\/g, '/').replace(/\/+$/, '');
          const fParts = normFolder.split('/');
          const fName = fParts[fParts.length - 1] || 'Основной каталог';
          const list = folderMap.get(fName) || [];
          list.push(file);
          folderMap.set(fName, list);
        }
      } else if (file.folder) {
        const normFolder = file.folder.replace(/\\/g, '/').replace(/\/+$/, '');
        const fParts = normFolder.split('/');
        const fName = fParts[fParts.length - 1] || 'Основной каталог';
        const list = folderMap.get(fName) || [];
        list.push(file);
        folderMap.set(fName, list);
      }
    }

    const albums: CatalogAlbum[] = [];
    let idx = 1;

    folderMap.forEach((folderFiles, folderName) => {
      if (folderFiles.length === 0) return;
      const firstImage = folderFiles.find((f) => f.is_image) || folderFiles[0];
      const filePathOrName = firstImage.file_path || firstImage.filename || '';
      const coverUrl = firstImage.thumbnail_url || `/api/media/thumbnail?path=${encodeURIComponent(filePathOrName)}&size=400`;

      albums.push({
        id: String(idx++),
        name: folderName,
        path: `/photos?folder=${encodeURIComponent(folderName)}`,
        count: folderFiles.length,
        coverUrl,
        lastUpdated: firstImage.media_date || firstImage.capture_date || 'Недавно',
      });
    });

    return albums;
  } catch (error) {
    console.warn('Failed to load real albums:', error);
    return [];
  }
}
