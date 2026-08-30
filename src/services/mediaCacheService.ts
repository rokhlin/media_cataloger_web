import type { GalleryMediaFile, MediaCatalogResponse } from '../models/media';

export interface FetchChunkOptions {
  offset?: number;
  limit?: number;
  search?: string;
  type?: 'all' | 'images' | 'videos';
  status?: 'all' | 'PROCESSED' | 'UNPROCESSED' | 'PENDING';
  face_filter?: 'all' | 'with_faces' | 'no_faces' | 'unassigned';
  person?: string;
  folder?: string;
  sort_by?: 'name' | 'date' | 'size' | 'status' | 'faces';
  sort_order?: 'asc' | 'desc';
  refresh?: boolean;
}

/**
 * High-performance client-side cache & background chunk loader for media items
 */
export class MediaCacheService {
  private cache: Map<string, GalleryMediaFile> = new Map();
  private orderedKeys: string[] = [];
  private totalCount: number = 0;
  private isPrefetching: boolean = false;
  private pendingRequests: Map<string, Promise<MediaCatalogResponse>> = new Map();

  /**
   * Clear all client-side cached files
   */
  clear(): void {
    this.cache.clear();
    this.orderedKeys = [];
    this.totalCount = 0;
    this.pendingRequests.clear();
  }

  /**
   * Get all currently cached files in order
   */
  getAll(): GalleryMediaFile[] {
    return this.orderedKeys.map((k) => this.cache.get(k)!).filter(Boolean);
  }

  /**
   * Get file by path or filename
   */
  get(filePath: string): GalleryMediaFile | undefined {
    return this.cache.get(filePath);
  }

  /**
   * Get current cached item count
   */
  get loadedCount(): number {
    return this.cache.size;
  }

  /**
   * Get reported total from backend
   */
  get total(): number {
    return this.totalCount;
  }

  /**
   * Optimistically update or insert a file in the client cache
   */
  upsert(file: GalleryMediaFile): void {
    const key = file.file_path || file.filename;
    if (!this.cache.has(key)) {
      this.orderedKeys.push(key);
    }
    this.cache.set(key, file);
  }

  /**
   * Merge new chunk of files into client cache preserving order
   */
  mergeChunk(files: GalleryMediaFile[], total?: number): GalleryMediaFile[] {
    if (typeof total === 'number') {
      this.totalCount = total;
    }
    for (const f of files) {
      const key = f.file_path || f.filename;
      if (!this.cache.has(key)) {
        this.orderedKeys.push(key);
      }
      this.cache.set(key, f);
    }
    return this.getAll();
  }

  /**
   * Generate cache key from request parameters
   */
  private getRequestKey(options: FetchChunkOptions): string {
    return JSON.stringify(options);
  }

  /**
   * Fetch a chunk of media files from the backend API with deduplication
   */
  async fetchChunk(options: FetchChunkOptions = {}): Promise<MediaCatalogResponse> {
    const reqKey = this.getRequestKey(options);

    // Reuse in-flight request if identical query is already pending
    if (this.pendingRequests.has(reqKey)) {
      return this.pendingRequests.get(reqKey)!;
    }

    const params = new URLSearchParams();
    if (options.offset !== undefined) params.set('offset', String(options.offset));
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.search) params.set('search', options.search);
    if (options.type && options.type !== 'all') params.set('type', options.type);
    if (options.status && options.status !== 'all') params.set('status', options.status);
    if (options.face_filter && options.face_filter !== 'all') params.set('face_filter', options.face_filter);
    if (options.person && options.person !== 'all') params.set('person', options.person);
    if (options.folder) params.set('folder', options.folder);
    if (options.sort_by) params.set('sort_by', options.sort_by);
    if (options.sort_order) params.set('sort_order', options.sort_order);
    if (options.refresh) params.set('refresh', 'true');

    const promise = (async () => {
      try {
        const queryStr = params.toString();
        const url = `/api/media/files${queryStr ? `?${queryStr}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch media chunk: ${res.statusText}`);
        }
        const data: MediaCatalogResponse = await res.json();
        const files = data.files || [];
        const total = data.total ?? data.total_files ?? files.length;
        const hasMore = data.hasMore ?? data.has_more ?? (options.limit ? (options.offset || 0) + files.length < total : false);

        if (options.refresh || options.offset === 0) {
          if (options.refresh) {
            this.clear();
          }
        }

        this.mergeChunk(files, total);

        return {
          files,
          total,
          offset: options.offset || 0,
          limit: options.limit || files.length,
          hasMore,
          stats: data.stats,
        };
      } finally {
        this.pendingRequests.delete(reqKey);
      }
    })();

    this.pendingRequests.set(reqKey, promise);
    return promise;
  }

  /**
   * Trigger background prefetch for the next chunk of media items
   */
  async prefetchNextChunk(currentOffset: number, chunkSize: number, options: Omit<FetchChunkOptions, 'offset' | 'limit'> = {}): Promise<void> {
    if (this.isPrefetching) return;
    const nextOffset = currentOffset + chunkSize;
    if (this.totalCount > 0 && nextOffset >= this.totalCount) return;

    this.isPrefetching = true;
    try {
      await this.fetchChunk({
        ...options,
        offset: nextOffset,
        limit: chunkSize,
      });
    } catch {
      // background prefetch errors are silent
    } finally {
      this.isPrefetching = false;
    }
  }
}

export const mediaCacheService = new MediaCacheService();
