import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mediaOrganizationService } from '../mediaOrganizationService';
import { MediaCacheService } from '../mediaCacheService';
import type { GalleryMediaFile } from '../../models/media';

describe('MediaOrganizationService', () => {
  const sampleFiles: GalleryMediaFile[] = [
    {
      filename: 'photo1.jpg',
      file_path: '/input/2024/summer/photo1.jpg',
      folder: '/input',
      is_image: true,
      mtime: 1720000000, // ~July 2024
      file_size: 1048576, // 1MB
      status: 'PROCESSED',
      face_count: 2,
      face_names: ['Alice', 'Bob'],
      has_unassigned_faces: false,
    },
    {
      filename: 'photo2.jpg',
      file_path: '/input/2024/summer/photo2.jpg',
      folder: '/input',
      is_image: true,
      mtime: 1720100000, // ~July 2024
      file_size: 2097152, // 2MB
      status: 'UNPROCESSED',
      face_count: 1,
      face_names: ['Alice'],
      has_unassigned_faces: false,
    },
    {
      filename: 'video1.mp4',
      file_path: '/input/2023/winter/video1.mp4',
      folder: '/input',
      is_video: true,
      mtime: 1672531199, // ~Dec 2022 / Jan 2023
      file_size: 10485760, // 10MB
      status: 'PROCESSED',
      face_count: 0,
      face_names: [],
      has_unassigned_faces: false,
    },
    {
      filename: 'unrec.jpg',
      file_path: '/input/unrec.jpg',
      folder: '/input',
      is_image: true,
      mtime: 1720200000,
      file_size: 512000,
      status: 'UNPROCESSED',
      face_count: 1,
      face_names: ['face_1'],
      has_unassigned_faces: true,
    },
  ];

  it('should build a nested folder tree structure with accurate file and processed counts', () => {
    const tree = mediaOrganizationService.buildFolderTree(sampleFiles);
    assert.strictEqual(tree.length, 1, 'Should have 1 root node');
    const root = tree[0];
    assert.strictEqual(root.fileCount, 4, 'Root should have 4 total files');
    assert.strictEqual(root.processedCount, 2, 'Root should have 2 processed files');

    // Should have subfolders
    assert.ok(root.children.length > 0, 'Root should have children subfolders');
    const f2024 = root.children.find((c) => c.name === '2024');
    assert.ok(f2024, 'Should have 2024 folder');
    assert.strictEqual(f2024.fileCount, 2, '2024 should have 2 files');
  });

  it('should group files chronologically by Date / Timeline', () => {
    const dateGroups = mediaOrganizationService.groupByDate(sampleFiles, 'en');
    assert.ok(dateGroups.length >= 2, 'Should create date groups');
    const july2024 = dateGroups.find((g) => g.key.startsWith('2024'));
    assert.ok(july2024, 'Should have 2024 group');
    assert.strictEqual(july2024.count >= 2, true);
  });

  it('should group files by recognized person, unassigned faces, and no faces', () => {
    const personGroups = mediaOrganizationService.groupByPerson(sampleFiles);
    const aliceGroup = personGroups.find((g) => g.personName === 'Alice');
    assert.ok(aliceGroup, 'Alice group should exist');
    assert.strictEqual(aliceGroup.count, 2, 'Alice has 2 photos');

    const bobGroup = personGroups.find((g) => g.personName === 'Bob');
    assert.ok(bobGroup, 'Bob group should exist');
    assert.strictEqual(bobGroup.count, 1);

    const unrecGroup = personGroups.find((g) => g.isUnassigned);
    assert.ok(unrecGroup, 'Unassigned group should exist');

    const noFacesGroup = personGroups.find((g) => g.personName.includes('No Faces'));
    assert.ok(noFacesGroup, 'No Faces group should exist');
  });

  it('should sort media files by various fields and orders', () => {
    const sortedByNameAsc = mediaOrganizationService.sortMediaFiles(sampleFiles, 'name', 'asc');
    assert.strictEqual(sortedByNameAsc[0].filename, 'photo1.jpg');
    assert.strictEqual(sortedByNameAsc[sortedByNameAsc.length - 1].filename, 'video1.mp4');

    const sortedBySizeDesc = mediaOrganizationService.sortMediaFiles(sampleFiles, 'size', 'desc');
    assert.strictEqual(sortedBySizeDesc[0].filename, 'video1.mp4'); // 10MB
  });

  it('should format bytes and dates correctly', () => {
    assert.strictEqual(mediaOrganizationService.formatBytes(1048576), '1 MB');
    assert.strictEqual(mediaOrganizationService.formatBytes(0), '0 B');
    assert.ok(mediaOrganizationService.formatDate(1720000000, 'en').length > 0);
  });
});

describe('MediaCacheService', () => {
  it('should merge chunks, maintain order, and allow individual lookups', () => {
    const cache = new MediaCacheService();
    assert.strictEqual(cache.loadedCount, 0);

    const chunk1: GalleryMediaFile[] = [
      { filename: 'f1.jpg', file_path: '/input/f1.jpg' },
      { filename: 'f2.jpg', file_path: '/input/f2.jpg' },
    ];

    cache.mergeChunk(chunk1, 10);
    assert.strictEqual(cache.loadedCount, 2);
    assert.strictEqual(cache.total, 10);
    assert.ok(cache.get('/input/f1.jpg'));

    // Upsert
    cache.upsert({ filename: 'f1.jpg', file_path: '/input/f1.jpg', description: 'Updated' });
    assert.strictEqual(cache.get('/input/f1.jpg')?.description, 'Updated');
    assert.strictEqual(cache.loadedCount, 2);

    cache.clear();
    assert.strictEqual(cache.loadedCount, 0);
  });
});
