import type {
  GalleryMediaFile,
  FolderTreeNode,
  DateGroupNode,
  PersonGroupNode,
  MediaSortField,
  MediaSortOrder,
} from '../models/media';

export interface FilterCriteria {
  searchQuery?: string;
  typeFilter?: 'all' | 'images' | 'videos';
  statusFilter?: 'all' | 'PROCESSED' | 'UNPROCESSED' | 'PENDING';
  faceFilter?: 'all' | 'with_faces' | 'no_faces' | 'unassigned';
  selectedPerson?: string;
  selectedFolder?: string;
}

/**
 * Service to organize, structure, group, filter and sort media catalog files
 */
export class MediaOrganizationService {
  /**
   * Build a hierarchical Folder Tree from a flat list of media files
   */
  buildFolderTree(files: GalleryMediaFile[]): FolderTreeNode[] {
    const rootMap = new Map<string, FolderTreeNode>();

    const getOrCreateNode = (fullPath: string, name: string, parentPath: string, depth: number): FolderTreeNode => {
      const existing = rootMap.get(fullPath);
      if (existing) return existing;

      const node: FolderTreeNode = {
        id: fullPath || 'root',
        name: name || 'Root',
        fullPath: fullPath,
        relativePath: parentPath ? fullPath.replace(parentPath, '').replace(/^[/\\]+/, '') : name,
        depth: depth,
        isFolder: true,
        fileCount: 0,
        processedCount: 0,
        totalBytes: 0,
        children: [],
        files: [],
      };
      rootMap.set(fullPath, node);
      return node;
    };

    for (const file of files) {
      const filePath = (file.file_path || file.filename || '').replace(/\\/g, '/');
      const baseFolder = (file.folder || '').replace(/\\/g, '/');

      let relPath = filePath;
      if (baseFolder && filePath.startsWith(baseFolder)) {
        relPath = filePath.slice(baseFolder.length).replace(/^\/+/, '');
      }

      const segments = relPath.split('/').filter(Boolean);
      // Remove the last segment (the filename)
      const folderSegments = segments.length > 1 ? segments.slice(0, -1) : [];

      let currentPath = baseFolder || 'Root';
      let parentNode = getOrCreateNode(currentPath, currentPath.split('/').pop() || 'Root', '', 0);

      // Accumulate root stats
      parentNode.fileCount += 1;
      parentNode.totalBytes += file.file_size || 0;
      if (file.status === 'PROCESSED') parentNode.processedCount += 1;

      let depth = 1;
      for (const seg of folderSegments) {
        const nextPath = `${currentPath}/${seg}`;
        let childNode = rootMap.get(nextPath);
        if (!childNode) {
          childNode = getOrCreateNode(nextPath, seg, currentPath, depth);
          parentNode.children.push(childNode);
        }
        childNode.fileCount += 1;
        childNode.totalBytes += file.file_size || 0;
        if (file.status === 'PROCESSED') childNode.processedCount += 1;

        parentNode = childNode;
        currentPath = nextPath;
        depth += 1;
      }

      parentNode.files.push(file);
    }

    // Sort children alphabetically and return roots
    const rootNodes = Array.from(rootMap.values()).filter((n) => n.depth === 0);
    const sortTree = (node: FolderTreeNode) => {
      node.children.sort((a, b) => a.name.localeCompare(b.name));
      node.children.forEach(sortTree);
    };
    rootNodes.forEach(sortTree);
    return rootNodes;
  }

  /**
   * Group media files by Date / Timeline (Year -> Month)
   */
  groupByDate(files: GalleryMediaFile[], language: 'en' | 'ru' = 'en'): DateGroupNode[] {
    const groupMap = new Map<string, DateGroupNode>();
    const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthNamesRu = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

    for (const file of files) {
      let d: Date | null = null;
      if (file.mtime) {
        d = new Date(file.mtime * 1000);
      } else if (file.capture_date) {
        d = new Date(file.capture_date);
      }

      let key = 'undated';
      let year = language === 'ru' ? 'Без даты' : 'Undated';
      let label = language === 'ru' ? 'Без даты' : 'Undated';
      let month: string | undefined;

      if (d && !isNaN(d.getTime())) {
        const y = d.getFullYear();
        const mIdx = d.getMonth();
        const mName = language === 'ru' ? monthNamesRu[mIdx] : monthNamesEn[mIdx];
        key = `${y}-${String(mIdx + 1).padStart(2, '0')}`;
        year = String(y);
        month = mName;
        label = `${mName} ${y}`;
      }

      let group = groupMap.get(key);
      if (!group) {
        group = {
          key,
          label,
          year,
          month,
          count: 0,
          processedCount: 0,
          files: [],
        };
        groupMap.set(key, group);
      }

      group.count += 1;
      if (file.status === 'PROCESSED') group.processedCount += 1;
      group.files.push(file);
    }

    // Sort chronologically descending (newest first, undated last)
    return Array.from(groupMap.values()).sort((a, b) => {
      if (a.key === 'undated') return 1;
      if (b.key === 'undated') return -1;
      return b.key.localeCompare(a.key);
    });
  }

  /**
   * Group media files by Recognized Person, Unassigned Faces, and No Faces
   */
  groupByPerson(
    files: GalleryMediaFile[],
    knownPersons?: Array<{ name: string; avatarUrl?: string | null }>
  ): PersonGroupNode[] {
    const personMap = new Map<string, PersonGroupNode>();
    const avatarMap = new Map<string, string | null>();

    if (knownPersons) {
      for (const kp of knownPersons) {
        if (kp.name) {
          avatarMap.set(kp.name.toLowerCase(), kp.avatarUrl || null);
        }
      }
    }

    const getOrCreateGroup = (name: string, isUnassigned: boolean): PersonGroupNode => {
      let group = personMap.get(name);
      if (!group) {
        const avatar = avatarMap.get(name.toLowerCase()) || null;
        group = {
          personName: name,
          avatarUrl: avatar,
          count: 0,
          isUnassigned: isUnassigned,
          files: [],
        };
        personMap.set(name, group);
      }
      return group;
    };

    const unassignedGroup = getOrCreateGroup('❓ Unassigned Faces', true);
    const noFacesGroup = getOrCreateGroup('🚫 No Faces', false);

    for (const file of files) {
      const faceNames = file.face_names || [];
      const hasFaces = (file.face_count && file.face_count > 0) || (file.faces && file.faces.length > 0);

      if (!hasFaces) {
        noFacesGroup.count += 1;
        noFacesGroup.files.push(file);
        continue;
      }

      let taggedAnyKnown = false;
      for (const name of faceNames) {
        if (name && !name.startsWith('face_') && name.toLowerCase() !== 'unknown') {
          const group = getOrCreateGroup(name, false);
          group.count += 1;
          group.files.push(file);
          taggedAnyKnown = true;
        }
      }

      if (file.has_unassigned_faces || !taggedAnyKnown) {
        unassignedGroup.count += 1;
        unassignedGroup.files.push(file);
      }
    }

    // Return groups: Recognized people first (by file count desc), then Unassigned, then No Faces
    const knownGroups = Array.from(personMap.values()).filter(
      (g) => g !== unassignedGroup && g !== noFacesGroup && g.count > 0
    );
    knownGroups.sort((a, b) => b.count - a.count || a.personName.localeCompare(b.personName));

    const result: PersonGroupNode[] = [...knownGroups];
    if (unassignedGroup.count > 0) result.push(unassignedGroup);
    if (noFacesGroup.count > 0) result.push(noFacesGroup);

    return result;
  }

  /**
   * Sort array of media files
   */
  sortMediaFiles(files: GalleryMediaFile[], field: MediaSortField, order: MediaSortOrder = 'desc'): GalleryMediaFile[] {
    const dir = order === 'asc' ? 1 : -1;
    return [...files].sort((a, b) => {
      switch (field) {
        case 'name':
          return dir * (a.filename || '').localeCompare(b.filename || '');
        case 'date':
          return dir * ((a.mtime || 0) - (b.mtime || 0));
        case 'size':
          return dir * ((a.file_size || 0) - (b.file_size || 0));
        case 'status':
          return dir * (a.status || 'UNPROCESSED').localeCompare(b.status || 'UNPROCESSED');
        case 'faces':
          return dir * ((a.face_count || 0) - (b.face_count || 0));
        default:
          return 0;
      }
    });
  }

  /**
   * High performance client filtering
   */
  filterMediaFiles(files: GalleryMediaFile[], criteria: FilterCriteria): GalleryMediaFile[] {
    const trimmedSearch = (criteria.searchQuery || '').trim().toLowerCase();
    const isSearchActive = trimmedSearch.length >= 5;

    return files.filter((item) => {
      if (isSearchActive) {
        const matchDesc = Boolean(item.description && item.description.toLowerCase().includes(trimmedSearch));
        const matchDescRu = Boolean(item.description_ru && item.description_ru.toLowerCase().includes(trimmedSearch));
        const matchSummary = Boolean(item.summary && item.summary.toLowerCase().includes(trimmedSearch));
        const matchSummaryRu = Boolean(item.summary_ru && item.summary_ru.toLowerCase().includes(trimmedSearch));
        const matchName = Boolean(item.filename && item.filename.toLowerCase().includes(trimmedSearch));
        const matchFolder = Boolean(item.folder && item.folder.toLowerCase().includes(trimmedSearch));
        const matchFaces = Boolean(item.face_names && item.face_names.some((fn) => fn.toLowerCase().includes(trimmedSearch)));
        const matchOcr = Boolean(item.ocr_text && item.ocr_text.toLowerCase().includes(trimmedSearch));

        if (!matchDesc && !matchDescRu && !matchSummary && !matchSummaryRu && !matchName && !matchFolder && !matchFaces && !matchOcr) {
          return false;
        }
      }

      if (criteria.typeFilter === 'images' && !item.is_image) return false;
      if (criteria.typeFilter === 'videos' && !item.is_video) return false;

      if (criteria.statusFilter && criteria.statusFilter !== 'all') {
        const itemStatus = item.status || 'UNPROCESSED';
        if (itemStatus !== criteria.statusFilter) return false;
      }

      if (criteria.faceFilter === 'with_faces') {
        const hasFaces = (item.face_count && item.face_count > 0) || (item.faces && item.faces.length > 0);
        if (!hasFaces) return false;
      } else if (criteria.faceFilter === 'no_faces') {
        const hasFaces = (item.face_count && item.face_count > 0) || (item.faces && item.faces.length > 0);
        if (hasFaces) return false;
      } else if (criteria.faceFilter === 'unassigned') {
        if (!item.has_unassigned_faces) return false;
      }

      if (criteria.selectedPerson && criteria.selectedPerson !== 'all') {
        const hasPerson =
          (item.face_names && item.face_names.includes(criteria.selectedPerson)) ||
          (item.faces && item.faces.some((f) => f.name === criteria.selectedPerson || f.person_id === criteria.selectedPerson));
        if (!hasPerson) return false;
      }

      if (criteria.selectedFolder) {
        const target = criteria.selectedFolder.toLowerCase();
        const matchesFolder = (item.folder && item.folder.toLowerCase().includes(target)) || (item.file_path && item.file_path.toLowerCase().includes(target));
        if (!matchesFolder) return false;
      }

      return true;
    });
  }

  /**
   * Helper formatting bytes
   */
  formatBytes(bytes?: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Helper formatting date
   */
  formatDate(mtime?: number, language: 'en' | 'ru' = 'en'): string {
    if (!mtime) return '';
    try {
      const d = new Date(mtime * 1000);
      const loc = language === 'ru' ? 'ru-RU' : 'en-US';
      return d.toLocaleDateString(loc) + ' ' + d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }
}

export const mediaOrganizationService = new MediaOrganizationService();
