import React, { useState, useEffect, useMemo, useCallback, useRef, useTransition } from 'react';
import type {
  PersonItem,
  UISettings,
  GalleryMediaFile,
  DetectedFaceRecord,
  DateGroupNode,
  PersonGroupNode,
  GalleryViewMode,
  MediaSortField,
  MediaSortOrder,
  FolderTreeNode,
} from '../models';
import { useLanguage } from '../i18n/LanguageContext';
import { mediaOrganizationService } from '../services/mediaOrganizationService';


export type { GalleryMediaFile, DetectedFaceRecord };


interface InputSourcesGalleryProps {
  mediaFiles?: GalleryMediaFile[];
  isLoading?: boolean;
  isBackgroundLoading?: boolean;
  totalKnownFiles?: number | null;
  onRefresh?: () => void;
  onFetchMore?: () => void;
  onStartSingleAnalysis?: (filePath: string) => void;
  onSwitchToControls?: () => void;
  persons?: PersonItem[];
  uiSettings?: UISettings;
  disabled?: boolean;
  onReloadFaces?: () => Promise<void>;
  onViewInFamilyTree?: (personName: string, personId?: string) => void;
  currentLoadingFile?: string | null;
  currentLoadingFilename?: string | null;
  scannedFilesCount?: number;
  activeInputFolders?: string[];
}

export default function InputSourcesGallery({
  mediaFiles = [],
  isLoading = false,
  isBackgroundLoading = false,
  totalKnownFiles,
  onRefresh,
  onFetchMore,
  onStartSingleAnalysis,
  onSwitchToControls,
  persons = [],
  uiSettings,
  disabled = false,
  onReloadFaces,
  onViewInFamilyTree,
  currentLoadingFile,
  currentLoadingFilename,
  scannedFilesCount = 0,
  activeInputFolders = [],
}: InputSourcesGalleryProps) {
  const { language, t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'images' | 'videos'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PROCESSED' | 'UNPROCESSED' | 'PENDING'>('all');
  const [faceFilter, setFaceFilter] = useState<'all' | 'with_faces' | 'no_faces' | 'unassigned'>('all');
  const [selectedPerson, setSelectedPerson] = useState<string>('all');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // View & Organization modes
  const [viewMode, setViewMode] = useState<GalleryViewMode>('gallery');
  const [sortBy, setSortBy] = useState<MediaSortField>('date');
  const [sortOrder, setSortOrder] = useState<MediaSortOrder>('desc');

  // Expanded/Collapsed node sets
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root', 'Root']));
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [collapsedPersons, setCollapsedPersons] = useState<Set<string>>(new Set());

  // Configured max rows batch size (default: 10)
  const batchRows = Math.max(1, Number(uiSettings?.galleryMaxRows) || 10);
  const [loadedRows, setLoadedRows] = useState<number>(batchRows);
  const [columnCount, setColumnCount] = useState<number>(() => uiSettings?.maxImagesPerRow || 8);


  const gridRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Selected media item for full-screen Lightbox viewer
  const [selectedMedia, setSelectedMedia] = useState<GalleryMediaFile | null>(null);
  const [facesForSelected, setFacesForSelected] = useState<DetectedFaceRecord[]>([]);
  const [loadingFaces, setLoadingFaces] = useState(false);

  // In-lightbox language toggle: 'active' (follows global language) or specific 'ru' / 'en'
  const [lightboxLang, setLightboxLang] = useState<'active' | 'ru' | 'en'>('active');

  // Person tagging & reassignment state in Lightbox
  const [isAddingPerson, setIsAddingPerson] = useState(false);
  const [selectedPersonToTag, setSelectedPersonToTag] = useState('');
  const [customPersonName, setCustomPersonName] = useState('');
  const [isTagging, setIsTagging] = useState(false);

  const [reassigningFaceId, setReassigningFaceId] = useState<string | null>(null);
  const [reassignTargetPerson, setReassignTargetPerson] = useState('');
  const [reassignCustomName, setReassignCustomName] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);

  // Reset lightbox state when modal opens
  useEffect(() => {
    if (selectedMedia) {
      setLightboxLang('active');
      setIsAddingPerson(false);
      setSelectedPersonToTag('');
      setCustomPersonName('');
      setReassigningFaceId(null);
      setReassignTargetPerson('');
      setReassignCustomName('');
    }
  }, [selectedMedia]);

  // Extract distinct recognized people and face counts across all media files
  const distinctPeople = useMemo(() => {
    const counts: Record<string, number> = {};
    mediaFiles.forEach((file) => {
      if (file.face_names && Array.isArray(file.face_names)) {
        file.face_names.forEach((name) => {
          if (name) {
            counts[name] = (counts[name] || 0) + 1;
          }
        });
      }
    });

    if (Array.isArray(persons)) {
      persons.forEach((p) => {
        if (p.name && !(p.name in counts)) {
          counts[p.name] = 0;
        }
      });
    }

    return Object.entries(counts).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
  }, [mediaFiles, persons]);

  // Aggregated list of known persons with optional avatar crop
  const knownPersonOptions = useMemo(() => {
    const map = new Map<string, { name: string; avatarUrl?: string | null; count: number }>();
    if (Array.isArray(persons)) {
      persons.forEach((p) => {
        if (p.name) {
          const sample = p.sample_images && p.sample_images.length > 0 ? p.sample_images[0] : null;
          const avatar = sample ? `/api/faces/image/${sample.split(/[/\\]/).pop()}` : null;
          map.set(p.name, { name: p.name, avatarUrl: avatar, count: p.reference_count || 0 });
        }
      });
    }
    if (Array.isArray(distinctPeople)) {
      distinctPeople.forEach(([name, count]) => {
        if (name && !name.startsWith('face_') && name.toLowerCase() !== 'unknown') {
          if (!map.has(name)) {
            map.set(name, { name, avatarUrl: null, count });
          }
        }
      });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [persons, distinctPeople]);

  // Tag / Link a known or new Person to the selected media file
  const handleTagPerson = async () => {
    if (!selectedMedia) return;
    const targetName = selectedPersonToTag === '__custom__' ? customPersonName.trim() : selectedPersonToTag.trim();
    if (!targetName) return;

    setIsTagging(true);
    try {
      const res = await fetch('/api/media/add-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: selectedMedia.file_path || selectedMedia.filename,
          name: targetName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newFace: DetectedFaceRecord = data.data || {
          face_id: `manual_${Date.now()}`,
          name: targetName,
          person_id: targetName,
          confidence: 1.0,
          is_reference: 1,
          source_file: selectedMedia.file_path || selectedMedia.filename,
        };
        setFacesForSelected((prev) => [...prev, newFace]);
        setSelectedMedia((prev) => {
          if (!prev) return null;
          const existingNames = prev.face_names || [];
          const newNames = existingNames.includes(targetName) ? existingNames : [...existingNames, targetName];
          return {
            ...prev,
            face_count: (prev.face_count || 0) + 1,
            face_names: newNames,
            faces: [...(prev.faces || []), newFace],
          };
        });
        setSelectedPersonToTag('');
        setCustomPersonName('');
        setIsAddingPerson(false);
        if (onRefresh) onRefresh();
        if (onReloadFaces) onReloadFaces();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to tag person');
      }
    } catch (err) {
      console.error('Failed to tag person:', err);
    } finally {
      setIsTagging(false);
    }
  };

  // Remove or unlink a face / person from the selected media file
  const handleRemoveFace = async (faceId: string) => {
    if (!selectedMedia) return;
    try {
      const res = await fetch('/api/media/remove-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: selectedMedia.file_path || selectedMedia.filename,
          face_id: faceId,
        }),
      });
      if (res.ok) {
        setFacesForSelected((prev) => prev.filter((f) => f.face_id !== faceId));
        setSelectedMedia((prev) => {
          if (!prev) return null;
          const updatedFaces = (prev.faces || []).filter((f) => f.face_id !== faceId);
          const remainingNames = Array.from(new Set(updatedFaces.map((f) => f.name).filter(Boolean))) as string[];
          return {
            ...prev,
            face_count: Math.max(0, (prev.face_count || 1) - 1),
            face_names: remainingNames,
            faces: updatedFaces,
          };
        });
        if (onRefresh) onRefresh();
        if (onReloadFaces) onReloadFaces();
      }
    } catch (err) {
      console.error('Failed to remove face:', err);
    }
  };

  // Reassign a detected face to a known or new Person
  const handleReassignFace = async (faceId: string, targetName: string) => {
    if (!selectedMedia || !targetName.trim()) return;
    const trimmed = targetName.trim();
    setIsReassigning(true);
    try {
      const res = await fetch('/api/faces/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          face_id: faceId,
          name: trimmed,
        }),
      });
      if (res.ok) {
        setFacesForSelected((prev) =>
          prev.map((f) => (f.face_id === faceId ? { ...f, name: trimmed, person_id: trimmed, is_reference: 1 } : f))
        );
        setSelectedMedia((prev) => {
          if (!prev) return null;
          const updatedFaces = (prev.faces || []).map((f) =>
            f.face_id === faceId ? { ...f, name: trimmed, person_id: trimmed, is_reference: 1 } : f
          );
          const newNames = Array.from(new Set(updatedFaces.map((f) => f.name).filter(Boolean))) as string[];
          return {
            ...prev,
            face_names: newNames,
            faces: updatedFaces,
          };
        });
        setReassigningFaceId(null);
        setReassignTargetPerson('');
        setReassignCustomName('');
        if (onRefresh) onRefresh();
        if (onReloadFaces) onReloadFaces();
      }
    } catch (err) {
      console.error('Failed to reassign face:', err);
    } finally {
      setIsReassigning(false);
    }
  };

  // Fetch faces detected in the selected media file
  useEffect(() => {
    if (!selectedMedia) {
      setFacesForSelected([]);
      return;
    }

    let isMounted = true;
    setLoadingFaces(true);
    const fetchFaces = async () => {
      try {
        const res = await fetch(
          `/api/media/faces-for-file?file=${encodeURIComponent(selectedMedia.file_path || selectedMedia.filename)}`
        );
        if (res.ok && isMounted) {
          const data = await res.json();
          const uniqueFaces = Array.isArray(data)
            ? Array.from(new Map(data.map((f: DetectedFaceRecord) => [f.face_id, f])).values())
            : [];
          setFacesForSelected(uniqueFaces);
        }
      } catch (err) {
        console.error('Failed to load faces for file:', err);
      } finally {
        if (isMounted) setLoadingFaces(false);
      }
    };

    fetchFaces();
    return () => {
      isMounted = false;
    };
  }, [selectedMedia]);

  // Format file size
  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format timestamp
  const formatDate = (mtime?: number) => {
    if (!mtime) return '';
    try {
      const d = new Date(mtime * 1000);
      const loc = language === 'ru' ? 'ru-RU' : 'en-US';
      return d.toLocaleDateString(loc) + ' ' + d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Filtered and sorted files
  const trimmedSearch = searchQuery.trim();
  
  const [filteredFiles, setFilteredFiles] = useState<GalleryMediaFile[]>([]);
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([]);
  const [dateGroups, setDateGroups] = useState<DateGroupNode[]>([]);
  const [personGroups, setPersonGroups] = useState<PersonGroupNode[]>([]);
  
  const [, startTransition] = useTransition();

  // Async process for filtering and sorting
  useEffect(() => {
    let isActive = true;
    const processFilters = async () => {
      try {
        const filtered = await mediaOrganizationService.filterMediaFiles(mediaFiles, {
          searchQuery,
          typeFilter,
          statusFilter,
          faceFilter,
          selectedPerson,
          selectedFolder: selectedFolder || undefined,
        });
        const sorted = await mediaOrganizationService.sortMediaFiles(filtered, sortBy, sortOrder);
        
        if (isActive) {
          startTransition(() => {
            setFilteredFiles(sorted);
          });
        }
      } catch (e) {
        console.error("Filter error", e);
      }
    };
    processFilters();
    return () => { isActive = false; };
  }, [mediaFiles, searchQuery, typeFilter, statusFilter, faceFilter, selectedPerson, selectedFolder, sortBy, sortOrder]);

  // Async process for folder tree (depends only on mediaFiles)
  useEffect(() => {
    let isActive = true;
    const processTree = async () => {
      try {
        const tree = await mediaOrganizationService.buildFolderTree(mediaFiles);
        if (isActive) {
          startTransition(() => {
            setFolderTree(tree);
          });
        }
      } catch (e) {
        console.error("Tree error", e);
      }
    };
    processTree();
    return () => { isActive = false; };
  }, [mediaFiles]);

  // Async process for date groups (depends on filteredFiles and language)
  useEffect(() => {
    let isActive = true;
    const processDates = async () => {
      try {
        const dates = await mediaOrganizationService.groupByDate(filteredFiles, language === 'ru' ? 'ru' : 'en');
        if (isActive) {
          startTransition(() => {
            setDateGroups(dates);
          });
        }
      } catch (e) {
        console.error("Dates error", e);
      }
    };
    processDates();
    return () => { isActive = false; };
  }, [filteredFiles, language]);

  // Async process for person groups
  useEffect(() => {
    let isActive = true;
    const processPersons = async () => {
      try {
        const personsResult = await mediaOrganizationService.groupByPerson(filteredFiles, knownPersonOptions);
        if (isActive) {
          startTransition(() => {
            setPersonGroups(personsResult);
          });
        }
      } catch (e) {
        console.error("Persons error", e);
      }
    };
    processPersons();
    return () => { isActive = false; };
  }, [filteredFiles, knownPersonOptions]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    typeFilter !== 'all' ||
    statusFilter !== 'all' ||
    faceFilter !== 'all' ||
    selectedPerson !== 'all' ||
    selectedFolder !== null;

  const handleClearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
    setFaceFilter('all');
    setSelectedPerson('all');
    setSelectedFolder(null);
  };

  // Toggle folder expansion in tree view
  const toggleFolderExpand = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  // Toggle date group collapse
  const toggleDateCollapse = (dateKey: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  // Toggle person group collapse
  const togglePersonCollapse = (personName: string) => {
    setCollapsedPersons((prev) => {
      const next = new Set(prev);
      if (next.has(personName)) {
        next.delete(personName);
      } else {
        next.add(personName);
      }
      return next;
    });
  };

  // Handle column header sort toggle
  const handleSortToggle = (field: MediaSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  // Lightbox Navigation
  const currentIndex = useMemo(() => {
    if (!selectedMedia) return -1;
    return filteredFiles.findIndex((f) => f.file_path === selectedMedia.file_path);
  }, [selectedMedia, filteredFiles]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setSelectedMedia(filteredFiles[currentIndex - 1]);
    }
  }, [currentIndex, filteredFiles]);

  const handleNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < filteredFiles.length - 1) {
      setSelectedMedia(filteredFiles[currentIndex + 1]);
    }
  }, [currentIndex, filteredFiles]);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (!selectedMedia) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedMedia(null);
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMedia, handlePrev, handleNext]);

  // Reset loaded rows on filter/search change, folder change, or batch size change
  useEffect(() => {
    setLoadedRows(batchRows);
  }, [batchRows, searchQuery, typeFilter, statusFilter, faceFilter, selectedPerson, selectedFolder, sortBy, sortOrder, mediaFiles.length]);


  // Dynamically detect column count
  const updateColumnCount = useCallback(() => {
    if (!gridRef.current) return;
    const computed = window.getComputedStyle(gridRef.current);
    const cols = computed.gridTemplateColumns.split(' ').filter(Boolean).length;
    if (cols > 0) {
      setColumnCount(cols);
    }
  }, []);

  useEffect(() => {
    updateColumnCount();
    const gridElem = gridRef.current;
    if (!gridElem) return;

    const resizeObserver = new ResizeObserver(() => {
      updateColumnCount();
    });
    resizeObserver.observe(gridElem);

    window.addEventListener('resize', updateColumnCount);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateColumnCount);
    };
  }, [updateColumnCount]);

  const effectiveCols = Math.max(1, columnCount);
  const visibleCount = loadedRows * effectiveCols;
  const visibleFiles = useMemo(() => {
    return filteredFiles.slice(0, visibleCount);
  }, [filteredFiles, visibleCount]);
  const canFetchMoreFromBackend = Boolean(
    onFetchMore && totalKnownFiles !== null && totalKnownFiles !== undefined && mediaFiles.length < totalKnownFiles
  );
  const hasMore = visibleCount < filteredFiles.length || canFetchMoreFromBackend;

  const loadMoreRows = useCallback(() => {
    if (visibleCount < filteredFiles.length) {
      setLoadedRows((prev) => prev + batchRows);
    } else if (onFetchMore) {
      onFetchMore();
      setLoadedRows((prev) => prev + batchRows);
    }
  }, [visibleCount, filteredFiles.length, batchRows, onFetchMore]);

  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(800);

  // IntersectionObserver on sentinel to load next rows when scrolled into view
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreRows();
        }
      },
      {
        root: containerRef.current || null,
        rootMargin: '200px',
        threshold: 0.05,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMoreRows]);

  const handleContainerScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      setScrollTop(target.scrollTop);
      setContainerHeight(target.clientHeight || 800);
      const { scrollTop: st, scrollHeight, clientHeight } = target;
      if (scrollHeight - st - clientHeight < 400 && hasMore) {
        loadMoreRows();
      }
    },
    [hasMore, loadMoreRows]
  );

  // Virtual windowing calculations for Grid view (card height ~260px)
  const CARD_ROW_HEIGHT = 260;
  const OVERSCAN_GRID_ROWS = 3;
  const totalGalleryRows = Math.ceil(visibleFiles.length / effectiveCols);
  const startGalleryRow = Math.max(0, Math.floor(scrollTop / CARD_ROW_HEIGHT) - OVERSCAN_GRID_ROWS);
  const endGalleryRow = Math.min(totalGalleryRows, Math.ceil((scrollTop + containerHeight) / CARD_ROW_HEIGHT) + OVERSCAN_GRID_ROWS);
  const startGalleryIndex = startGalleryRow * effectiveCols;
  const endGalleryIndex = Math.min(visibleFiles.length, endGalleryRow * effectiveCols);
  const virtualizedGalleryFiles = useMemo(() => {
    return visibleFiles.slice(startGalleryIndex, endGalleryIndex);
  }, [visibleFiles, startGalleryIndex, endGalleryIndex]);

  const galleryTopPadding = startGalleryRow * CARD_ROW_HEIGHT;
  const galleryBottomPadding = Math.max(0, (totalGalleryRows - endGalleryRow) * CARD_ROW_HEIGHT);

  // Virtual windowing calculations for List view (row height ~48px)
  const TABLE_ROW_HEIGHT = 48;
  const OVERSCAN_LIST_ROWS = 6;
  const totalListRows = visibleFiles.length;
  const startListRow = Math.max(0, Math.floor(scrollTop / TABLE_ROW_HEIGHT) - OVERSCAN_LIST_ROWS);
  const endListRow = Math.min(totalListRows, Math.ceil((scrollTop + containerHeight) / TABLE_ROW_HEIGHT) + OVERSCAN_LIST_ROWS);
  const virtualizedListFiles = useMemo(() => {
    return visibleFiles.slice(startListRow, endListRow);
  }, [visibleFiles, startListRow, endListRow]);

  const listTopPadding = startListRow * TABLE_ROW_HEIGHT;
  const listBottomPadding = Math.max(0, (totalListRows - endListRow) * TABLE_ROW_HEIGHT);

  const totalCount = mediaFiles.length;
  const processedCount = mediaFiles.filter((f) => f.status === 'PROCESSED').length;
  const imageCount = mediaFiles.filter((f) => f.is_image).length;
  const videoCount = mediaFiles.filter((f) => f.is_video).length;

  // Effective language in Lightbox
  const activeDetailLang = lightboxLang === 'active' ? language : lightboxLang;

  // Render single media card item with thumbnail miniature and async decoding
  const renderCardItem = (file: GalleryMediaFile) => {
    const thumbUrl = `/api/media/thumbnail?path=${encodeURIComponent(file.file_path || file.filename)}&size=360`;
    const isProcessed = file.status === 'PROCESSED';
    const isPending = file.status === 'PENDING';

    const localizedDescription =
      language === 'ru'
        ? file.description_ru || file.description || file.summary_ru || file.summary
        : file.description || file.description_ru || file.summary || file.summary_ru;

    return (
      <div
        className="gallery-card-item"
        key={file.file_path || file.filename}
        onClick={() => setSelectedMedia(file)}
        title={`${t('clickToView')}: ${file.filename}`}
      >
        <div className="gallery-thumb-wrap">
          {file.is_image ? (
            <>
              <img
                src={thumbUrl}
                alt={file.filename}
                className="gallery-thumb-img"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div
                className="gallery-thumb-fallback-placeholder"
                style={{
                  display: 'none',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  flexDirection: 'column',
                  background: 'rgba(255, 255, 255, 0.03)',
                  color: 'var(--text-muted)',
                }}
              >
                <span style={{ fontSize: '1.8rem' }}>📷</span>
                <span style={{ fontSize: '0.68rem', marginTop: '4px', textAlign: 'center', padding: '0 4px' }}>
                  {file.filename}
                </span>
              </div>
            </>
          ) : (
            <div className="gallery-thumb-video-placeholder">
              <span style={{ fontSize: '2rem' }}>🎥</span>
            </div>
          )}

          {/* Media Type & Status Badges */}
          <div className="gallery-thumb-badges">
            {/* <span className="gallery-tag gallery-tag-type">
              {file.is_video ? '🎥' : '📷'}
            </span> */}
            {Boolean(file.face_count && file.face_count > 0) && (
              <span
                className="gallery-tag gallery-tag-faces"
                title={`${file.face_count} ${t('cardFaceCount')}`}
              >
                👤 {file.face_count}
              </span>
            )}
            {file.family_context && (
              <span
                className="gallery-tag gallery-tag-family"
                style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)', color: '#ffffff', fontWeight: 600 }}
                title={file.family_context?.suggested_caption || 'Family Kinship Context'}
              >
               {/* 🌳 */}
              </span>
            )}
            <span
              className={`gallery-tag ${
                isProcessed
                  ? 'gallery-tag-processed'
                  : isPending
                  ? 'gallery-tag-pending'
                  : 'gallery-tag-unprocessed'
              }`}
            >
              {/* {isProcessed ? '✓' : isPending ? '⏳' : '○'} */}
            </span>
          </div>
        </div>

        <div className="gallery-card-info">
          <div className="gallery-card-title" title={file.filename}>
            {file.filename}
          </div>

          {localizedDescription && (
            <div
              className="gallery-card-desc"
              title={localizedDescription}
            >
              {localizedDescription}
            </div>
          )}

          {file.face_names && file.face_names.length > 0 && (
            <div className="gallery-card-faces-row" title={`Recognized: ${file.face_names.join(', ')}`}>
              {file.face_names.slice(0, 2).map((name) => (
                <span key={name} className="gallery-face-chip">
                  👤 {name}
                </span>
              ))}
              {file.face_names.length > 2 && (
                <span className="gallery-face-chip-more">
                  +{file.face_names.length - 2} {t('cardMoreFaces')}
                </span>
              )}
            </div>
          )}
          <div className="gallery-card-meta">
            <span>{formatBytes(file.file_size)}</span>
            {file.folder && (
              <span className="gallery-card-folder" title={file.folder}>
                📁 {file.folder.split(/[/\\]/).pop()}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render recursive Folder Tree node
  const renderTreeNode = (node: FolderTreeNode) => {
    const isExpanded = expandedFolders.has(node.fullPath) || expandedFolders.has(node.id);
    const isSelected = selectedFolder === node.fullPath;
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.fullPath} className="folder-tree-item-wrap">
        <div
          className={`folder-tree-row ${isSelected ? 'active' : ''}`}
          style={{ paddingLeft: `${node.depth * 14 + 6}px` }}
          onClick={() => setSelectedFolder(isSelected ? null : node.fullPath)}
        >
          {hasChildren ? (
            <button
              type="button"
              className="folder-tree-toggle-btn"
              onClick={(e) => {
                e.stopPropagation();
                toggleFolderExpand(node.fullPath);
              }}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          ) : (
            <span className="folder-tree-spacer" />
          )}

          <span className="folder-tree-icon">{isExpanded ? '📂' : '📁'}</span>
          <span className="folder-tree-name" title={node.fullPath}>
            {node.name}
          </span>
          <span className="folder-tree-badge" title={`${node.processedCount}/${node.fileCount} processed`}>
            {node.fileCount}
          </span>
        </div>

        {hasChildren && isExpanded && (
          <div className="folder-tree-children">
            {node.children.map((child) => renderTreeNode(child))}
          </div>
        )}
      </div>
    );
  };

  // 1. Gallery Grid View with Virtual Windowing
  const renderGalleryView = () => (
    <>
      <div
        className="gallery-grid"
        ref={gridRef}
        style={{
          '--gallery-item-min-width': '140px',
          paddingTop: galleryTopPadding > 0 ? `${galleryTopPadding}px` : undefined,
          paddingBottom: galleryBottomPadding > 0 ? `${galleryBottomPadding}px` : undefined,
        } as React.CSSProperties}
      >
        {virtualizedGalleryFiles.map((file) => renderCardItem(file))}
      </div>
      <div ref={sentinelRef} style={{ height: '6px', width: '100%' }} />
    </>
  );

  // 2. Tabular List View with Virtual Windowing
  const renderListView = () => (
    <div className="media-list-table-wrap">
      <table className="media-list-table">
        <thead>
          <tr>
            <th style={{ width: '44px' }}></th>
            <th onClick={() => handleSortToggle('name')} className="sortable-th">
              {t('colFilename')} {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th style={{ width: '130px' }}>{t('colFolder')}</th>
            <th style={{ width: '80px' }}>{t('colType')}</th>
            <th onClick={() => handleSortToggle('size')} className="sortable-th" style={{ width: '90px' }}>
              {t('colSize')} {sortBy === 'size' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => handleSortToggle('date')} className="sortable-th" style={{ width: '130px' }}>
              {t('colDate')} {sortBy === 'date' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => handleSortToggle('status')} className="sortable-th" style={{ width: '110px' }}>
              {t('colStatus')} {sortBy === 'status' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => handleSortToggle('faces')} className="sortable-th" style={{ width: '140px' }}>
              {t('colFaces')} {sortBy === 'faces' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th style={{ width: '70px', textAlign: 'center' }}>{t('colActions')}</th>
          </tr>
        </thead>
        <tbody>
          {listTopPadding > 0 && <tr style={{ height: `${listTopPadding}px` }}><td colSpan={9} /></tr>}
          {virtualizedListFiles.map((file) => {
            const thumbUrl = `/api/media/thumbnail?path=${encodeURIComponent(file.file_path || file.filename)}&size=120`;
            const isProcessed = file.status === 'PROCESSED';
            const isPending = file.status === 'PENDING';

            return (
              <tr
                key={file.file_path || file.filename}
                className="media-list-row"
                onClick={() => setSelectedMedia(file)}
              >
                <td style={{ textAlign: 'center' }}>
                  {file.is_image ? (
                    <img
                      src={thumbUrl}
                      alt={file.filename}
                      className="media-list-thumb"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span style={{ fontSize: '1.2rem' }}>🎥</span>
                  )}
                </td>
                <td>
                  <div className="media-list-title" title={file.file_path || file.filename}>
                    {file.filename}
                  </div>
                  {Boolean(file.summary || file.summary_ru) && (
                    <div className="media-list-subdesc">
                      {language === 'ru' ? file.summary_ru || file.summary : file.summary || file.summary_ru}
                    </div>
                  )}
                </td>
                <td className="media-list-folder" title={file.folder}>
                  📁 {file.folder ? file.folder.split(/[/\\]/).pop() : '-'}
                </td>
                <td>
                  <span className="badge-pill" style={{ fontSize: '0.72rem', padding: '2px 6px' }}>
                    {file.is_video ? '🎥 Video' : '📷 Photo'}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{formatBytes(file.file_size)}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{formatDate(file.mtime)}</td>
                <td>
                  <span
                    className={`badge-pill ${
                      isProcessed
                        ? 'badge-pill-success'
                        : isPending
                        ? 'badge-pill-accent'
                        : 'badge-pill-secondary'
                    }`}
                    style={{ fontSize: '0.72rem', padding: '2px 6px' }}
                  >
                    {isProcessed ? '✓ Processed' : isPending ? '⏳ Pending' : '○ Unprocessed'}
                  </span>
                </td>
                <td>
                  {file.face_names && file.face_names.length > 0 ? (
                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                      {file.face_names.slice(0, 2).map((fn) => (
                        <span key={fn} className="gallery-face-chip" style={{ fontSize: '0.7rem' }}>
                          👤 {fn}
                        </span>
                      ))}
                      {file.face_names.length > 2 && (
                        <span className="gallery-face-chip-more" style={{ fontSize: '0.7rem' }}>
                          +{file.face_names.length - 2}
                        </span>
                      )}
                    </div>
                  ) : file.face_count && file.face_count > 0 ? (
                    <span style={{ color: '#ec4899', fontSize: '0.78rem' }}>👤 {file.face_count}</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMedia(file);
                    }}
                    title={t('clickToView')}
                  >
                    👁️
                  </button>
                </td>
              </tr>
            );
          })}
          {listBottomPadding > 0 && <tr style={{ height: `${listBottomPadding}px` }}><td colSpan={9} /></tr>}
        </tbody>
      </table>
      <div ref={sentinelRef} style={{ height: '6px', width: '100%' }} />
    </div>
  );

  // 3. Folder Tree View
  const renderFolderTreeView = () => (
    <div className="folder-tree-layout">
      {/* Tree Explorer Sidebar */}
      <div className="folder-tree-sidebar">
        <div className="folder-tree-sidebar-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>🗂️ {t('treeAllFolders')}</span>
            {selectedFolder && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                onClick={() => setSelectedFolder(null)}
                title={t('clearFolderFilter')}
              >
                ✕ {t('btnResetFilters')}
              </button>
            )}
          </div>
        </div>
        <div className="folder-tree-sidebar-body">
          {folderTree.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '0.5rem' }}>
              {t('treeNoFolders')}
            </p>
          ) : (
            folderTree.map((rootNode) => renderTreeNode(rootNode))
          )}
        </div>
      </div>

      {/* Folder Files Content */}
      <div className="folder-tree-content">
        {selectedFolder && (
          <div className="folder-tree-active-bar">
            <span>
              📁 <strong>{selectedFolder}</strong> ({filteredFiles.length} {t('badgeMediaFiles')})
            </span>
            <button
              type="button"
              className="search-clear-inline-btn"
              onClick={() => setSelectedFolder(null)}
              title={t('clearFolderFilter')}
            >
              ✕
            </button>
          </div>
        )}

        {filteredFiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <p>{t('noMediaFound')}</p>
          </div>
        ) : (
          renderGalleryView()
        )}
      </div>
    </div>
  );

  // 4. Date / Timeline Grouped View
  const renderDateGroupedView = () => (
    <div className="grouped-sections-wrap">
      {dateGroups.map((group) => {
        const isCollapsed = collapsedDates.has(group.key);
        return (
          <div key={group.key} className="grouped-card-section">
            <div
              className="grouped-section-header"
              onClick={() => toggleDateCollapse(group.key)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="folder-tree-toggle-btn">{isCollapsed ? '▶' : '▼'}</span>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>📅 {group.label}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <span className="badge-pill badge-pill-accent" style={{ fontSize: '0.75rem' }}>
                  {group.count} {t('badgeMediaFiles')}
                </span>
                <span className="badge-pill badge-pill-success" style={{ fontSize: '0.75rem' }}>
                  {group.processedCount} {t('badgeCataloged')}
                </span>
              </div>
            </div>

            {!isCollapsed && (
              <div className="grouped-section-body">
                <div
                  className="gallery-grid"
                  style={{
                    '--gallery-item-min-width': '140px',
                  } as React.CSSProperties}
                >
                  {group.files.map((file: GalleryMediaFile) => renderCardItem(file))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // 5. Person Grouped View
  const renderPersonGroupedView = () => (
    <div className="grouped-sections-wrap">
      {personGroups.map((group) => {
        const isCollapsed = collapsedPersons.has(group.personName);
        return (
          <div key={group.personName} className="grouped-card-section">
            <div
              className="grouped-section-header"
              onClick={() => togglePersonCollapse(group.personName)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span className="folder-tree-toggle-btn">{isCollapsed ? '▶' : '▼'}</span>
                {group.avatarUrl ? (
                  <img
                    src={group.avatarUrl}
                    alt={group.personName}
                    style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <span>👤</span>
                )}
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {group.personName}
                </span>
              </div>
              <span className="badge-pill badge-pill-accent" style={{ fontSize: '0.75rem' }}>
                {group.count} {t('badgeMediaFiles')}
              </span>
            </div>

            {!isCollapsed && (
              <div className="grouped-section-body">
                <div
                  className="gallery-grid"
                  style={{
                    '--gallery-item-min-width': '140px',
                  } as React.CSSProperties}
                >
                  {group.files.map((file: GalleryMediaFile) => renderCardItem(file))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="card media-gallery-card">
      <div className="gallery-header-row">
        <div className="gallery-title-wrap">
          <h2 style={{ margin: 0 }}>{t('galleryTitle')}</h2>
          <div className="gallery-stats-badges">
            <span className="badge-pill badge-pill-accent">
              {totalCount} {t('badgeMediaFiles')}
            </span>
            <span className="badge-pill badge-pill-success">
              {processedCount} {t('badgeCataloged')}
            </span>
            <span className="badge-pill badge-pill-secondary">
              📷 {imageCount} {t('badgePhotos')}
            </span>
            <span className="badge-pill badge-pill-secondary">
              🎥 {videoCount} {t('badgeVideos')}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View Switcher Button Group */}
          <div className="filter-button-group view-switcher-group">
            <button
              type="button"
              className={`filter-btn ${viewMode === 'gallery' ? 'active' : ''}`}
              onClick={() => setViewMode('gallery')}
              title={t('viewModeGallery')}
            >
              🔲 {t('viewModeGallery')}
            </button>
            <button
              type="button"
              className={`filter-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title={t('viewModeList')}
            >
              📋 {t('viewModeList')}
            </button>
            <button
              type="button"
              className={`filter-btn ${viewMode === 'folder_tree' ? 'active' : ''}`}
              onClick={() => setViewMode('folder_tree')}
              title={t('viewModeTree')}
            >
              📁 {t('viewModeTree')}
            </button>
            <button
              type="button"
              className={`filter-btn ${viewMode === 'date_grouped' ? 'active' : ''}`}
              onClick={() => setViewMode('date_grouped')}
              title={t('viewModeDate')}
            >
              📅 {t('viewModeDate')}
            </button>
            <button
              type="button"
              className={`filter-btn ${viewMode === 'person_grouped' ? 'active' : ''}`}
              onClick={() => setViewMode('person_grouped')}
              title={t('viewModePerson')}
            >
              👥 {t('viewModePerson')}
            </button>
          </div>

          {onRefresh && (
            <button
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={onRefresh}
              disabled={isLoading || disabled}
              type="button"
              title={t('btnRefreshGallery')}
            >
              <span >🔄</span>
              <span>{t('btnRefreshGallery')}</span>
            </button>
          )}

          {onSwitchToControls && (
            <button
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
              onClick={onSwitchToControls}
              type="button"
              title={t('btnControlsSwitch')}
            >
              ⚙️ {t('btnControlsSwitch')}
            </button>
          )}
        </div>
      </div>

      {/* Filter, Sort and Search Bar */}
      <div className="gallery-filters-row">
        <div className="search-box" style={{ flex: 1, minWidth: '240px', margin: 0, position: 'relative' }}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="input-control"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingRight: searchQuery ? '5rem' : '1rem' }}
          />
          {searchQuery && (
            <div className="search-status-tag-wrap">
              {trimmedSearch.length > 0 && trimmedSearch.length < 5 ? (
                <span className="search-min-hint" title={t('searchHint')}>
                  {trimmedSearch.length}/5
                </span>
              ) : (
                <span className="search-active-hint" title="Active">
                  ✓ {t('searchActiveStatus')}
                </span>
              )}
              <button
                type="button"
                className="search-clear-inline-btn"
                onClick={() => setSearchQuery('')}
                title="Clear"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Active Folder Filter Tag */}
          {selectedFolder && (
            <span
              className="badge-pill badge-pill-accent"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}
            >
              📁 {selectedFolder.split(/[/\\]/).pop()}
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
                onClick={() => setSelectedFolder(null)}
                title={t('clearFolderFilter')}
              >
                ✕
              </button>
            </span>
          )}

          {/* Type Filter */}
          <div className="filter-button-group">
            <button
              className={`filter-btn ${typeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTypeFilter('all')}
              type="button"
            >
              {t('filterAllTypes')}
            </button>
            <button
              className={`filter-btn ${typeFilter === 'images' ? 'active' : ''}`}
              onClick={() => setTypeFilter('images')}
              type="button"
            >
              {t('filterImages')}
            </button>
            <button
              className={`filter-btn ${typeFilter === 'videos' ? 'active' : ''}`}
              onClick={() => setTypeFilter('videos')}
              type="button"
            >
              {t('filterVideos')}
            </button>
          </div>

          {/* Status Filter */}
          <div className="filter-button-group">
            <button
              className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
              type="button"
            >
              {t('filterAllStatus')}
            </button>
            <button
              className={`filter-btn ${statusFilter === 'PROCESSED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('PROCESSED')}
              type="button"
            >
              {t('filterProcessed')}
            </button>
            <button
              className={`filter-btn ${statusFilter === 'UNPROCESSED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('UNPROCESSED')}
              type="button"
            >
              {t('filterUnprocessed')}
            </button>
            <button
              className={`filter-btn ${statusFilter === 'PENDING' ? 'active' : ''}`}
              onClick={() => setStatusFilter('PENDING')}
              type="button"
            >
              {t('filterPending')}
            </button>
          </div>

          {/* Face Mode Filter */}
          <div className="filter-button-group">
            <button
              className={`filter-btn ${faceFilter === 'all' ? 'active' : ''}`}
              onClick={() => setFaceFilter('all')}
              type="button"
            >
              {t('filterFaceAll')}
            </button>
            <button
              className={`filter-btn ${faceFilter === 'with_faces' ? 'active' : ''}`}
              onClick={() => setFaceFilter('with_faces')}
              type="button"
            >
              {t('filterFaceWith')}
            </button>
            <button
              className={`filter-btn ${faceFilter === 'no_faces' ? 'active' : ''}`}
              onClick={() => setFaceFilter('no_faces')}
              type="button"
            >
              {t('filterFaceWithout')}
            </button>
            <button
              className={`filter-btn ${faceFilter === 'unassigned' ? 'active' : ''}`}
              onClick={() => setFaceFilter('unassigned')}
              type="button"
            >
              {t('filterFaceUnassigned')}
            </button>
          </div>

          {/* Person Dropdown */}
          <select
            className="input-control"
            value={selectedPerson}
            onChange={(e) => setSelectedPerson(e.target.value)}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem', minWidth: '120px' }}
          >
            <option value="all">{t('filterPersonAll')}</option>
            {distinctPeople.map(([name, count]) => (
              <option key={name} value={name}>
                👤 {name} ({count})
              </option>
            ))}
          </select>

          {/* Sort Field & Order */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <select
              className="input-control"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as MediaSortField)}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem', minWidth: '100px' }}
              title={t('sortBy')}
            >
              <option value="date">📅 {t('colDate')}</option>
              <option value="name">🔤 {t('colFilename')}</option>
              <option value="size">💾 {t('colSize')}</option>
              <option value="status">📊 {t('colStatus')}</option>
              <option value="faces">👤 {t('colFaces')}</option>
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              title={`${t('sortOrder')}: ${sortOrder === 'asc' ? t('sortAsc') : t('sortDesc')}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          {hasActiveFilters && (
            <button
              className="btn btn-secondary"
              onClick={handleClearFilters}
              type="button"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', color: '#f87171' }}
            >
              {t('btnResetFilters')}
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area based on View Mode */}
      <div
        className="gallery-grid-container"
        ref={containerRef}
        onScroll={handleContainerScroll}
      >
        {isLoading && mediaFiles.length === 0 ? (
          <div className="gallery-loading-overlay">
            <div className="gallery-spinner-ring-wrap">
              <div className="gallery-spinner-ring" />
              <span className="gallery-spinner-inner-icon">📁</span>
            </div>
            <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.15rem', color: 'var(--text-primary)' }}>
              {t('scanningSources')}
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '440px' }}>
              {language === 'ru'
                ? 'Индексирование и загрузка медиафайлов из настроенных папок источников...'
                : 'Indexing and loading media files from configured input sources...'}
            </p>

            {/* Currently loaded file / input folder under spinner */}
            {(currentLoadingFile || currentLoadingFilename || (activeInputFolders && activeInputFolders.length > 0)) && (
              <div className="gallery-spinner-current-file-badge">
                <span className="gallery-spinner-current-file-label">
                  {currentLoadingFile || currentLoadingFilename
                    ? (language === 'ru' ? 'Обработка:' : 'Processing:')
                    : (language === 'ru' ? 'Папка источника:' : 'Input folder:')}
                </span>
                <span
                  className="gallery-spinner-current-file-name"
                  title={currentLoadingFile || activeInputFolders?.join(', ')}
                >
                  {currentLoadingFilename || (currentLoadingFile ? currentLoadingFile.split(/[/\\]/).pop() : `📁 ${activeInputFolders?.[0]}`)}
                </span>
              </div>
            )}

            {Boolean(scannedFilesCount && scannedFilesCount > 0) && (
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span className="spinner-icon">⚡</span>
                <span>
                  {language === 'ru'
                    ? `Найдено файлов: ${scannedFilesCount.toLocaleString()}`
                    : `Discovered files: ${scannedFilesCount.toLocaleString()}`}
                </span>
              </div>
            )}
          </div>
        ) : filteredFiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}>{t('noMediaFound')}</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {searchQuery || typeFilter !== 'all' || statusFilter !== 'all' || selectedFolder
                ? t('noMediaHintFiltered')
                : t('noMediaHintEmpty')}
            </p>
          </div>
        ) : (
          <>
            {(isLoading || isBackgroundLoading) && (
              <div className="gallery-scanning-banner">
                <div className="gallery-scanning-banner-left">
                  <span className="spinner-icon" style={{ fontSize: '1.25rem' }}>🔄</span>
                  <div>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      {isBackgroundLoading
                        ? (language === 'ru' ? 'Фоновая загрузка медиаархива...' : 'Background loading media library...')
                        : t('scanningSources')}
                    </strong>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {language === 'ru'
                        ? `Загружено ${mediaFiles.length.toLocaleString()} из ${(totalKnownFiles || scannedFilesCount || mediaFiles.length).toLocaleString()} файлов. Галерея готова к работе!`
                        : `Loaded ${mediaFiles.length.toLocaleString()} of ${(totalKnownFiles || scannedFilesCount || mediaFiles.length).toLocaleString()} files. Gallery is ready to browse!`}
                    </span>
                    {(currentLoadingFilename || currentLoadingFile) && (
                      <span
                        className="gallery-scanning-current-file-pill"
                        title={currentLoadingFile || currentLoadingFilename || ''}
                      >
                        📄 {currentLoadingFilename || (currentLoadingFile ? currentLoadingFile.split(/[/\\]/).pop() : '')}
                      </span>
                    )}
                  </div>
                </div>
                <span className="badge-pill badge-pill-accent" style={{ fontSize: '0.75rem' }}>
                  {totalKnownFiles || scannedFilesCount > 0 ? `${(totalKnownFiles || scannedFilesCount).toLocaleString()} ` : `${totalCount} `}
                  {t('badgeMediaFiles')}
                </span>
              </div>
            )}

            {viewMode === 'gallery' && renderGalleryView()}
            {viewMode === 'list' && renderListView()}
            {viewMode === 'folder_tree' && renderFolderTreeView()}
            {viewMode === 'date_grouped' && renderDateGroupedView()}
            {viewMode === 'person_grouped' && renderPersonGroupedView()}

            {/* Pagination & Infinite Row Status Footer */}
            {filteredFiles.length > 0 && (
              <div
                className="gallery-pagination-footer"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 0.5rem 0.25rem 0.5rem',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  marginTop: '0.75rem',
                }}
              >
                <span>
                  {t('showingFilesCount')}: <strong>{Math.min(visibleFiles.length, filteredFiles.length)}</strong> / {filteredFiles.length} {t('badgeMediaFiles')}
                  {' '}({Math.min(loadedRows, Math.ceil(filteredFiles.length / effectiveCols))} / {Math.ceil(filteredFiles.length / effectiveCols)} rows)
                </span>

                {hasMore ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.3rem 0.8rem', fontSize: '0.78rem' }}
                    onClick={loadMoreRows}
                    title={t('loadNextChunkBtn')}
                  >
                    ⬇️ {t('loadNextChunkBtn')} (+{batchRows})
                  </button>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    ✓ {t('allLoaded')}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox / Media Viewer Modal */}

      {selectedMedia && (
        <div className="modal-overlay active" onClick={() => setSelectedMedia(null)}>
          <div
            className="modal-card media-lightbox-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '1120px', width: '92vw', padding: 0 }}
          >
            {/* Lightbox Header */}
            <div className="media-lightbox-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', minWidth: 0 }}>
                <span style={{ fontSize: '1.2rem' }}>{selectedMedia.is_video ? '🎥' : '📷'}</span>
                <div style={{ minWidth: 0 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '1.05rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={selectedMedia.filename}
                  >
                    {selectedMedia.filename}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {formatBytes(selectedMedia.file_size)} • {formatDate(selectedMedia.mtime)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {/* Language View Switcher inside Lightbox */}
                <div
                  className="lang-switcher-wrap"
                  style={{ marginRight: '0.5rem' }}
                  title={t('langPreviewToggle')}
                >
                  <button
                    type="button"
                    className={`lang-btn ${activeDetailLang === 'ru' ? 'active' : ''}`}
                    onClick={() => setLightboxLang('ru')}
                    title="Русский"
                  >
                    🇷🇺 RU
                  </button>
                  <button
                    type="button"
                    className={`lang-btn ${activeDetailLang === 'en' ? 'active' : ''}`}
                    onClick={() => setLightboxLang('en')}
                    title="English"
                  >
                    🇬🇧 EN
                  </button>
                </div>

                <button
                  className="btn-icon"
                  onClick={handlePrev}
                  disabled={currentIndex <= 0}
                  title={t('prevImageTooltip')}
                  type="button"
                >
                  ◀
                </button>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0 0.3rem' }}>
                  {currentIndex + 1} / {filteredFiles.length}
                </span>
                <button
                  className="btn-icon"
                  onClick={handleNext}
                  disabled={currentIndex >= filteredFiles.length - 1}
                  title={t('nextImageTooltip')}
                  type="button"
                >
                  ▶
                </button>
                <button
                  className="close-btn"
                  onClick={() => setSelectedMedia(null)}
                  type="button"
                  title={t('closeTooltip')}
                  style={{ marginLeft: '0.5rem' }}
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Lightbox Main Content Grid */}
            <div className="media-lightbox-body">
              {/* Media Preview Viewport */}
              <div className="media-lightbox-preview">
                {selectedMedia.is_video ? (
                  <video
                    src={`/api/media/file?path=${encodeURIComponent(selectedMedia.file_path || selectedMedia.filename)}`}
                    controls
                    autoPlay
                    className="media-lightbox-video"
                  />
                ) : (
                  <>
                    <img
                      src={`/api/media/file?path=${encodeURIComponent(selectedMedia.file_path || selectedMedia.filename)}`}
                      alt={selectedMedia.filename}
                      className="media-lightbox-image"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div
                      style={{
                        display: 'none',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        width: '100%',
                        height: '100%',
                        padding: '3rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📷</span>
                      <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {selectedMedia.filename}
                      </p>
                      <span style={{ fontSize: '0.82rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                        {selectedMedia.file_path}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Media Sidebar / Details Panel */}
              <div className="media-lightbox-sidebar">
                {/* File Details Section */}
                <div className="lightbox-section">
                  <h4 className="lightbox-section-title">{t('fileDetails')}</h4>
                  <div className="lightbox-detail-row">
                    <span className="lightbox-label">{t('fullPath')}:</span>
                    <span className="lightbox-value" title={selectedMedia.file_path || selectedMedia.filename}>
                      {selectedMedia.file_path || selectedMedia.filename}
                    </span>
                  </div>
                  <div className="lightbox-detail-row">
                    <span className="lightbox-label">{t('status')}:</span>
                    <span
                      className={`badge-pill ${
                        selectedMedia.status === 'PROCESSED'
                          ? 'badge-pill-success'
                          : selectedMedia.status === 'PENDING'
                          ? 'badge-pill-warning'
                          : 'badge-pill-secondary'
                      }`}
                    >
                      {selectedMedia.status || 'UNPROCESSED'}
                    </span>
                  </div>
                  {selectedMedia.sidecar_path && (
                    <div className="lightbox-detail-row">
                      <span className="lightbox-label">{t('sidecar')}:</span>
                      <span className="lightbox-value" title={selectedMedia.sidecar_path}>
                        {selectedMedia.sidecar_path.split(/[/\\]/).pop()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Family Tree Kinship & Context Section */}
                {Boolean(
                  selectedMedia.family_context?.suggested_caption ||
                    (selectedMedia.family_context?.identified_members &&
                      selectedMedia.family_context.identified_members.length > 0),
                ) && (
                  <div
                    className="lightbox-section"
                    style={{
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.12))',
                      border: '1px solid rgba(168, 85, 247, 0.3)',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <h4 className="lightbox-section-title" style={{ margin: 0, color: '#e0e7ff', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>🌳</span> Family Tree Kinship &amp; Context
                      </h4>
                    </div>

                    {selectedMedia.family_context?.suggested_caption && (
                      <p style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 500, lineHeight: 1.4, margin: '0 0 0.5rem 0' }}>
                        ✨ &ldquo;{selectedMedia.family_context.suggested_caption}&rdquo;
                      </p>
                    )}

                    {selectedMedia.family_context?.identified_members &&
                      selectedMedia.family_context.identified_members.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.4rem' }}>
                          {selectedMedia.family_context.identified_members.map((m) => (
                            <button
                              key={m.name}
                              type="button"
                              className="badge-pill"
                              style={{
                                background: 'rgba(99, 102, 241, 0.25)',
                                border: '1px solid rgba(99, 102, 241, 0.5)',
                                color: '#ffffff',
                                cursor: onViewInFamilyTree ? 'pointer' : 'default',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                              onClick={() => {
                                if (onViewInFamilyTree) {
                                  setSelectedMedia(null);
                                  onViewInFamilyTree(m.name);
                                }
                              }}
                              title={onViewInFamilyTree ? `View ${m.name} in Family Tree` : m.name}
                            >
                              <span>👤 {m.name}</span>
                              {m.kinshipToRoot && (
                                <span style={{ color: '#c7d2fe', fontWeight: 700 }}>({m.kinshipToRoot})</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}

                    {selectedMedia.family_context?.relationships &&
                      selectedMedia.family_context.relationships.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {selectedMedia.family_context.relationships.map((rel, idx) => (
                            <div key={idx}>
                              💞 <strong style={{ color: '#cbd5e1' }}>{rel.person1}</strong> &amp;{' '}
                              <strong style={{ color: '#cbd5e1' }}>{rel.person2}</strong>: {rel.relationship}
                            </div>
                          ))}
                        </div>
                      )}

                    {selectedMedia.family_context?.milestones &&
                      selectedMedia.family_context.milestones.length > 0 && (
                        <div style={{ marginTop: '0.4rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.35rem', fontSize: '0.75rem', color: '#f59e0b' }}>
                          {selectedMedia.family_context.milestones.map((ms, idx) => (
                            <div key={idx}>
                              ⭐ {ms.personName}: {ms.title} {ms.date ? `(${ms.date})` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                )}

                {/* AI Semantic Description & Attributes Section */}
                {(selectedMedia.description_ru ||
                  selectedMedia.description ||
                  selectedMedia.summary_ru ||
                  selectedMedia.summary ||
                  selectedMedia.lighting ||
                  selectedMedia.weather ||
                  selectedMedia.time_of_day ||
                  selectedMedia.ocr_text ||
                  selectedMedia.exif_analysis ||
                  selectedMedia.transcription) && (
                  <div className="lightbox-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 className="lightbox-section-title">{t('aiDescription')}</h4>
                      <span className="badge-pill badge-pill-secondary" style={{ fontSize: '0.7rem' }}>
                        {activeDetailLang === 'ru' ? '🇷🇺 RU' : '🇬🇧 EN'}
                      </span>
                    </div>

                    {/* Localized Description & Summary */}
                    {activeDetailLang === 'ru' ? (
                      <>
                        {(selectedMedia.description_ru || selectedMedia.description) && (
                          <div className="lightbox-desc-block">
                            <p className="lightbox-desc-text">
                              {selectedMedia.description_ru || selectedMedia.description}
                            </p>
                          </div>
                        )}
                        {(selectedMedia.summary_ru || selectedMedia.summary) && (
                          <div className="lightbox-desc-block" style={{ marginTop: '0.4rem' }}>
                            <span className="lightbox-desc-lang-tag">{t('summaryBadge')}</span>
                            <p className="lightbox-desc-text" style={{ fontSize: '0.82rem' }}>
                              {selectedMedia.summary_ru || selectedMedia.summary}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {(selectedMedia.description || selectedMedia.description_ru) && (
                          <div className="lightbox-desc-block">
                            <p className="lightbox-desc-text">
                              {selectedMedia.description || selectedMedia.description_ru}
                            </p>
                          </div>
                        )}
                        {(selectedMedia.summary || selectedMedia.summary_ru) && (
                          <div className="lightbox-desc-block" style={{ marginTop: '0.4rem' }}>
                            <span className="lightbox-desc-lang-tag">{t('summaryBadge')}</span>
                            <p className="lightbox-desc-text" style={{ fontSize: '0.82rem' }}>
                              {selectedMedia.summary || selectedMedia.summary_ru}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Rich Localized Semantic Badges/Details */}
                    <div className="lightbox-meta-grid" style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {selectedMedia.environment && (
                        <div className="lightbox-detail-row">
                          <span className="lightbox-label">{t('environment')}:</span>
                          <span className="lightbox-value">
                            {selectedMedia.environment === 'indoor'
                              ? t('environmentIndoor')
                              : selectedMedia.environment === 'outdoor'
                              ? t('environmentOutdoor')
                              : selectedMedia.environment}
                          </span>
                        </div>
                      )}

                      {(selectedMedia.lighting_ru || selectedMedia.lighting) && (
                        <div className="lightbox-detail-row">
                          <span className="lightbox-label">{t('lighting')}:</span>
                          <span className="lightbox-value">
                            {activeDetailLang === 'ru'
                              ? selectedMedia.lighting_ru || selectedMedia.lighting
                              : selectedMedia.lighting || selectedMedia.lighting_ru}
                          </span>
                        </div>
                      )}

                      {(selectedMedia.weather_ru || selectedMedia.weather) && (
                        <div className="lightbox-detail-row">
                          <span className="lightbox-label">{t('weather')}:</span>
                          <span className="lightbox-value">
                            {activeDetailLang === 'ru'
                              ? selectedMedia.weather_ru || selectedMedia.weather
                              : selectedMedia.weather || selectedMedia.weather_ru}
                          </span>
                        </div>
                      )}

                      {(selectedMedia.time_of_day_ru || selectedMedia.time_of_day) && (
                        <div className="lightbox-detail-row">
                          <span className="lightbox-label">{t('timeOfDay')}:</span>
                          <span className="lightbox-value">
                            {activeDetailLang === 'ru'
                              ? selectedMedia.time_of_day_ru || selectedMedia.time_of_day
                              : selectedMedia.time_of_day || selectedMedia.time_of_day_ru}
                          </span>
                        </div>
                      )}

                      {(selectedMedia.exif_analysis_ru || selectedMedia.exif_analysis) && (
                        <div className="lightbox-detail-row">
                          <span className="lightbox-label">{t('exifAnalysis')}:</span>
                          <span className="lightbox-value" style={{ fontSize: '0.78rem' }}>
                            {activeDetailLang === 'ru'
                              ? selectedMedia.exif_analysis_ru || selectedMedia.exif_analysis
                              : selectedMedia.exif_analysis || selectedMedia.exif_analysis_ru}
                          </span>
                        </div>
                      )}

                      {selectedMedia.ocr_text && (
                        <div className="lightbox-detail-row">
                          <span className="lightbox-label">{t('ocrText')}:</span>
                          <span className="lightbox-value" style={{ fontStyle: 'italic' }}>
                            «{selectedMedia.ocr_text}»
                          </span>
                        </div>
                      )}

                      {(selectedMedia.transcription_ru || selectedMedia.transcription) && (
                        <div className="lightbox-detail-row">
                          <span className="lightbox-label">{t('audioTranscription')}:</span>
                          <span className="lightbox-value" style={{ fontStyle: 'italic' }}>
                            {activeDetailLang === 'ru'
                              ? selectedMedia.transcription_ru || selectedMedia.transcription
                              : selectedMedia.transcription || selectedMedia.transcription_ru}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Timeline events for video */}
                    {selectedMedia.timeline_events && selectedMedia.timeline_events.length > 0 && (
                      <div style={{ marginTop: '0.6rem' }}>
                        <span className="lightbox-label" style={{ display: 'block', marginBottom: '0.3rem' }}>
                          {t('timelineEvents')}:
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {selectedMedia.timeline_events.map((evt, idx) => (
                            <div key={idx} style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.04)', padding: '0.3rem 0.5rem', borderRadius: '4px' }}>
                              <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
                                {evt.timestamp_start} - {evt.timestamp_end}:
                              </span>{' '}
                              <span>{activeDetailLang === 'ru' ? evt.activity_ru || evt.activity : evt.activity || evt.activity_ru}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Detected Faces & Persons on this Image */}
                <div className="lightbox-section" style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <h4 className="lightbox-section-title" style={{ margin: 0 }}>
                      {t('detectedFaces')} ({facesForSelected.length})
                    </h4>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      {loadingFaces && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {t('loadingFaces')}
                        </span>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}
                        onClick={() => setIsAddingPerson((prev) => !prev)}
                        title={t('tagPerson')}
                      >
                        {isAddingPerson ? '✕ ' + t('closeTooltip') : t('tagPerson')}
                      </button>
                    </div>
                  </div>

                  {/* Tag Person Selector Widget */}
                  {isAddingPerson && (
                    <div className="lightbox-tag-person-box">
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <select
                          className="input-control select-control"
                          style={{ flex: 1, minWidth: '150px', fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                          value={selectedPersonToTag}
                          onChange={(e) => setSelectedPersonToTag(e.target.value)}
                        >
                          <option value="">-- {t('selectPersonPlaceholder')} --</option>
                          {knownPersonOptions.map((p) => (
                            <option key={p.name} value={p.name}>
                              {p.name} ({p.count})
                            </option>
                          ))}
                          <option value="__custom__">{t('addNewPersonOption')}</option>
                        </select>

                        {selectedPersonToTag === '__custom__' && (
                          <input
                            type="text"
                            className="input-control"
                            placeholder={t('customPersonNamePlaceholder')}
                            style={{ flex: 1, minWidth: '130px', fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                            value={customPersonName}
                            onChange={(e) => setCustomPersonName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleTagPerson();
                            }}
                          />
                        )}

                        <button
                          type="button"
                          className="btn btn-accent"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={handleTagPerson}
                          disabled={
                            isTagging ||
                            !selectedPersonToTag ||
                            (selectedPersonToTag === '__custom__' && !customPersonName.trim())
                          }
                        >
                          {isTagging ? '...' : t('btnTagPerson')}
                        </button>
                      </div>
                    </div>
                  )}

                  {facesForSelected.length === 0 ? (
                    <div style={{ margin: '0.5rem 0' }}>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 0.4rem 0' }}>
                        {loadingFaces ? t('loadingFaces') : t('noFacesIndexed')}
                      </p>
                      {!isAddingPerson && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ width: '100%', fontSize: '0.8rem', padding: '0.35rem' }}
                          onClick={() => setIsAddingPerson(true)}
                        >
                          {t('tagPerson')}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="lightbox-faces-list">
                      {facesForSelected.map((f) => {
                        const cropUrl = f.image_path
                          ? `/api/faces/image/${f.image_path.split(/[/\\]/).pop()}`
                          : f.face_id
                          ? `/api/faces/image/${f.face_id}`
                          : null;
                        const isEditing = reassigningFaceId === f.face_id;
                        const isManual = f.face_id.startsWith('manual_');

                        return (
                          <div className="lightbox-face-item" key={f.face_id}>
                            {cropUrl ? (
                              <img
                                src={cropUrl}
                                alt={f.name || f.face_id}
                                className="lightbox-face-crop"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="lightbox-face-placeholder">👤</div>
                            )}

                            <div style={{ minWidth: 0, flex: 1 }}>
                              {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.2rem' }}>
                                  <select
                                    className="input-control select-control"
                                    style={{ fontSize: '0.75rem', padding: '0.25rem' }}
                                    value={reassignTargetPerson}
                                    onChange={(e) => setReassignTargetPerson(e.target.value)}
                                  >
                                    <option value="">-- {t('selectPersonPlaceholder')} --</option>
                                    {knownPersonOptions.map((p) => (
                                      <option key={p.name} value={p.name}>
                                        {p.name}
                                      </option>
                                    ))}
                                    <option value="__custom__">{t('addNewPersonOption')}</option>
                                  </select>

                                  {reassignTargetPerson === '__custom__' && (
                                    <input
                                      type="text"
                                      className="input-control"
                                      placeholder={t('customPersonNamePlaceholder')}
                                      style={{ fontSize: '0.75rem', padding: '0.25rem' }}
                                      value={reassignCustomName}
                                      onChange={(e) => setReassignCustomName(e.target.value)}
                                    />
                                  )}

                                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                                    <button
                                      type="button"
                                      className="btn btn-accent"
                                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                                      disabled={
                                        isReassigning ||
                                        !reassignTargetPerson ||
                                        (reassignTargetPerson === '__custom__' && !reassignCustomName.trim())
                                      }
                                      onClick={() => {
                                        const finalName =
                                          reassignTargetPerson === '__custom__' ? reassignCustomName.trim() : reassignTargetPerson.trim();
                                        handleReassignFace(f.face_id, finalName);
                                      }}
                                    >
                                      ✓
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                                      onClick={() => setReassigningFaceId(null)}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f3f4f6' }}>
                                    {f.name || f.face_id}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {isManual ? (
                                      <span>{t('badgeManual')}</span>
                                    ) : (
                                      <span>
                                        {f.face_id} • {t('confidence')}: {f.confidence ? `${(f.confidence * 100).toFixed(0)}%` : 'N/A'}
                                      </span>
                                    )}
                                  </div>
                                  {!isEditing && (() => {
                                    const matchedPerson = f.name ? persons.find((p) => p.name.toLowerCase() === f.name?.toLowerCase()) : null;
                                    return (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                                        {matchedPerson?.family_tree?.kinship_to_root && (
                                          <span
                                            className="badge-pill"
                                            style={{
                                              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(99, 102, 241, 0.25))',
                                              border: '1px solid rgba(168, 85, 247, 0.5)',
                                              color: '#e0e7ff',
                                              fontSize: '0.68rem',
                                              fontWeight: 600,
                                            }}
                                            title="Genealogical Kinship to 'ME' (Root)"
                                          >
                                            🧬 {matchedPerson.family_tree.kinship_to_root}
                                          </span>
                                        )}

                                        {onViewInFamilyTree && f.name && (
                                          <button
                                            type="button"
                                            className="btn btn-secondary"
                                            style={{
                                              padding: '0.15rem 0.45rem',
                                              fontSize: '0.72rem',
                                              background: 'rgba(99, 102, 241, 0.15)',
                                              border: '1px solid rgba(99, 102, 241, 0.35)',
                                              color: '#c7d2fe',
                                            }}
                                            onClick={() => {
                                              setSelectedMedia(null);
                                              onViewInFamilyTree(f.name!);
                                            }}
                                            title={`View ${f.name} in Family Tree`}
                                          >
                                            🌳
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </>
                              )}
                            </div>

                            {!isEditing && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <span
                                  className={`badge-pill ${f.is_reference ? 'badge-pill-accent' : 'badge-pill-warning'}`}
                                  style={{ fontSize: '0.68rem' }}
                                >
                                  {isManual ? t('badgeManual') : f.is_reference ? t('badgeKnown') : t('badgePending')}
                                </span>

                                <button
                                  type="button"
                                  className="btn-icon-subtle"
                                  onClick={() => {
                                    setReassigningFaceId(f.face_id);
                                    setReassignTargetPerson(f.name || '');
                                    setReassignCustomName('');
                                  }}
                                  title={t('changePerson')}
                                >
                                  ✏️
                                </button>

                                <button
                                  type="button"
                                  className="btn-icon-subtle"
                                  style={{ color: '#ef4444' }}
                                  onClick={() => handleRemoveFace(f.face_id)}
                                  title={t('removePersonTooltip')}
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="lightbox-section lightbox-actions-footer">
                  <button
                    className="btn btn-accent"
                    style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem' }}
                    onClick={() => {
                      if (onStartSingleAnalysis) {
                        onStartSingleAnalysis(selectedMedia.file_path || selectedMedia.filename);
                        setSelectedMedia(null);
                      }
                    }}
                    disabled={disabled}
                    type="button"
                  >
                    {t('btnAnalyzeFile')}
                  </button>

                  <a
                    href={`/api/media/file?path=${encodeURIComponent(selectedMedia.file_path || selectedMedia.filename)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary"
                    style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem', textAlign: 'center', textDecoration: 'none' }}
                  >
                    {t('btnOpenOriginal')}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
