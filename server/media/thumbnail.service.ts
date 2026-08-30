import { Injectable, Logger, Inject } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import sharp from 'sharp';
import { AppConfigService } from '../config/config.service.js';

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);
  private cacheDir: string;
  private inFlightGenerations: Map<string, Promise<string>> = new Map();
  private activeJobs = 0;
  private readonly maxConcurrentJobs = 8;
  private jobQueue: Array<() => void> = [];

  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {
    this.cacheDir = path.resolve(this.config.projectRoot, 'data', 'cache', 'thumbnails');
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (err: any) {
      this.logger.warn(`Failed to create thumbnail cache directory: ${err.message}`);
    }
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeJobs < this.maxConcurrentJobs) {
      this.activeJobs++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.jobQueue.push(() => {
        this.activeJobs++;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.activeJobs--;
    if (this.jobQueue.length > 0) {
      const next = this.jobQueue.shift();
      if (next) next();
    }
  }

  /**
   * Get or generate a cached WebP thumbnail for a given source image.
   * @param sourcePath Absolute path to the original media file
   * @param size Target bounding box dimension in pixels (default 300)
   * @returns Path to the generated WebP thumbnail file
   */
  async getThumbnail(sourcePath: string, size: number = 300): Promise<{ filePath: string; isCached: boolean }> {
    const targetSize = Math.max(64, Math.min(size || 300, 1920));

    // Verify source exists
    const stats = await fs.promises.stat(sourcePath);
    if (!stats.isFile()) {
      throw new Error(`Source is not a file: ${sourcePath}`);
    }

    // Generate unique cache key based on path, modification time, file size, and target size
    const cacheKey = crypto
      .createHash('sha1')
      .update(`${sourcePath}:${stats.mtimeMs}:${stats.size}:${targetSize}`)
      .digest('hex');

    const thumbPath = path.join(this.cacheDir, `${cacheKey}.webp`);

    // Check if thumbnail already exists on disk
    try {
      await fs.promises.access(thumbPath, fs.constants.R_OK);
      return { filePath: thumbPath, isCached: true };
    } catch {
      // Cache miss, proceed to generate
    }

    // Deduplicate in-flight generation for the exact same file/size
    const inFlight = this.inFlightGenerations.get(cacheKey);
    if (inFlight) {
      const resultPath = await inFlight;
      return { filePath: resultPath, isCached: true };
    }

    const generationPromise = (async () => {
      await this.acquireSlot();
      const tempPath = path.join(this.cacheDir, `${cacheKey}.${Date.now()}.tmp.webp`);
      try {
        await sharp(sourcePath, { failOn: 'none', animated: false })
          .rotate() // Auto-orient using EXIF orientation tag
          .resize(targetSize, targetSize, {
            fit: 'inside',
            withoutEnlargement: true,
            fastShrinkOnLoad: true,
          })
          .webp({
            quality: 80,
            effort: 4,
          })
          .toFile(tempPath);

        await fs.promises.rename(tempPath, thumbPath);
        return thumbPath;
      } catch (err: any) {
        // Clean up temp file on error
        try {
          if (fs.existsSync(tempPath)) {
            await fs.promises.unlink(tempPath);
          }
        } catch {
          // ignore cleanup error
        }
        this.logger.error(`Failed to generate thumbnail for ${sourcePath}: ${err.message}`);
        throw err;
      } finally {
        this.releaseSlot();
        this.inFlightGenerations.delete(cacheKey);
      }
    })();

    this.inFlightGenerations.set(cacheKey, generationPromise);
    const resultPath = await generationPromise;
    return { filePath: resultPath, isCached: false };
  }
}
