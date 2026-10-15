import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { extractRelativeFolderPath, buildFolderTree } from '../albumService';
import { virtualAlbumService } from '../virtualAlbumService';
import type { GalleryMediaFile } from '../../models';

describe('BUG-007 Frontend Remediations: Albums, Tree, & User Isolation', () => {
  describe('extractRelativeFolderPath', () => {
    it('should strip media_input/users/<username>/ prefix and return clean subfolder', () => {
      const p1 = 'C:/projects/media_catalog/media_input/users/admin/Vacation/2024/beach.jpg';
      assert.strictEqual(extractRelativeFolderPath(p1), 'Vacation/2024');

      const p2 = 'C:\\projects\\media_catalog\\media_input\\users\\son\\Docs\\Passport.pdf';
      assert.strictEqual(extractRelativeFolderPath(p2), 'Docs');
    });

    it('should not return "admin" or "users" as an album name', () => {
      const p = 'C:/projects/media_catalog/media_input/users/admin/single_file.jpg';
      const folder = extractRelativeFolderPath(p);
      assert.strictEqual(folder, '');
    });

    it('should handle nested deep subdirectories', () => {
      const p = 'media_input/users/admin/Family/Summer/August/photo.jpg';
      assert.strictEqual(extractRelativeFolderPath(p), 'Family/Summer/August');
    });
  });

  describe('buildFolderTree', () => {
    it('should build hierarchical tree from relative folders', () => {
      const mockFiles: GalleryMediaFile[] = [
        {
          id: '1',
          filename: 'beach.jpg',
          file_path: 'C:/projects/media_catalog/media_input/users/admin/Vacation/2024/beach.jpg',
          is_image: true,
        } as GalleryMediaFile,
        {
          id: '2',
          filename: 'hotel.jpg',
          file_path: 'C:/projects/media_catalog/media_input/users/admin/Vacation/2024/hotel.jpg',
          is_image: true,
        } as GalleryMediaFile,
        {
          id: '3',
          filename: 'report.pdf',
          file_path: 'C:/projects/media_catalog/media_input/users/admin/Work/report.pdf',
          is_image: false,
        } as GalleryMediaFile,
      ];

      const tree = buildFolderTree(mockFiles);
      assert.strictEqual(tree.length, 2);

      const vacationNode = tree.find((n) => n.name === 'Vacation');
      assert.ok(vacationNode, 'Must have Vacation node');
      assert.strictEqual(vacationNode.count, 2);
      assert.strictEqual(vacationNode.subfolders.length, 1);
      assert.strictEqual(vacationNode.subfolders[0].name, '2024');
      assert.strictEqual(vacationNode.subfolders[0].count, 2);

      const workNode = tree.find((n) => n.name === 'Work');
      assert.ok(workNode, 'Must have Work node');
      assert.strictEqual(workNode.count, 1);
    });
  });

  describe('virtualAlbumService Multi-User Isolation', () => {
    // Mock localStorage for node environment
    const storage: Record<string, string> = {};
    (global as any).localStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, val: string) => {
        storage[key] = val;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        for (const k in storage) delete storage[k];
      },
      get length() {
        return Object.keys(storage).length;
      },
      key: (i: number) => Object.keys(storage)[i] || null,
    };

    beforeEach(() => {
      (global as any).localStorage.clear();
    });

    it('should strictly isolate albums between users son and admin', async () => {
      // 1. User "son" creates album "Docs"
      virtualAlbumService.setUserId('son');
      const sonAlbum = await virtualAlbumService.createAlbum({
        title: 'Docs',
        description: 'Private documents for son',
        filePaths: ['/path/to/doc1.jpg'],
      });
      assert.strictEqual(sonAlbum.userId, 'son');

      const sonAlbums = await virtualAlbumService.getAlbums();
      assert.strictEqual(sonAlbums.length, 1);
      assert.strictEqual(sonAlbums[0].title, 'Docs');

      // 2. Switch to user "admin"
      virtualAlbumService.setUserId('admin');
      const adminAlbums = await virtualAlbumService.getAlbums();
      // Admin must NOT see son's Docs album
      assert.strictEqual(adminAlbums.length, 0, 'Admin must not see son albums');

      // 3. Admin creates album "Company"
      await virtualAlbumService.createAlbum({
        title: 'Company',
        description: 'Company photos',
        filePaths: ['/path/to/c1.jpg'],
      });

      const updatedAdminAlbums = await virtualAlbumService.getAlbums();
      assert.strictEqual(updatedAdminAlbums.length, 1);
      assert.strictEqual(updatedAdminAlbums[0].title, 'Company');

      // 4. Switch back to "son"
      virtualAlbumService.setUserId('son');
      const recheckedSonAlbums = await virtualAlbumService.getAlbums();
      assert.strictEqual(recheckedSonAlbums.length, 1);
      assert.strictEqual(recheckedSonAlbums[0].title, 'Docs');
    });
  });
});
