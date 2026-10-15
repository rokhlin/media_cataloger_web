import type { GalleryMediaFile } from '../models';
import { mediaCacheService } from './mediaCacheService';

export interface VirtualAlbum {
  id: string;
  userId?: string;
  title: string;
  description?: string;
  tags?: string[];
  filePaths: string[];
  shareToken?: string;
  isPublic?: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_PREFIX = 'media_catalog_virtual_albums';

export class VirtualAlbumService {
  private activeUserId: string = '';

  public setUserId(userId?: string) {
    this.activeUserId = userId || '';
  }

  public getActiveUserId(): string {
    if (this.activeUserId) {
      return this.activeUserId;
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('media_cataloger_user_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.username) return parsed.username;
          if (parsed?.id) return parsed.id;
        }
      }
    } catch {}
    return 'default';
  }

  private getStorageKey(userId?: string): string {
    const id = userId || this.getActiveUserId();
    return `${STORAGE_PREFIX}_${id}`;
  }

  private getStoredAlbums(): VirtualAlbum[] {
    try {
      const currentId = this.getActiveUserId();
      const raw = localStorage.getItem(this.getStorageKey(currentId));
      if (!raw) return [];
      const albums: VirtualAlbum[] = JSON.parse(raw);
      // Strictly isolate albums: only return albums belonging to active user
      return albums.filter((a) => !a.userId || a.userId === currentId);
    } catch {
      return [];
    }
  }

  private saveStoredAlbums(albums: VirtualAlbum[]): void {
    try {
      const currentId = this.getActiveUserId();
      localStorage.setItem(this.getStorageKey(currentId), JSON.stringify(albums));
    } catch (err) {
      console.warn('Failed to persist virtual albums to localStorage:', err);
    }
  }

  /**
   * Get all virtual albums for the current user
   */
  async getAlbums(): Promise<VirtualAlbum[]> {
    return this.getStoredAlbums();
  }

  /**
   * Create a new user virtual album
   */
  async createAlbum(payload: {
    title: string;
    description?: string;
    tags?: string[];
    filePaths: string[];
  }): Promise<VirtualAlbum> {
    const albums = this.getStoredAlbums();
    const newAlbum: VirtualAlbum = {
      id: 'va_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId: this.getActiveUserId(),
      title: payload.title.trim() || 'Новый альбом',
      description: payload.description?.trim() || '',
      tags: payload.tags || [],
      filePaths: payload.filePaths || [],
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    albums.unshift(newAlbum);
    this.saveStoredAlbums(albums);
    return newAlbum;
  }

  /**
   * Get a single virtual album by id
   */
  async getAlbum(id: string): Promise<VirtualAlbum | null> {
    const albums = this.getStoredAlbums();
    return albums.find((a) => a.id === id) || null;
  }

  /**
   * Add files to an existing virtual album
   */
  async addFilesToAlbum(albumId: string, filePaths: string[]): Promise<VirtualAlbum | null> {
    const albums = this.getStoredAlbums();
    const index = albums.findIndex((a) => a.id === albumId);
    if (index === -1) return null;

    const existingPaths = new Set(albums[index].filePaths);
    filePaths.forEach((p) => existingPaths.add(p));
    albums[index].filePaths = Array.from(existingPaths);
    albums[index].updatedAt = new Date().toISOString();
    this.saveStoredAlbums(albums);
    return albums[index];
  }

  /**
   * Remove files from an existing virtual album
   */
  async removeFilesFromAlbum(albumId: string, filePaths: string[]): Promise<VirtualAlbum | null> {
    const albums = this.getStoredAlbums();
    const index = albums.findIndex((a) => a.id === albumId);
    if (index === -1) return null;

    const removeSet = new Set(filePaths);
    albums[index].filePaths = albums[index].filePaths.filter((p) => !removeSet.has(p));
    albums[index].updatedAt = new Date().toISOString();
    this.saveStoredAlbums(albums);
    return albums[index];
  }

  /**
   * Update an existing virtual album
   */
  async updateAlbum(id: string, updates: Partial<VirtualAlbum>): Promise<VirtualAlbum | null> {
    const albums = this.getStoredAlbums();
    const index = albums.findIndex((a) => a.id === id);
    if (index === -1) return null;

    albums[index] = {
      ...albums[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveStoredAlbums(albums);
    return albums[index];
  }

  /**
   * Delete a virtual album
   */
  async deleteAlbum(id: string): Promise<boolean> {
    const albums = this.getStoredAlbums();
    const filtered = albums.filter((a) => a.id !== id);
    if (filtered.length === albums.length) return false;
    this.saveStoredAlbums(filtered);
    return true;
  }

  /**
   * Generate an unauthenticated public share link for an album
   */
  async generateShareLink(albumId: string): Promise<{ shareToken: string; shareUrl: string } | null> {
    const albums = this.getStoredAlbums();
    const album = albums.find((a) => a.id === albumId);
    if (!album) return null;

    const shareToken = album.shareToken || 'sh_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    album.shareToken = shareToken;
    album.isPublic = true;
    album.updatedAt = new Date().toISOString();
    this.saveStoredAlbums(albums);

    // Also persist to global public tokens map so any unauthenticated visitor can resolve it
    try {
      const publicMapRaw = localStorage.getItem('media_catalog_public_shares') || '{}';
      const publicMap = JSON.parse(publicMapRaw);
      publicMap[shareToken] = album;
      localStorage.setItem('media_catalog_public_shares', JSON.stringify(publicMap));
    } catch {}

    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:5173';
    const shareUrl = `${origin}/shared/${shareToken}`;

    return { shareToken, shareUrl };
  }

  /**
   * Revoke public share link
   */
  async revokeShareLink(albumId: string): Promise<boolean> {
    const albums = this.getStoredAlbums();
    const album = albums.find((a) => a.id === albumId);
    if (!album) return false;

    if (album.shareToken) {
      try {
        const publicMapRaw = localStorage.getItem('media_catalog_public_shares') || '{}';
        const publicMap = JSON.parse(publicMapRaw);
        delete publicMap[album.shareToken];
        localStorage.setItem('media_catalog_public_shares', JSON.stringify(publicMap));
      } catch {}
    }

    album.isPublic = false;
    album.shareToken = undefined;
    album.updatedAt = new Date().toISOString();
    this.saveStoredAlbums(albums);
    return true;
  }

  /**
   * Resolve album by public share token without requiring authentication.
   * Strictly isolates files to only those assigned to this album.
   */
  async getAlbumByShareToken(token: string): Promise<VirtualAlbum | null> {
    try {
      // 1. Check global public shares map
      const publicMapRaw = localStorage.getItem('media_catalog_public_shares') || '{}';
      const publicMap = JSON.parse(publicMapRaw);
      if (publicMap[token] && publicMap[token].isPublic) {
        return publicMap[token];
      }

      // 2. Scan across localStorage keys if necessary
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const list: VirtualAlbum[] = JSON.parse(raw);
            const found = list.find((a) => a.shareToken === token && a.isPublic);
            if (found) return found;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Retrieve only the media items belonging to a shared album.
   */
  async getSharedAlbumMedia(token: string): Promise<{ album: VirtualAlbum; files: GalleryMediaFile[] } | null> {
    const album = await this.getAlbumByShareToken(token);
    if (!album) return null;

    // Filter available media files from cache or build items from paths
    const allFiles = mediaCacheService.getAll();
    const fileMap = new Map<string, GalleryMediaFile>();
    for (const f of allFiles) {
      fileMap.set(f.file_path || f.filename, f);
    }

    const files: GalleryMediaFile[] = album.filePaths.map((pathStr) => {
      if (fileMap.has(pathStr)) {
        return fileMap.get(pathStr)!;
      }
      const filename = pathStr.split(/[\\/]/).pop() || pathStr;
      return {
        id: pathStr,
        filename,
        file_path: pathStr,
        type: 'image',
        is_image: true,
        size_bytes: 0,
        mtime: Math.floor(Date.now() / 1000),
      } as unknown as GalleryMediaFile;
    });

    return { album, files };
  }
}

export const virtualAlbumService = new VirtualAlbumService();
