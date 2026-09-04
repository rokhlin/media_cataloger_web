import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { getMediaDate, formatDateKey } from '../gallery/calendarUtils.js';
import type { GalleryMediaFile } from '../../models/media.js';

describe('TimelineCalendarView Component & Logic', () => {
  it('should have dedicated TimelineCalendarView.tsx and TimelineCalendarView.css exported', () => {
    const componentPath = path.resolve('src/components/gallery/TimelineCalendarView.tsx');
    assert.ok(fs.existsSync(componentPath), 'TimelineCalendarView.tsx should exist in gallery folder');

    const cssPath = path.resolve('src/components/gallery/TimelineCalendarView.css');
    assert.ok(fs.existsSync(cssPath), 'TimelineCalendarView.css should exist in gallery folder');

    const content = fs.readFileSync(componentPath, 'utf8');
    assert.ok(
      content.includes('export const TimelineCalendarView') ||
        content.includes('export default TimelineCalendarView'),
      'Must export TimelineCalendarView component'
    );
    assert.ok(
      content.includes('interface TimelineCalendarViewProps'),
      'Must define TimelineCalendarViewProps interface'
    );
    assert.ok(content.includes('useLanguage'), 'Must utilize i18n Language context');
    assert.ok(
      content.includes('count-overflow'),
      'Must include overflow badge logic when photos exceed 10'
    );
  });

  it('should extract media date with priority for capture_date over mtime', () => {
    const fileWithCaptureDate: GalleryMediaFile = {
      filename: 'photo1.jpg',
      capture_date: '2024-05-15T14:30:00.000Z',
      mtime: 1600000000,
    };
    const d1 = getMediaDate(fileWithCaptureDate);
    assert.ok(d1 !== null, 'Date should not be null');
    assert.strictEqual(d1?.toISOString(), '2024-05-15T14:30:00.000Z');

    const fileWithMtimeOnly: GalleryMediaFile = {
      filename: 'photo2.jpg',
      mtime: 1715785800, // May 15, 2024
    };
    const d2 = getMediaDate(fileWithMtimeOnly);
    assert.ok(d2 !== null, 'Date should not be null');
    assert.strictEqual(d2?.getTime(), 1715785800 * 1000);

    const fileWithoutDate: GalleryMediaFile = {
      filename: 'photo3.jpg',
    };
    const d3 = getMediaDate(fileWithoutDate);
    assert.strictEqual(d3, null, 'File without dates should return null');
  });

  it('should format date key as YYYY-MM-DD', () => {
    const date = new Date(2024, 4, 15); // Month is 0-indexed: May is 4
    const key = formatDateKey(date);
    assert.strictEqual(key, '2024-05-15');
  });

  it('should verify MediaGallery provides subtab toggle between Calendar View and Timeline List', () => {
    const galleryPath = path.resolve('src/components/gallery/MediaGallery.tsx');
    const galleryContent = fs.readFileSync(galleryPath, 'utf8');

    assert.ok(
      galleryContent.includes("import TimelineCalendarView from './TimelineCalendarView'"),
      'MediaGallery must import TimelineCalendarView'
    );
    assert.ok(
      galleryContent.includes('dateSubView'),
      'MediaGallery must manage dateSubView state'
    );
    assert.ok(
      galleryContent.includes('<TimelineCalendarView'),
      'MediaGallery must render TimelineCalendarView component'
    );
  });

  it('should verify CSS rules for photo stack and >10 overflow badges', () => {
    const cssPath = path.resolve('src/components/gallery/TimelineCalendarView.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert.ok(cssContent.includes('.photo-stack-card'), 'Must define .photo-stack-card');
    assert.ok(cssContent.includes('.count-overflow'), 'Must define .count-overflow badge style');
    assert.ok(cssContent.includes('.calendar-day-modal-overlay'), 'Must define day details modal');
  });
});
