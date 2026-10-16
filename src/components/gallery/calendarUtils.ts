import type { GalleryMediaFile } from '../../models/media';

export interface CalendarDay {
  date: Date;
  dateKey: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  files: GalleryMediaFile[];
}

/**
 * Extracts a normalized Date object from media file metadata.
 * Prefers capture_date, falls back to mtime.
 */
export function getMediaDate(file: GalleryMediaFile): Date | null {
  const candidates = [
    file.capture_date,
    file.media_date,
    (file as any).exif?.DateTimeOriginal,
    (file as any).exif?.CreateDate,
    (file as any).exif?.datetime,
    (file as any).exif?.DateTime,
    (file as any).sidecar?.exif?.DateTimeOriginal,
    (file as any).sidecar?.exif?.datetime,
    (file as any).sidecar?.exif?.CreateDate,
    (file as any).sidecar?.capture_date,
    (file as any).sidecar?.media_date,
    (file as any).date_taken,
  ];

  for (const c of candidates) {
    if (c) {
      // Normalize "2016:11:04 13:40:28" to "2016-11-04T13:40:28"
      const str = String(c).trim().replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1970 && parsed.getFullYear() <= 2035) {
        return parsed;
      }
    }
  }

  // Parse date from filename (e.g. 2016-07-02 12-25-42.JPG, 20240808_130100.heic, IMG_20250602_...)
  const fname = file.filename || file.file_path || '';
  const match1 = fname.match(/\b(19\d\d|20\d\d)[-_](0[1-9]|1[0-2])[-_](0[1-9]|[12]\d|3[01])\b/);
  const match2 = fname.match(/\b(19\d\d|20\d\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[_-](\d{2})(\d{2})(\d{2})\b/);
  if (match1) {
    const y = parseInt(match1[1], 10);
    const m = parseInt(match1[2], 10) - 1;
    const d = parseInt(match1[3], 10);
    const parsed = new Date(y, m, d);
    if (!isNaN(parsed.getTime())) return parsed;
  } else if (match2) {
    const y = parseInt(match2[1], 10);
    const m = parseInt(match2[2], 10) - 1;
    const d = parseInt(match2[3], 10);
    const hh = parseInt(match2[4], 10);
    const mm = parseInt(match2[5], 10);
    const ss = parseInt(match2[6], 10);
    const parsed = new Date(y, m, d, hh, mm, ss);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // Fallback to mtime (seconds or milliseconds) only as last resort
  if (file.mtime) {
    const ms = file.mtime < 10000000000 ? file.mtime * 1000 : file.mtime;
    const parsed = new Date(ms);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

/**
 * Formats a Date to YYYY-MM-DD key.
 */
export function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Resolves the thumbnail URL for a media file, using the backend /api/media/thumbnail endpoint.
 */
export function getThumbnailSrc(file: GalleryMediaFile, size: number = 300): string {
  if (file.thumbnail_url) return file.thumbnail_url;
  const path = file.file_path || file.absolute_path || file.relative_path || file.filename || '';
  if (!path) return '';
  return `/api/media/thumbnail?path=${encodeURIComponent(path)}&size=${size}`;
}

