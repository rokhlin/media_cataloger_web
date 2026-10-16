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

export interface FolderTreeNode {
  id: string;
  name: string;
  relativePath: string;
  count: number;
  coverUrl?: string;
  subfolders: FolderTreeNode[];
}

/**
 * Extracts a clean relative directory path from a media file's path,
 * stripping user folders and system prefixes (e.g. media_input/users/admin)
 */
export function extractRelativeFolderPath(filePathOrFolder: string): string {
  if (!filePathOrFolder) return '';
  const normalized = filePathOrFolder.replace(/\\/g, '/').replace(/\/+$/, '');

  // Strip known prefix patterns such as:
  // - C:/.../media_input/users/<username>/
  // - media_input/users/<username>/
  // - media_output/users/<username>/
  const userRootRegex = /(?:.*\/)?(?:media_input|media_output)\/users\/[^/]+\/?(.*)$/i;
  const matchUser = normalized.match(userRootRegex);
  let rel = '';
  if (matchUser && matchUser[1] !== undefined) {
    rel = matchUser[1];
  } else {
    // Check general media_input
    const mediaInputRegex = /(?:.*\/)?media_input\/?(.*)$/i;
    const matchMedia = normalized.match(mediaInputRegex);
    if (matchMedia && matchMedia[1] !== undefined) {
      rel = matchMedia[1];
    } else {
      // If it has a drive letter or leading root, strip drive
      rel = normalized.replace(/^[a-zA-Z]:\//, '').replace(/^\/+/, '');
    }
  }

  // If rel points to a file, take its directory
  const parts = rel.split('/').filter(Boolean);
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    if (lastPart.includes('.')) {
      parts.pop();
    }
  }

  // Filter out any system folder names that might still linger (e.g. 'admin', 'users')
  const cleanParts = parts.filter((p) => p.toLowerCase() !== 'users' && p.toLowerCase() !== 'admin');
  return cleanParts.join('/');
}

/**
 * Builds an expandable tree of directory folders from media files
 */
export function buildFolderTree(files: GalleryMediaFile[]): FolderTreeNode[] {
  const rootMap = new Map<string, any>();

  for (const file of files) {
    const rawPath = file.file_path || file.folder || file.filename || '';
    const relFolder = extractRelativeFolderPath(rawPath);
    if (!relFolder) continue;

    const segments = relFolder.split('/').filter(Boolean);
    let currentMap = rootMap;
    let accumulatedPath = '';

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${seg}` : seg;
      if (!currentMap.has(seg)) {
        currentMap.set(seg, {
          name: seg,
          path: accumulatedPath,
          files: [] as GalleryMediaFile[],
          children: new Map<string, any>(),
        });
      }
      const node = currentMap.get(seg)!;
      node.files.push(file);
      currentMap = node.children;
    }
  }

  function convertMapToTree(map: Map<string, any>): FolderTreeNode[] {
    const result: FolderTreeNode[] = [];
    let idx = 1;

    map.forEach((value) => {
      const subfolders = convertMapToTree(value.children);
      const firstImg = value.files.find((f: GalleryMediaFile) => f.is_image) || value.files[0];
      const coverUrl = firstImg
        ? (firstImg.thumbnail_url || `/api/media/thumbnail?path=${encodeURIComponent(firstImg.file_path || firstImg.filename)}&size=400`)
        : undefined;

      result.push({
        id: `node_${value.path.replace(/[^a-zA-Z0-9_-]/g, '_')}_${idx++}`,
        name: value.name,
        relativePath: value.path,
        count: value.files.length,
        coverUrl,
        subfolders,
      });
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  return convertMapToTree(rootMap);
}

/**
 * Extracts real directory catalogs and albums from media files and input settings
 */
export async function getRealAlbums(): Promise<CatalogAlbum[]> {
  try {
    let files = mediaCacheService.getAll();
    if (files.length === 0) {
      await mediaCacheService.fetchChunk({ offset: 0, limit: 1000 });
      files = mediaCacheService.getAll();
    }

    if (files.length === 0) {
      const res = await fetch('/api/media/files?limit=1000');
      if (res.ok) {
        const data = await res.json();
        files = data.files || [];
      }
    }

    if (files.length === 0) return [];

    const folderMap = new Map<string, GalleryMediaFile[]>();

    for (const file of files) {
      const rawPath = file.file_path || file.folder || file.filename || '';
      const relFolder = extractRelativeFolderPath(rawPath);
      const groupName = relFolder || 'Основной каталог';
      const list = folderMap.get(groupName) || [];
      list.push(file);
      folderMap.set(groupName, list);
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
        path: `/photos?folder=${encodeURIComponent(folderName === 'Основной каталог' ? '' : folderName)}`,
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

/**
 * Extracts hierarchical directory tree from media files
 */
export async function getFolderTree(): Promise<FolderTreeNode[]> {
  try {
    let files = mediaCacheService.getAll();
    if (files.length === 0) {
      await mediaCacheService.fetchChunk({ offset: 0, limit: 1000 });
      files = mediaCacheService.getAll();
    }

    if (files.length === 0) {
      const res = await fetch('/api/media/files?limit=1000');
      if (res.ok) {
        const data = await res.json();
        files = data.files || [];
      }
    }

    if (files.length === 0) return [];

    return buildFolderTree(files);
  } catch (error) {
    console.warn('Failed to load folder tree:', error);
    return [];
  }
}
