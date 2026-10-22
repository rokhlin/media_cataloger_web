import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type {
  GalleryMediaFile,
  DetectedFaceRecord,
  PersonItem,
  FamilyContextData,
} from '../../models';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../services/authContext';
import { useVault } from '../../services/vaultContext';
import { useFamilyTreeStore } from '../../packages/family-tree/state/useFamilyTreeStore';
import MetadataEditorModal from './MetadataEditorModal';
import ModuleStatusBadges from './ModuleStatusBadges';
import AddToAlbumModal from './AddToAlbumModal';
import { useFavorites } from '../../services/favoritesService';
import {
  FolderPlus,
  FolderInput,
  Folder,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Heart,
  Edit3,
  Lock,
  Unlock,
  Trash2,
  Sparkles,
  User,
  UserPlus,
  TreePine,
  AlertCircle,
  Download,
  Film,
  Image as ImageIcon,
  RotateCcw,
  Pencil,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  RotateCw,
  Crop,
  Palette,
  Undo2,
  Check,
  UserX,
  Plus,
  Tag,
} from 'lucide-react';
import SaveChoiceDialog from './SaveChoiceDialog';
import StylePresetCarousel, { STYLE_PRESETS, type StylePreset } from './StylePresetCarousel';
import CropFrameOverlay, { type AspectRatioType, type ResolutionOption } from './CropFrameOverlay';
import { UniversalTagModal } from '../common/UniversalTagModal';
import { cn } from '../../utils';
import './MediaViewerModal.css';

export const TAXONOMY_BADGES: Record<string, { labelRu: string; labelEn: string; icon: string; color: string }> = {
  family_memories: { labelRu: 'Семейное', labelEn: 'Family Memories', icon: '👨‍👩‍👧‍👦', color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' },
  food: { labelRu: 'Еда и напитки', labelEn: 'Food & Dining', icon: '🍲', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  nature: { labelRu: 'Природа и пейзажи', labelEn: 'Nature & Landscapes', icon: '🌲', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  animals: { labelRu: 'Животные и питомцы', labelEn: 'Animals & Pets', icon: '🐾', color: 'bg-teal-500/15 text-teal-400 border-teal-500/30' },
  documents: { labelRu: 'Документы и текст', labelEn: 'Documents & Receipts', icon: '📄', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  business_card: { labelRu: 'Визитки и вывески', labelEn: 'Cards & Signs', icon: '🏷️', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  dashcam: { labelRu: 'Видеорегистратор', labelEn: 'Dashcam Video', icon: '🚗', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  other: { labelRu: 'Разное', labelEn: 'Other', icon: '📁', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
};

const CATEGORY_ICONS: Record<string, string> = {
  BIRTH: '👶',
  DEATH: '🕊️',
  MARRIAGE: '💍',
  DIVORCE: '💔',
  RELATIONSHIP: '💞',
  CHILD_BORN: '🍼',
  GRADUATION: '🎓',
  RELOCATION: '📍',
  TRAVEL: '✈️',
  CAREER: '💼',
  MILITARY: '🎖️',
  CUSTOM: '📝',
  ANNIVERSARY: '🥂',
};

export interface MediaViewerModalProps {
  isOpen?: boolean;
  mediaFile: GalleryMediaFile | null;
  seriesGroupFiles?: GalleryMediaFile[];
  onClose: () => void;
  currentIndex?: number;
  totalFiles?: number;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onRefresh?: () => void;
  onReloadFaces?: () => Promise<void> | void;
  onStartSingleAnalysis?: (
    filePath: string,
    onSuccess?: () => void,
    onError?: (errMsg: string) => void
  ) => Promise<boolean | void> | void;
  onViewInFamilyTree?: (personName: string, personId?: string) => void;
  persons?: PersonItem[];
  knownPersonOptions?: { name: string; display_name?: string; avatarUrl?: string | null; count: number }[];
  disabled?: boolean;
  isEngineConnected?: boolean;
  onMediaUpdated?: (updated: GalleryMediaFile) => void;
  vaultToken?: string | null;
}

export default function MediaViewerModal({
  isOpen = true,
  mediaFile,
  seriesGroupFiles,
  onClose,
  currentIndex = -1,
  totalFiles = 0,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  onRefresh,
  onReloadFaces,
  onStartSingleAnalysis,
  onViewInFamilyTree,
  persons = [],
  knownPersonOptions = [],
  disabled = false,
  isEngineConnected = true,
  onMediaUpdated,
  vaultToken: propVaultToken,
}: MediaViewerModalProps) {
  const { t, language } = useLanguage();
  const { authFetch, isAdmin, canEdit, canManageFaces } = useAuth();
  const { addVaultItem, removeVaultItem, unlockVault, vaultToken: contextVaultToken } = useVault();
  const { galleryKinshipFactsConfig, treeDataVersion } = useFamilyTreeStore();
  const { isFavorite, toggleFavorite } = useFavorites();

  // Selected media state
  const [selectedMedia, setSelectedMedia] = useState<GalleryMediaFile | null>(() => {
    if (!mediaFile) return null;
    return {
      ...mediaFile,
      similar_group_files: mediaFile.similar_group_files || seriesGroupFiles,
      similar_files_count: mediaFile.similar_files_count || seriesGroupFiles?.length,
    };
  });

  const [facesForSelected, setFacesForSelected] = useState<DetectedFaceRecord[]>([]);
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);
  const [imageNaturalDimensions, setImageNaturalDimensions] = useState<{ width: number; height: number } | null>(null);
  const [loadingFaces, setLoadingFaces] = useState(false);
  const [engineOnline, setEngineOnline] = useState<boolean>(isEngineConnected);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSuccess, setAnalysisSuccess] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAddToAlbumOpen, setIsAddToAlbumOpen] = useState(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [videoPlaybackError, setVideoPlaybackError] = useState(false);

  // FEAT-027: Fullscreen and Collapsible Sidebar
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('media_viewer_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('media_viewer_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.error('Fullscreen toggle error:', err);
    }
  }, []);

  // FEAT-027: Rotate Left 90°
  const [rotationDeg, setRotationDeg] = useState(0);
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    setRotationDeg(0);
  }, [selectedMedia?.file_path, selectedMedia?.filename]);

  const handleRotateLeft = async () => {
    if (!selectedMedia) return;
    const filePath = selectedMedia.file_path || selectedMedia.filename;
    setRotationDeg((prev) => (prev - 90) % 360);
    setIsRotating(true);
    try {
      const fetchFn = authFetch || fetch;
      const res = await fetchFn('/api/media/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, degrees: -90 }),
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('media_updated', { detail: { filePath } }));
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Failed to rotate image:', err);
    } finally {
      setIsRotating(false);
    }
  };

  // FEAT-030: Zoom & Pan State & Controls
  const [zoomScale, setZoomScale] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showZoomBadge, setShowZoomBadge] = useState(false);
  const zoomTimerRef = useRef<NodeJS.Timeout | null>(null);

  const touchTrackingRef = useRef<{
    initialDist: number;
    initialScale: number;
    startX: number;
    startY: number;
  }>({ initialDist: 0, initialScale: 1.0, startX: 0, startY: 0 });

  // Reset zoom on media file switch
  useEffect(() => {
    setZoomScale(1.0);
    setPanX(0);
    setPanY(0);
    setIsPanning(false);
    setIsEditMode(false);
    setSelectedStylePreset(STYLE_PRESETS[0]);
    setIsComparingBefore(false);
    setEditorRotationDeg(0);
    setCropAspectRatio('1:1');
    setCropResolution(null);
    setHasUnsavedEdits(false);
  }, [selectedMedia?.file_path, selectedMedia?.filename]);

  const triggerZoomBadge = () => {
    setShowZoomBadge(true);
    if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => setShowZoomBadge(false), 1500);
  };

  const handleZoomIn = () => {
    setZoomScale((prev) => {
      const next = Math.min(5.0, Number((prev * 1.2).toFixed(2)));
      triggerZoomBadge();
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => {
      const next = Math.max(1.0, Number((prev * 0.83).toFixed(2)));
      if (next === 1.0) {
        setPanX(0);
        setPanY(0);
      }
      triggerZoomBadge();
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomScale(1.0);
    setPanX(0);
    setPanY(0);
    triggerZoomBadge();
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoomScale((prev) => {
      let next = prev * factor;
      if (next < 1.0) next = 1.0;
      if (next > 5.0) next = 5.0;
      next = Number(next.toFixed(2));
      if (next === 1.0) {
        setPanX(0);
        setPanY(0);
      }
      triggerZoomBadge();
      return next;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale > 1.0 && e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanX(e.clientX - panStart.x);
      setPanY(e.clientY - panStart.y);
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }
  };

  const handleDoubleClick = () => {
    if (zoomScale > 1.0) {
      handleResetZoom();
    } else {
      setZoomScale(2.5);
      triggerZoomBadge();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchTrackingRef.current = {
        initialDist: Math.hypot(dx, dy),
        initialScale: zoomScale,
        startX: (e.touches[0].clientX + e.touches[1].clientX) / 2 - panX,
        startY: (e.touches[0].clientY + e.touches[1].clientY) / 2 - panY,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchTrackingRef.current.initialDist > 0) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / touchTrackingRef.current.initialDist;
      let next = touchTrackingRef.current.initialScale * ratio;
      if (next < 1.0) next = 1.0;
      if (next > 5.0) next = 5.0;
      next = Number(next.toFixed(2));
      setZoomScale(next);
      triggerZoomBadge();

      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setPanX(midX - touchTrackingRef.current.startX);
      setPanY(midY - touchTrackingRef.current.startY);
    }
  };

  const handleTouchEnd = () => {
    touchTrackingRef.current.initialDist = 0;
    if (zoomScale <= 1.0) {
      setPanX(0);
      setPanY(0);
    }
  };

  // FEAT-030: Dedicated Edit Mode State & Actions
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeEditTool, setActiveEditTool] = useState<'style' | 'rotate' | 'crop'>('style');
  const [selectedStylePreset, setSelectedStylePreset] = useState<StylePreset>(STYLE_PRESETS[0]);
  const [isComparingBefore, setIsComparingBefore] = useState(false);
  const [editorRotationDeg, setEditorRotationDeg] = useState(0);
  const [cropAspectRatio, setCropAspectRatio] = useState<AspectRatioType>('1:1');
  const [cropResolution, setCropResolution] = useState<ResolutionOption | null>(null);
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);
  const [showSaveChoiceDialog, setShowSaveChoiceDialog] = useState(false);
  const [isSavingChoice, setIsSavingChoice] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const handleEnterEditMode = () => {
    setIsEditMode(true);
    setActiveEditTool('style');
    setSelectedStylePreset(STYLE_PRESETS[0]);
    setIsComparingBefore(false);
    setEditorRotationDeg(0);
    setCropAspectRatio('1:1');
    setCropResolution(null);
    setHasUnsavedEdits(false);
  };

  const handleExitEditMode = () => {
    if (hasUnsavedEdits) {
      setShowSaveChoiceDialog(true);
    } else {
      setIsEditMode(false);
      setSelectedStylePreset(STYLE_PRESETS[0]);
      setEditorRotationDeg(0);
      setHasUnsavedEdits(false);
    }
  };

  const handleSelectStylePreset = (preset: StylePreset) => {
    setSelectedStylePreset(preset);
    if (preset.id !== 'original') {
      setHasUnsavedEdits(true);
      showToast(language === 'ru' ? `Стиль выбран: ${preset.nameRu}` : `Style selected: ${preset.nameEn}`);
    } else if (editorRotationDeg === 0) {
      setHasUnsavedEdits(false);
    }
  };

  const handleEditorRotate = (delta: number) => {
    const next = (editorRotationDeg + delta) % 360;
    setEditorRotationDeg(next);
    setHasUnsavedEdits(true);
    showToast(language === 'ru' ? `Поворот: ${next}°` : `Rotation: ${next}°`);
  };

  const handleSaveClick = () => {
    setShowSaveChoiceDialog(true);
  };

  const handleConfirmSaveChoice = async (choice: 'copy' | 'overwrite' | 'cancel') => {
    if (choice === 'cancel') {
      setShowSaveChoiceDialog(false);
      setIsEditMode(false);
      setSelectedStylePreset(STYLE_PRESETS[0]);
      setEditorRotationDeg(0);
      setHasUnsavedEdits(false);
      showToast(language === 'ru' ? 'Изменения отменены' : 'Changes discarded');
      return;
    }

    if (!selectedMedia) return;
    const filePath = selectedMedia.file_path || selectedMedia.filename;
    const saveAsCopy = choice === 'copy';
    const fetchFn = authFetch || fetch;
    setIsSavingChoice(true);

    try {
      if (activeEditTool === 'style' && selectedStylePreset.id !== 'original') {
        const res = await fetchFn('/api/media/edit/style-transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath,
            presetId: selectedStylePreset.id,
            prompt: selectedStylePreset.prompt,
            strength: 0.4,
            saveAsCopy,
          }),
        });
        if (!res.ok) throw new Error('Style transfer failed');
        const data = await res.json();
        showToast(language === 'ru' ? 'Стиль успешно применен и сохранен!' : 'Style successfully saved!');
        window.dispatchEvent(new CustomEvent('media_updated', { detail: { filePath: data.filePath || filePath } }));
      } else if (activeEditTool === 'rotate' || editorRotationDeg !== 0) {
        const res = await fetchFn('/api/media/rotate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath,
            degrees: editorRotationDeg || -90,
            saveAsCopy,
          }),
        });
        if (!res.ok) throw new Error('Rotation failed');
        const data = await res.json();
        showToast(language === 'ru' ? 'Поворот успешно сохранен!' : 'Rotation saved successfully!');
        window.dispatchEvent(new CustomEvent('media_updated', { detail: { filePath: data.filePath || filePath } }));
      } else if (activeEditTool === 'crop') {
        const targetW = cropResolution?.width || imageNaturalDimensions?.width || 1080;
        const targetH = cropResolution?.height || imageNaturalDimensions?.height || 1080;
        const res = await fetchFn('/api/media/edit/crop-scale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath,
            crop: { left: 0, top: 0, width: targetW, height: targetH },
            targetResolution: { width: targetW, height: targetH },
            saveAsCopy,
          }),
        });
        if (!res.ok) throw new Error('Crop & scale failed');
        const data = await res.json();
        showToast(language === 'ru' ? 'Кадрирование успешно сохранено!' : 'Crop saved successfully!');
        window.dispatchEvent(new CustomEvent('media_updated', { detail: { filePath: data.filePath || filePath } }));
      }

      setShowSaveChoiceDialog(false);
      setIsEditMode(false);
      setSelectedStylePreset(STYLE_PRESETS[0]);
      setEditorRotationDeg(0);
      setHasUnsavedEdits(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Failed to save edit choice:', err);
      showToast(language === 'ru' ? `Ошибка сохранения: ${err.message}` : `Save error: ${err.message}`);
    } finally {
      setIsSavingChoice(false);
    }
  };

  // FEAT-027: Rename File
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newFilenameInput, setNewFilenameInput] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  const handleOpenRename = () => {
    if (!selectedMedia) return;
    setNewFilenameInput(selectedMedia.filename);
    setRenameError(null);
    setShowRenameModal(true);
  };

  const handleConfirmRename = async () => {
    if (!selectedMedia || !newFilenameInput.trim()) return;
    const filePath = selectedMedia.file_path || selectedMedia.filename;
    setIsRenaming(true);
    setRenameError(null);
    try {
      const fetchFn = authFetch || fetch;
      const res = await fetchFn('/api/media/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, newName: newFilenameInput.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const updated = {
          ...selectedMedia,
          file_path: data.newPath || selectedMedia.file_path,
          filename: data.newFilename || newFilenameInput.trim(),
        };
        setSelectedMedia(updated);
        if (onMediaUpdated) onMediaUpdated(updated);
        window.dispatchEvent(new CustomEvent('media_updated', { detail: { filePath: data.newPath } }));
        setShowRenameModal(false);
        if (onRefresh) onRefresh();
      } else {
        setRenameError(data.message || 'Ошибка при переименовании файла');
      }
    } catch (err: any) {
      setRenameError(err.message || 'Ошибка сети при переименовании');
    } finally {
      setIsRenaming(false);
    }
  };

  // FEAT-027: Delete File (Hard Confirmation)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    if (!selectedMedia) return;
    const filePath = selectedMedia.file_path || selectedMedia.filename;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const fetchFn = authFetch || fetch;
      const res = await fetchFn('/api/media/file', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      if (res.ok) {
        setShowDeleteModal(false);
        window.dispatchEvent(new CustomEvent('media_deleted', { detail: { filePath } }));
        if (onRefresh) onRefresh();
        if (hasNext && onNext) {
          onNext();
        } else if (hasPrev && onPrev) {
          onPrev();
        } else {
          onClose();
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.message || 'Не удалось удалить файл');
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Ошибка сети при удалении');
    } finally {
      setIsDeleting(false);
    }
  };

  // FEAT-027: Move To Folder & Move Popover
  const [showMoveFolderModal, setShowMoveFolderModal] = useState(false);
  const [targetFolderInput, setTargetFolderInput] = useState('');
  const [isMovingFolder, setIsMovingFolder] = useState(false);
  const [moveFolderError, setMoveFolderError] = useState<string | null>(null);
  const [isMoveMenuOpen, setIsMoveMenuOpen] = useState(false);

  const handleConfirmMoveFolder = async () => {
    if (!selectedMedia || !targetFolderInput.trim()) return;
    const filePath = selectedMedia.file_path || selectedMedia.filename;
    setIsMovingFolder(true);
    setMoveFolderError(null);
    try {
      const fetchFn = authFetch || fetch;
      const res = await fetchFn('/api/media/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, targetFolder: targetFolderInput.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const updated = {
          ...selectedMedia,
          file_path: data.newPath || selectedMedia.file_path,
          folder: targetFolderInput.trim(),
        };
        setSelectedMedia(updated);
        if (onMediaUpdated) onMediaUpdated(updated);
        window.dispatchEvent(new CustomEvent('media_updated', { detail: { filePath: data.newPath } }));
        setShowMoveFolderModal(false);
        if (onRefresh) onRefresh();
      } else {
        setMoveFolderError(data.message || 'Ошибка при перемещении файла');
      }
    } catch (err: any) {
      setMoveFolderError(err.message || 'Ошибка сети при перемещении');
    } finally {
      setIsMovingFolder(false);
    }
  };

  // FEAT-027: Restore from vault
  const handleRestoreFromVault = async () => {
    if (!selectedMedia) return;
    const filePath = selectedMedia.file_path || selectedMedia.filename;
    await removeVaultItem(filePath);
    const updated = { ...selectedMedia, is_vault: false };
    setSelectedMedia(updated);
    if (onMediaUpdated) onMediaUpdated(updated);
    window.dispatchEvent(new CustomEvent('media_updated', { detail: { filePath, is_vault: false } }));
    if (onRefresh) onRefresh();
  };

  // FEAT-027: Download original
  const handleDownload = () => {
    if (!selectedMedia) return;
    const downloadUrl = `/api/media/file?path=${encodeURIComponent(selectedMedia.file_path || selectedMedia.filename)}${vaultTokenQuery}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = selectedMedia.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Action: Unmark as duplicate / burst sibling
  const [isUnmarkingDuplicate, setIsUnmarkingDuplicate] = useState(false);

  const handleUnmarkDuplicate = async () => {
    if (!selectedMedia) return;
    const filePath = selectedMedia.file_path || selectedMedia.filename;
    setIsUnmarkingDuplicate(true);
    try {
      const fetchFn = authFetch || fetch;
      const res = await fetchFn('/api/duplicates/unmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      if (res.ok) {
        // Exclude current file from effective series group
        const currentGroup = selectedMedia.similar_group_files || seriesGroupFiles || [];
        const remainingGroup = currentGroup.filter(
          (f) => (f.file_path || f.filename) !== filePath
        );
        const updated = {
          ...selectedMedia,
          is_burst_duplicate: false,
          burst_primary: undefined,
          similar_group_files: remainingGroup.length > 1 ? remainingGroup : undefined,
          similar_files_count: remainingGroup.length > 1 ? remainingGroup.length : undefined,
          similarity_group_id: undefined,
        };
        setSelectedMedia(updated);
        if (onMediaUpdated) onMediaUpdated(updated);
        window.dispatchEvent(new CustomEvent('media_updated', { detail: { filePath } }));
        if (onRefresh) onRefresh();

        // Trigger standalone re-analysis if callback available
        if (onStartSingleAnalysis) {
          onStartSingleAnalysis(filePath);
        }
      }
    } catch (err) {
      console.error('Failed to unmark duplicate:', err);
    } finally {
      setIsUnmarkingDuplicate(false);
    }
  };

  // Vault PIN confirmation state
  const [showVaultPinModal, setShowVaultPinModal] = useState(false);
  const [vaultPinInput, setVaultPinInput] = useState('');
  const [vaultPinError, setVaultPinError] = useState<string | null>(null);
  const [vaultPinLoading, setVaultPinLoading] = useState(false);
  const [pendingVaultFilePath, setPendingVaultFilePath] = useState<string | null>(null);

  // Face tagging & reassignment state
  const [isAddingPerson, setIsAddingPerson] = useState(false);
  const [selectedPersonToTag, setSelectedPersonToTag] = useState('');
  const [customPersonName, setCustomPersonName] = useState('');
  const [isTagging, setIsTagging] = useState(false);
  const [reassigningFaceId, setReassigningFaceId] = useState<string | null>(null);
  const [reassignTargetPerson, setReassignTargetPerson] = useState('');
  const [reassignCustomName, setReassignCustomName] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);

  // Language preview toggle inside lightbox
  const [lightboxLang, setLightboxLang] = useState<'ru' | 'en'>(language === 'ru' ? 'ru' : 'en');
  const activeDetailLang = lightboxLang || (language === 'ru' ? 'ru' : 'en');

  const [internalKnownPersons, setInternalKnownPersons] = useState<{ name: string; display_name?: string; avatarUrl?: string | null; count: number }[]>([]);

  // Effective vault token: prop token takes priority, then fallback to context token
  const effectiveVaultToken = propVaultToken || contextVaultToken || undefined;
  const isVaultItem = Boolean(selectedMedia?.is_vault);
  const vaultTokenQuery = (isVaultItem || effectiveVaultToken) && effectiveVaultToken
    ? `&vault_token=${encodeURIComponent(effectiveVaultToken)}`
    : '';

  // Dynamically load known persons if not provided via props
  useEffect(() => {
    let isMounted = true;
    const fetchKnown = async () => {
      try {
        const fetchFn = authFetch || fetch;
        const res = await fetchFn('/api/faces/persons');
        if (res.ok && isMounted) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const mapped = data.map((p: any) => ({
              name: p.name,
              display_name: p.display_name || (p.last_name && p.first_name ? `${p.last_name} ${p.first_name}` : p.name),
              count: p.media_count || p.count || 1,
              avatarUrl: p.representative_face_id ? `/api/faces/image/${p.representative_face_id}` : null,
            }));
            setInternalKnownPersons(mapped);
          }
        }
      } catch {
        // ignore fetch errors
      }
    };
    fetchKnown();
    return () => { isMounted = false; };
  }, [authFetch]);

  const effectiveKnownPersons = useMemo(() => {
    const list: Array<{ name: string; display_name?: string; avatarUrl?: string | null; count: number }> =
      knownPersonOptions && knownPersonOptions.length > 0 ? [...knownPersonOptions] : [...internalKnownPersons];
    if (persons && persons.length > 0) {
      for (const p of persons) {
        if (p.name && !list.some((existing) => existing.name.toLowerCase() === p.name.toLowerCase())) {
          list.push({
            name: p.name,
            display_name: p.display_name || (p.last_name && p.first_name ? `${p.last_name} ${p.first_name}` : p.name),
            count: 1,
            avatarUrl: null,
          });
        }
      }
    }
    return list;
  }, [knownPersonOptions, internalKnownPersons, persons]);

  // Video face grouping: cluster multiple frame crops of the same moving individual
  const groupedVideoFaces = useMemo(() => {
    if (!selectedMedia?.is_video || facesForSelected.length <= 1) {
      return facesForSelected.map((f) => ({ ...f, occurrencesCount: 1, allFaceIds: [f.face_id] }));
    }

    const clusters = new Map<string, {
      repFace: DetectedFaceRecord;
      occurrencesCount: number;
      allFaceIds: string[];
    }>();

    for (const f of facesForSelected) {
      const key = (f.name || f.person_id || f.face_id || 'unknown').toLowerCase().trim();
      if (!clusters.has(key)) {
        clusters.set(key, {
          repFace: f,
          occurrencesCount: 1,
          allFaceIds: [f.face_id],
        });
      } else {
        const c = clusters.get(key)!;
        c.occurrencesCount += 1;
        c.allFaceIds.push(f.face_id);
        if ((f.confidence || 0) > (c.repFace.confidence || 0)) {
          c.repFace = f;
        }
      }
    }

    return Array.from(clusters.values()).map((c) => ({
      ...c.repFace,
      occurrencesCount: c.occurrencesCount,
      allFaceIds: c.allFaceIds,
    }));
  }, [facesForSelected, selectedMedia?.is_video]);

  // Sync prop changes while preserving series group files
  useEffect(() => {
    if (mediaFile) {
      setSelectedMedia((prev) => {
        const groupFiles = mediaFile.similar_group_files || seriesGroupFiles || prev?.similar_group_files;
        return {
          ...mediaFile,
          similar_group_files: groupFiles,
          similar_files_count: groupFiles ? groupFiles.length : (mediaFile.similar_files_count || prev?.similar_files_count),
          similarity_group_id: mediaFile.similarity_group_id || prev?.similarity_group_id,
        };
      });
    } else {
      setSelectedMedia(null);
    }
  }, [mediaFile, seriesGroupFiles]);

  useEffect(() => {
    setVideoPlaybackError(false);
    setSelectedFaceId(null);
    setImageNaturalDimensions(null);
  }, [selectedMedia?.file_path, selectedMedia?.filename]);

  // Derived effective group files for the carousel
  const effectiveGroupFiles = useMemo(() => {
    if (selectedMedia?.similar_group_files && selectedMedia.similar_group_files.length > 1) {
      return selectedMedia.similar_group_files;
    }
    if (seriesGroupFiles && seriesGroupFiles.length > 1) {
      return seriesGroupFiles;
    }
    return undefined;
  }, [selectedMedia?.similar_group_files, seriesGroupFiles]);

  useEffect(() => {
    setEngineOnline(isEngineConnected);
  }, [isEngineConnected]);

  // Poll status to track AI engine availability in real-time
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const verifyConnection = async () => {
      try {
        const res = await fetch('/api/status');
        if (res.ok && isMounted) {
          const data = await res.json();
          setEngineOnline(Boolean(data.connected));
        } else if (isMounted) {
          setEngineOnline(false);
        }
      } catch {
        if (isMounted) setEngineOnline(false);
      }
    };

    verifyConnection();
    const interval = setInterval(verifyConnection, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen]);

  // Fetch freshest media details including faces and AI summary
  const fetchCurrentMediaDetails = async (filePathTarget?: string) => {
    const target = filePathTarget || selectedMedia?.file_path || selectedMedia?.filename;
    if (!target) return;
    try {
      const fetchFn = authFetch || fetch;
      const res = await fetchFn(`/api/media/file-info?file=${encodeURIComponent(target)}${vaultTokenQuery}`);
      if (res.ok) {
        const freshData: GalleryMediaFile = await res.json();
        if (freshData) {
          setSelectedMedia((prev) => {
            if (!prev) return freshData;
            return {
              ...prev,
              ...freshData,
              similar_group_files: prev.similar_group_files || seriesGroupFiles,
              similar_files_count: prev.similar_files_count || seriesGroupFiles?.length,
              similarity_group_id: prev.similarity_group_id,
              faces: (freshData.faces && freshData.faces.length > 0) ? freshData.faces : prev.faces,
              face_names: (freshData.face_names && freshData.face_names.length > 0) ? freshData.face_names : prev.face_names,
            };
          });
          if (onMediaUpdated) onMediaUpdated(freshData);
          if (Array.isArray(freshData.faces) && freshData.faces.length > 0) {
            const validFaces = (freshData.faces as DetectedFaceRecord[]).filter(
              (f): f is DetectedFaceRecord => Boolean(f && typeof f.face_id === 'string')
            );
            const uniqueFaces = Array.from(new Map(validFaces.map((f) => [f.face_id, f])).values());
            setFacesForSelected(uniqueFaces);
          }
        }
      }
    } catch (err) {
      console.warn('Could not refresh current media details:', err);
    }
  };

  // Automatically fetch fresh AI metadata and sidecar analysis when opening modal or switching files
  useEffect(() => {
    if (!isOpen || !selectedMedia) return;
    const target = selectedMedia.file_path || selectedMedia.filename;
    if (target) {
      fetchCurrentMediaDetails(target);
    }
  }, [isOpen, selectedMedia?.file_path, selectedMedia?.filename]);

  // Fetch detected faces for current file
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isOpen || !selectedMedia) {
      setFacesForSelected([]);
      return;
    }

    if (selectedMedia.faces && selectedMedia.faces.length > 0) {
      const validFaces = (selectedMedia.faces as DetectedFaceRecord[]).filter(
        (f): f is DetectedFaceRecord => Boolean(f && typeof f.face_id === 'string')
      );
      const uniqueFaces = Array.from(new Map(validFaces.map((f) => [f.face_id, f])).values());
      setFacesForSelected(uniqueFaces);
      return;
    }

    let isMounted = true;
    setLoadingFaces(true);

    const fetchFaces = async () => {
      try {
        const filePath = selectedMedia.file_path || selectedMedia.filename;
        const fetchFn = authFetch || fetch;
        let res = await fetchFn(`/api/media/faces-for-file?file=${encodeURIComponent(filePath)}${vaultTokenQuery}`);
        if (!res.ok) {
          res = await fetchFn(`/api/faces/detect?file=${encodeURIComponent(filePath)}${vaultTokenQuery}`);
        }
        if (res.ok && isMounted) {
          const data = await res.json();
          const rawFaces: DetectedFaceRecord[] = Array.isArray(data) ? data : (data?.faces || []);
          const validFaces = rawFaces.filter(
            (f): f is DetectedFaceRecord => Boolean(f && typeof f.face_id === 'string')
          );
          const uniqueFaces = Array.from(new Map(validFaces.map((f) => [f.face_id, f])).values());
          setFacesForSelected(uniqueFaces);
        }
      } catch (err) {
        console.warn('Could not fetch faces for media:', err);
      } finally {
        if (isMounted) setLoadingFaces(false);
      }
    };

    fetchFaces();
    return () => { isMounted = false; };
  }, [isOpen, selectedMedia?.file_path, selectedMedia?.filename, vaultTokenQuery, authFetch]);

  // Family tree kinship context fetching
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isOpen || !selectedMedia) return;
    let isMounted = true;
    const filePath = selectedMedia.file_path || selectedMedia.filename;

    const namesSet = new Set<string>();
    if (selectedMedia.face_names) {
      selectedMedia.face_names.forEach((n) => {
        if (n && typeof n === 'string' && n.trim()) namesSet.add(n.trim());
      });
    }
    if (facesForSelected) {
      facesForSelected.forEach((f) => {
        if (f.name && typeof f.name === 'string' && f.name.trim()) namesSet.add(f.name.trim());
      });
    }

    const faceIds = Array.from(
      new Set(
        (facesForSelected || [])
          .map((f) => f.face_id)
          .filter((id): id is string => Boolean(id && typeof id === 'string' && !id.startsWith('manual_')))
      )
    );
    const personNames = Array.from(namesSet);

    if (personNames.length === 0 && faceIds.length === 0 && !selectedMedia.family_context) {
      return;
    }

    const fetchKinship = async () => {
      try {
        const fetchFn = authFetch || fetch;
        const res = await fetchFn('/api/family-tree/public/photo-kinship', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            face_ids: faceIds.length > 0 ? faceIds : undefined,
            person_names: personNames.length > 0 ? personNames : undefined,
            media_file_path: filePath,
            gallery_facts_scope: galleryKinshipFactsConfig?.scope,
            only_close_events: galleryKinshipFactsConfig?.onlyCloseEvents,
            period_before_days: galleryKinshipFactsConfig?.periodBeforeDays,
            close_event_types: galleryKinshipFactsConfig?.closeEventTypes,
            enabled: galleryKinshipFactsConfig?.enabled,
          }),
        });

        if (res.ok && isMounted) {
          const data = await res.json();
          if (data && isMounted) {
            const updatedContext: FamilyContextData = {
              suggested_caption: data.suggestedCaption || undefined,
              summary_description: data.summaryDescription || undefined,
              identified_members: (data.identifiedPersons || []).map((p: any) => ({
                name: p.name,
                tree_person_id: p.treePersonId,
                kinshipToRoot: p.kinshipToRoot?.primaryTerm || p.kinship || null,
                kinship: p.kinshipToRoot?.primaryTerm || p.kinship || null,
                category: p.kinshipToRoot?.category || null,
              })),
              relationships: (data.relationships || []).map((r: any) => ({
                person1: r.personA || r.person1 || r.person_a,
                person2: r.personB || r.person2 || r.person_b,
                relationship: r.kinshipAtoB || r.relationship || r.kinship,
              })),
              milestones: data.contextualMilestones || [],
            };

            setSelectedMedia((prev) => {
              const updated = prev ? { ...prev, family_context: updatedContext } : null;
              if (onMediaUpdated && isMounted && updated) {
                onMediaUpdated(updated);
              }
              return updated;
            });
          }
        }
      } catch (err) {
        console.warn('Could not update family kinship context:', err);
      }
    };

    fetchKinship();
    const handleTreeUpdated = () => { if (isMounted) fetchKinship(); };
    window.addEventListener('family_tree_updated', handleTreeUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('family_tree_updated', handleTreeUpdated);
    };
  }, [
    isOpen,
    selectedMedia?.file_path,
    selectedMedia?.filename,
    facesForSelected,
    galleryKinshipFactsConfig,
    treeDataVersion,
    authFetch,
  ]);

  // AI single analysis click handler
  const handleAnalyzeClick = async () => {
    if (!selectedMedia) return;
    if (!isEngineConnected && !engineOnline) {
      setAnalysisError(t('aiEngineErrorDescription') || t('aiEngineOfflineTooltip') || 'AI Engine is offline');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisSuccess(false);
    setAnalysisError(null);
    try {
      const filePath = selectedMedia.file_path || selectedMedia.filename;
      if (onStartSingleAnalysis) {
        await onStartSingleAnalysis(
          filePath,
          () => {
            setAnalysisSuccess(true);
            setTimeout(() => setAnalysisSuccess(false), 5000);
            fetchCurrentMediaDetails(filePath);
            if (onRefresh) onRefresh();
            if (onReloadFaces) onReloadFaces();
          },
          (errMsg) => {
            setAnalysisError(errMsg);
          }
        );
      } else {
        const fetchFn = authFetch || fetch;
        const res = await fetchFn('/api/analyze-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_path: filePath }),
        });
        if (res.ok) {
          setAnalysisSuccess(true);
          setTimeout(() => setAnalysisSuccess(false), 5000);
          fetchCurrentMediaDetails(filePath);
          if (onRefresh) onRefresh();
          if (onReloadFaces) onReloadFaces();
        } else {
          const errData = await res.json().catch(() => ({}));
          setAnalysisError(errData.message || 'Analysis failed');
        }
      }
    } catch (err: any) {
      setAnalysisError(err.message || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Tag person handler
  const handleTagPerson = async () => {
    if (!selectedMedia) return;
    const targetName = selectedPersonToTag === '__custom__' ? customPersonName.trim() : selectedPersonToTag.trim();
    if (!targetName) return;

    setIsTagging(true);
    try {
      const fetchFn = authFetch || fetch;
      const res = await fetchFn('/api/media/add-person', {
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
        const existingNames = selectedMedia.face_names || [];
        const newNames = existingNames.includes(targetName) ? existingNames : [...existingNames, targetName];
        const updated: GalleryMediaFile = {
          ...selectedMedia,
          face_count: (selectedMedia.face_count || 0) + 1,
          face_names: newNames,
          faces: [...(selectedMedia.faces || []), newFace],
        };
        setSelectedMedia(updated);
        if (onMediaUpdated) onMediaUpdated(updated);
        setSelectedPersonToTag('');
        setCustomPersonName('');
        setIsAddingPerson(false);
        if (onRefresh) onRefresh();
        if (onReloadFaces) onReloadFaces();
      }
    } catch (err) {
      console.error('Failed to tag person:', err);
    } finally {
      setIsTagging(false);
    }
  };

  // Remove face handler
  const handleRemoveFace = async (faceIdOrIds: string | string[]) => {
    if (!selectedMedia) return;
    const ids = Array.isArray(faceIdOrIds) ? faceIdOrIds : [faceIdOrIds];
    try {
      const fetchFn = authFetch || fetch;
      for (const faceId of ids) {
        await fetchFn('/api/media/remove-face', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: selectedMedia.file_path || selectedMedia.filename,
            face_id: faceId,
          }),
        });
      }
      setFacesForSelected((prev) => prev.filter((f) => !ids.includes(f.face_id)));
      const updatedFaces = (selectedMedia.faces || []).filter((f) => f.face_id && !ids.includes(f.face_id));
      const remainingNames = Array.from(new Set(updatedFaces.map((f) => f.name).filter(Boolean))) as string[];
      const updated: GalleryMediaFile = {
        ...selectedMedia,
        face_count: Math.max(0, (selectedMedia.face_count || ids.length) - ids.length),
        face_names: remainingNames,
        faces: updatedFaces,
      };
      setSelectedMedia(updated);
      if (onMediaUpdated) onMediaUpdated(updated);
      if (onRefresh) onRefresh();
      if (onReloadFaces) onReloadFaces();
    } catch (err) {
      console.error('Failed to remove face:', err);
    }
  };

  // Reassign face handler
  const handleReassignFace = async (faceIdOrIds: string | string[], targetName: string) => {
    if (!selectedMedia || !targetName.trim()) return;
    const trimmed = targetName.trim();
    const ids = Array.isArray(faceIdOrIds) ? faceIdOrIds : [faceIdOrIds];
    setIsReassigning(true);
    try {
      const fetchFn = authFetch || fetch;
      for (const faceId of ids) {
        await fetchFn('/api/faces/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            face_id: faceId,
            name: trimmed,
          }),
        });
      }
      setFacesForSelected((prev) =>
        prev.map((f) => (ids.includes(f.face_id) ? { ...f, name: trimmed, person_id: trimmed, is_reference: 1 } : f))
      );
      const updatedFaces = (selectedMedia.faces || []).map((f) =>
        f.face_id && ids.includes(f.face_id) ? { ...f, name: trimmed, person_id: trimmed, is_reference: 1 } : f
      );
      const newNames = Array.from(new Set(updatedFaces.map((f) => f.name).filter(Boolean))) as string[];
      const updated: GalleryMediaFile = {
        ...selectedMedia,
        face_names: newNames,
        faces: updatedFaces,
      };
      setSelectedMedia(updated);
      if (onMediaUpdated) onMediaUpdated(updated);
      setReassigningFaceId(null);
      setReassignTargetPerson('');
      setReassignCustomName('');
      if (onRefresh) onRefresh();
      if (onReloadFaces) onReloadFaces();
    } catch (err) {
      console.error('Failed to reassign face:', err);
    } finally {
      setIsReassigning(false);
    }
  };

  // Reject face assignment (BUG-017)
  const [, setIsRejectingFace] = useState(false);
  const handleRejectFace = async (faceId: string, personName?: string, personId?: string) => {
    if (!faceId) return;
    setIsRejectingFace(true);
    try {
      const fetchFn = authFetch || fetch;
      await fetchFn('/api/faces/reject-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          face_id: faceId,
          person_id: personId || personName,
        }),
      });
      setFacesForSelected((prev) =>
        prev.map((f) => (f.face_id === faceId ? { ...f, name: '', person_id: undefined, confidence: 0 } : f))
      );
      if (selectedMedia) {
        const updatedFaces = (selectedMedia.faces || []).map((f) =>
          f.face_id === faceId ? { ...f, name: '', person_id: undefined, confidence: 0 } : f
        );
        const remainingNames = Array.from(new Set(updatedFaces.map((f) => f.name).filter(Boolean))) as string[];
        const updated: GalleryMediaFile = {
          ...selectedMedia,
          face_names: remainingNames,
          faces: updatedFaces,
        };
        setSelectedMedia(updated);
        if (onMediaUpdated) onMediaUpdated(updated);
      }
      showToast(language === 'ru' ? 'Лицо отвязано от персоны' : 'Face unlinked from person');
      if (onReloadFaces) onReloadFaces();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to reject face assignment:', err);
    } finally {
      setIsRejectingFace(false);
    }
  };

  // Media Tags Management (FEAT-032)
  const [mediaTags, setMediaTags] = useState<Array<{ tag: string; category?: string }>>([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);

  useEffect(() => {
    if (selectedMedia) {
      const rawTags = selectedMedia.tags || [];
      const parsed = rawTags.map((t) => {
        if (typeof t === 'string') {
          if (t.includes(':')) {
            const [cat, name] = t.split(':');
            return { tag: name.trim(), category: cat.trim() };
          }
          return { tag: t.trim(), category: 'general' };
        }
        return { tag: (t as any).tag || '', category: (t as any).category || 'general' };
      }).filter((t) => Boolean(t.tag));
      setMediaTags(parsed);
    } else {
      setMediaTags([]);
    }
  }, [selectedMedia]);

  const handleAddMediaTag = async (data: { tag: string; category: string }) => {
    if (!selectedMedia) return;
    const mediaId = selectedMedia.file_path || selectedMedia.filename;
    const fetchFn = authFetch || fetch;
    await fetchFn(`/api/media/${encodeURIComponent(mediaId)}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: data.tag, category: data.category }),
    });
    const cleanTag = data.tag.replace(/^#/, '');
    setMediaTags((prev) => {
      if (prev.some((t) => t.tag.toLowerCase() === cleanTag.toLowerCase())) return prev;
      return [...prev, { tag: cleanTag, category: data.category }];
    });
    if (selectedMedia) {
      const existing = selectedMedia.tags || [];
      const updatedTags = existing.includes(cleanTag) ? existing : [...existing, cleanTag];
      const updated: GalleryMediaFile = { ...selectedMedia, tags: updatedTags };
      setSelectedMedia(updated);
      if (onMediaUpdated) onMediaUpdated(updated);
    }
    showToast(language === 'ru' ? `Тег #${cleanTag} добавлен` : `Tag #${cleanTag} added`);
  };

  const handleRemoveMediaTag = async (tagToRemove: string) => {
    if (!selectedMedia) return;
    const mediaId = selectedMedia.file_path || selectedMedia.filename;
    const clean = tagToRemove.replace(/^#/, '');
    const fetchFn = authFetch || fetch;
    await fetchFn(`/api/media/${encodeURIComponent(mediaId)}/tags/${encodeURIComponent(clean)}`, {
      method: 'DELETE',
    });
    setMediaTags((prev) => prev.filter((t) => t.tag.toLowerCase() !== clean.toLowerCase()));
    if (selectedMedia) {
      const updatedTags = (selectedMedia.tags || []).filter((t) => t.toLowerCase() !== clean.toLowerCase());
      const updated: GalleryMediaFile = { ...selectedMedia, tags: updatedTags };
      setSelectedMedia(updated);
      if (onMediaUpdated) onMediaUpdated(updated);
    }
    showToast(language === 'ru' ? `Тег #${clean} удален` : `Tag #${clean} removed`);
  };

  const handleMetadataSaved = (updated: GalleryMediaFile) => {
    setSelectedMedia(updated);
    if (onMediaUpdated) onMediaUpdated(updated);
    if (onRefresh) onRefresh();
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        showVaultPinModal ||
        isAddingPerson ||
        reassigningFaceId ||
        isEditingMetadata ||
        isAddToAlbumOpen ||
        showRenameModal ||
        showDeleteModal ||
        showMoveFolderModal
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      } else if (e.key === 'F11') {
        e.preventDefault();
        handleToggleFullscreen();
      } else if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          return;
        }
        if (isEditMode) {
          if (hasUnsavedEdits) {
            setShowSaveChoiceDialog(true);
          } else {
            setIsEditMode(false);
          }
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowUp' || e.key === '+') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === 'ArrowDown' || e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleResetZoom();
      } else if (!isEditMode && e.key === 'ArrowLeft' && onPrev && hasPrev) {
        onPrev();
      } else if (!isEditMode && e.key === 'ArrowRight' && onNext && hasNext) {
        onNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    onClose,
    onPrev,
    onNext,
    hasPrev,
    hasNext,
    isEditMode,
    hasUnsavedEdits,
    showVaultPinModal,
    isAddingPerson,
    reassigningFaceId,
    isEditingMetadata,
    isAddToAlbumOpen,
    showRenameModal,
    showDeleteModal,
    showMoveFolderModal,
    toggleSidebar,
    handleToggleFullscreen,
  ]);

  if (!isOpen || !selectedMedia) {
    return null;
  }

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp?: number | string) => {
    if (!timestamp) return '—';
    const d = typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(timestamp);
    if (isNaN(d.getTime())) return String(timestamp);
    return d.toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isPrevDisabled = hasPrev !== undefined ? !hasPrev : currentIndex <= 0;
  const isNextDisabled = hasNext !== undefined ? !hasNext : currentIndex < 0 || currentIndex >= totalFiles - 1;

  // Media source URLs with vault authorization parameter attached
  const fileTarget = selectedMedia.file_path || selectedMedia.filename;
  const isHeic = /\.(heic|heif)$/i.test(selectedMedia.filename || selectedMedia.file_path || '');
  const mainImageSrc = isHeic
    ? `/api/media/thumbnail?path=${encodeURIComponent(fileTarget)}&size=1920${vaultTokenQuery}`
    : `/api/media/file?path=${encodeURIComponent(fileTarget)}${vaultTokenQuery}`;

  const videoStreamSrc = `/api/media/file?path=${encodeURIComponent(fileTarget)}${vaultTokenQuery}`;
  const videoPosterSrc = `/api/media/thumbnail?path=${encodeURIComponent(fileTarget)}&size=1920${vaultTokenQuery}`;
  const videoDownloadHref = `/api/media/file?path=${encodeURIComponent(fileTarget)}&download=true${vaultTokenQuery}`;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          ref={containerRef}
          className={cn(
            'relative w-full max-w-7xl h-[94vh] bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-foreground backdrop-blur-2xl transition-all',
            isFullscreen && 'max-w-none w-screen h-screen rounded-none border-none p-0 m-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="flex items-center justify-between px-5 py-3 border-b border-border/80 bg-muted/20 shrink-0">
            <div className="flex items-center gap-3 min-w-0 pr-4">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {selectedMedia.is_video ? <Film size={18} /> : <ImageIcon size={18} />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground truncate max-w-xs sm:max-w-md md:max-w-lg" title={selectedMedia.filename}>
                    {selectedMedia.filename}
                  </h3>
                  {selectedMedia.is_vault && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold flex items-center gap-1">
                      <Lock size={10} />
                      <span>Личная папка</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {formatBytes(selectedMedia.file_size)} • {formatDate(selectedMedia.mtime)}
                </p>
              </div>
            </div>

            {/* Controls */}
            {isEditMode ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                  <Sparkles size={13} className="text-purple-400" />
                  <span>{language === 'ru' ? 'Редактирование' : 'Editing'}</span>
                </span>

                <button
                  type="button"
                  onClick={handleExitEditMode}
                  className="px-3 py-1.5 rounded-xl border border-border/80 hover:bg-muted text-xs font-semibold text-muted-foreground transition-colors"
                >
                  {language === 'ru' ? 'Отмена' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleSaveClick}
                  className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{language === 'ru' ? 'Сохранить' : 'Save'}</span>
                </button>

                {/* Fullscreen toggle (FEAT-027) */}
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="w-8 h-8 rounded-xl border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  title={isFullscreen ? 'Выйти из полноэкранного режима (Esc / F11)' : 'Полноэкранный режим (F11)'}
                >
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>

                {/* Close with unsaved changes prompt */}
                <button
                  type="button"
                  onClick={handleExitEditMode}
                  className="w-8 h-8 rounded-xl border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors ml-1"
                  title={t('closeTooltip') || 'Закрыть'}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {/* FEAT-030: Dedicated Edit Mode Trigger */}
                {!selectedMedia.is_video && canEdit && (
                  <button
                    type="button"
                    onClick={handleEnterEditMode}
                    className="px-3 py-1.5 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs mr-1"
                    title="Редактировать изображение"
                  >
                    <Pencil size={13} />
                    <span>{language === 'ru' ? 'Редактировать' : 'Edit'}</span>
                  </button>
                )}

                {/* Language switcher */}
                <div className="flex items-center rounded-xl bg-muted/40 p-0.5 border border-border/60 text-xs mr-1 sm:mr-2">
                  <button
                    type="button"
                    onClick={() => setLightboxLang('ru')}
                    className={cn(
                      'px-2 py-1 rounded-lg font-semibold text-[11px] transition-all',
                      activeDetailLang === 'ru'
                        ? 'bg-card text-primary shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    RU
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxLang('en')}
                    className={cn(
                      'px-2 py-1 rounded-lg font-semibold text-[11px] transition-all',
                      activeDetailLang === 'en'
                        ? 'bg-card text-primary shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    EN
                  </button>
                </div>

                {/* Prev / Next navigation */}
                {onPrev && (
                  <button
                    type="button"
                    onClick={onPrev}
                    disabled={isPrevDisabled}
                    className="w-8 h-8 rounded-xl border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title={t('prevImageTooltip') || 'Предыдущее'}
                  >
                    <ChevronLeft size={16} />
                  </button>
                )}

                {totalFiles > 0 && currentIndex >= 0 && (
                  <span className="text-[11px] font-mono font-medium text-muted-foreground px-1">
                    {currentIndex + 1} / {totalFiles}
                  </span>
                )}

                {onNext && (
                  <button
                    type="button"
                    onClick={onNext}
                    disabled={isNextDisabled}
                    className="w-8 h-8 rounded-xl border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title={t('nextImageTooltip') || 'Следующее'}
                  >
                    <ChevronRight size={16} />
                  </button>
                )}

                {/* Fullscreen toggle (FEAT-027) */}
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="w-8 h-8 rounded-xl border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  title={isFullscreen ? 'Выйти из полноэкранного режима (Esc / F11)' : 'Полноэкранный режим (F11)'}
                >
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>

                {/* Sidebar toggle (FEAT-027) */}
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className={cn(
                    'w-8 h-8 rounded-xl border border-border/70 flex items-center justify-center transition-colors',
                    isSidebarCollapsed
                      ? 'text-primary bg-primary/10 border-primary/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                  title={isSidebarCollapsed ? 'Показать панель сведений (Ctrl+B)' : 'Скрыть панель сведений (Ctrl+B)'}
                >
                  {isSidebarCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
                </button>

                {/* Close */}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors ml-1"
                  title={t('closeTooltip') || 'Закрыть'}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </header>

          {/* Main Body Grid */}
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
            {/* Viewport */}
            <div className="flex-1 bg-black/70 relative flex flex-col items-center justify-center min-h-0 min-w-0 p-3 overflow-hidden group">
              {/* Media Container */}
              <div className="flex-1 w-full h-full flex items-center justify-center relative min-h-0 overflow-hidden">
                {selectedMedia.is_video ? (
                  <div className="w-full h-full flex items-center justify-center relative">
                    {!videoPlaybackError ? (
                      <video
                        key={selectedMedia.file_path || selectedMedia.filename}
                        src={videoStreamSrc}
                        poster={videoPosterSrc}
                        controls
                        autoPlay
                        playsInline
                        preload="metadata"
                        className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
                        onError={() => setVideoPlaybackError(true)}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-6 bg-card/60 border border-border/80 rounded-3xl max-w-md shadow-2xl backdrop-blur-md">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                          <Film size={32} />
                        </div>
                        <h4 className="text-sm font-bold text-foreground mb-1">{selectedMedia.filename}</h4>
                        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                          {t('videoCodecNotice' as any) ||
                            'Этот формат видео (.MOV / HEVC) не воспроизводится встроенным проигрывателем браузера. Вы можете скачать исходный файл.'}
                        </p>
                        <a
                          href={videoDownloadHref}
                          download={selectedMedia.filename}
                          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 flex items-center gap-2 shadow-xs transition-colors"
                        >
                          <Download size={14} />
                          <span>{t('downloadVideo' as any) || 'Скачать видео'}</span>
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className={cn(
                      'relative inline-flex items-center justify-center max-w-full max-h-full select-none',
                      zoomScale > 1.0 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
                    )}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onDoubleClick={handleDoubleClick}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    style={{
                      transform: `translate(${panX}px, ${panY}px) scale(${zoomScale}) rotate(${((rotationDeg || 0) + (isEditMode ? editorRotationDeg : 0)) % 360}deg)`,
                      transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                      willChange: 'transform',
                    }}
                  >
                    <img
                      src={mainImageSrc}
                      alt={selectedMedia.filename}
                      style={{
                        filter: isComparingBefore ? 'none' : (isEditMode ? selectedStylePreset.cssFilter : undefined),
                        transition: 'filter 0.2s ease',
                      }}
                      className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl pointer-events-none"
                      onLoad={(e) => {
                        const target = e.currentTarget;
                        setImageNaturalDimensions({
                          width: target.naturalWidth,
                          height: target.naturalHeight,
                        });
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.parentElement?.querySelector('.image-fallback-view') as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />

                    {/* Interactive green highlight for selected face (only in normal view when not zoomed) */}
                    {!isEditMode && zoomScale === 1.0 && (() => {
                      if (!selectedFaceId || !imageNaturalDimensions?.width || !imageNaturalDimensions?.height) {
                        return null;
                      }
                      const face = facesForSelected.find((f) => f.face_id === selectedFaceId);
                      if (!face) return null;
                      const rawBbox = face.bbox || (face as any).bounding_box;
                      let bbox: number[] | null = null;
                      if (Array.isArray(rawBbox)) {
                        bbox = rawBbox;
                      } else if (typeof rawBbox === 'string') {
                        try { bbox = JSON.parse(rawBbox); } catch { bbox = null; }
                      }
                      if (!bbox || bbox.length < 4) return null;

                      const [x1, y1, x2, y2] = bbox;
                      const nw = imageNaturalDimensions.width;
                      const nh = imageNaturalDimensions.height;
                      const leftPct = Math.max(0, Math.min(100, (x1 / nw) * 100));
                      const topPct = Math.max(0, Math.min(100, (y1 / nh) * 100));
                      const widthPct = Math.max(0, Math.min(100 - leftPct, ((x2 - x1) / nw) * 100));
                      const heightPct = Math.max(0, Math.min(100 - topPct, ((y2 - y1) / nh) * 100));

                      return (
                        <div
                          className="absolute border-2 border-emerald-500 bg-emerald-500/20 rounded-lg pointer-events-none z-20 shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all"
                          style={{
                            left: `${leftPct}%`,
                            top: `${topPct}%`,
                            width: `${widthPct}%`,
                            height: `${heightPct}%`,
                          }}
                        >
                          <div className="absolute bottom-full left-0 mb-1.5 px-2 py-0.5 rounded-md bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-[11px] font-semibold whitespace-nowrap flex items-center gap-1.5 shadow-lg">
                            <span>{face.name || face.face_id}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Image loading/error fallback */}
                    <div className="image-fallback-view hidden flex-col items-center justify-center p-8 bg-card/40 border border-border/80 rounded-3xl text-center">
                      <ImageIcon size={48} className="text-muted-foreground/60 mb-2" />
                      <p className="text-sm font-semibold text-foreground">{selectedMedia.filename}</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm truncate">{selectedMedia.file_path}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Floating Zoom Level Badge */}
              {(showZoomBadge || zoomScale > 1.0) && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md border border-slate-700/80 text-xs font-mono font-bold text-sky-400 flex items-center gap-2 shadow-2xl animate-in fade-in duration-150">
                  <span>{Math.round(zoomScale * 100)}%</span>
                  {zoomScale > 1.0 && (
                    <button
                      type="button"
                      onClick={handleResetZoom}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors cursor-pointer"
                      title="Сбросить масштаб (1.0x)"
                    >
                      100%
                    </button>
                  )}
                </div>
              )}

              {/* Crop Frame Overlay & Rule-of-Thirds Grid */}
              {isEditMode && activeEditTool === 'crop' && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-30">
                  <div
                    className="crop-frame-box"
                    style={{
                      width: cropAspectRatio === '1:1' ? 440 : cropAspectRatio === '3:4' ? 360 : cropAspectRatio === '4:3' ? 480 : cropAspectRatio === '16:9' ? 560 : cropAspectRatio === '9:16' ? 315 : 520,
                      height: cropAspectRatio === '1:1' ? 440 : cropAspectRatio === '3:4' ? 480 : cropAspectRatio === '4:3' ? 360 : cropAspectRatio === '16:9' ? 315 : cropAspectRatio === '9:16' ? 560 : 390,
                    }}
                  >
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-primary text-white text-[11px] font-mono font-bold whitespace-nowrap shadow-md">
                      {cropAspectRatio} {cropResolution ? `(${cropResolution.width} × ${cropResolution.height})` : ''}
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation overlays */}
              {!isEditMode && onPrev && hasPrev && (
                <button
                  type="button"
                  onClick={onPrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-2xl bg-black/60 hover:bg-black/90 border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-xs shadow-lg cursor-pointer"
                  title="Предыдущее (Стрелка влево)"
                >
                  <ChevronLeft size={22} />
                </button>
              )}
              {!isEditMode && onNext && hasNext && (
                <button
                  type="button"
                  onClick={onNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-2xl bg-black/60 hover:bg-black/90 border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-xs shadow-lg cursor-pointer"
                  title="Следующее (Стрелка вправо)"
                >
                  <ChevronRight size={22} />
                </button>
              )}

              {/* Similar & Burst Series Minimap Filmstrip */}
              {!isEditMode && effectiveGroupFiles && effectiveGroupFiles.length > 1 && (
                <div className="w-full max-w-xl mx-auto mt-2 p-2 rounded-2xl bg-card/80 border border-border/80 backdrop-blur-md shadow-xl flex flex-col gap-1.5 shrink-0 z-10">
                  <div className="flex items-center justify-between text-[11px] px-1 font-semibold text-primary">
                    <span>{t('similarPhotosInGroup') || 'Серия похожих снимков'} ({effectiveGroupFiles.length})</span>
                    <button
                      type="button"
                      onClick={handleUnmarkDuplicate}
                      disabled={isUnmarkingDuplicate}
                      className="px-2 py-0.5 rounded-md bg-muted/80 hover:bg-destructive/15 hover:text-destructive text-[10px] font-medium text-muted-foreground border border-border/60 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Исключить данный файл из серии дубликатов и переанализировать отдельно"
                    >
                      {isUnmarkingDuplicate ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                      <span>{language === 'ru' ? 'Это не дубликат' : 'Not a duplicate'}</span>
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {effectiveGroupFiles.map((simFile: GalleryMediaFile, idx: number) => {
                      const isCurrent =
                        (simFile.file_path && simFile.file_path === selectedMedia?.file_path) ||
                        (simFile.filename && simFile.filename === selectedMedia?.filename);
                      const thumbUrl = `/api/media/thumbnail?path=${encodeURIComponent(simFile.file_path || simFile.filename)}&size=150${vaultTokenQuery}`;

                      return (
                        <button
                          key={simFile.file_path || simFile.filename || idx}
                          type="button"
                          onClick={() => {
                            const updatedSimFile = {
                              ...simFile,
                              similar_group_files: effectiveGroupFiles,
                              similar_files_count: effectiveGroupFiles.length,
                              similarity_group_id: simFile.similarity_group_id || selectedMedia.similarity_group_id,
                            };
                            setSelectedMedia(updatedSimFile);
                            fetchCurrentMediaDetails(updatedSimFile.file_path || updatedSimFile.filename);
                            if (onMediaUpdated) onMediaUpdated(updatedSimFile);
                          }}
                          className={cn(
                            'relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer',
                            isCurrent
                              ? 'border-primary ring-2 ring-primary/40 scale-105'
                              : 'border-transparent hover:border-border'
                          )}
                          title={`${simFile.filename} (#${idx + 1})`}
                        >
                          <img
                            src={thumbUrl}
                            alt={simFile.filename}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-0.5 left-0.5 px-1 py-0.2 bg-black/75 rounded text-[9px] font-mono font-bold text-white leading-none">
                            #{idx + 1}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* FEAT-030: Bottom Editing Toolbar */}
              {isEditMode && (
                <div className="absolute bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 p-3 sm:p-4 z-40 flex flex-col gap-3 shadow-2xl animate-in slide-in-from-bottom duration-200">
                  {/* Tool Selection Tabs */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveEditTool('style')}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer',
                          activeEditTool === 'style'
                            ? 'bg-primary/20 text-primary border border-primary/40 shadow-xs'
                            : 'text-muted-foreground hover:text-foreground hover:bg-slate-800/60'
                        )}
                      >
                        <Palette size={14} />
                        <span>{language === 'ru' ? 'AI Стилизация' : 'AI Styles'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveEditTool('rotate')}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer',
                          activeEditTool === 'rotate'
                            ? 'bg-primary/20 text-primary border border-primary/40 shadow-xs'
                            : 'text-muted-foreground hover:text-foreground hover:bg-slate-800/60'
                        )}
                      >
                        <RotateCw size={14} />
                        <span>{language === 'ru' ? 'Поворот 90°' : 'Rotate 90°'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveEditTool('crop')}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer',
                          activeEditTool === 'crop'
                            ? 'bg-primary/20 text-primary border border-primary/40 shadow-xs'
                            : 'text-muted-foreground hover:text-foreground hover:bg-slate-800/60'
                        )}
                      >
                        <Crop size={14} />
                        <span>{language === 'ru' ? 'Кадрирование' : 'Crop & Scale'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExitEditMode}
                        className="px-3 py-1.5 rounded-xl border border-border/80 hover:bg-muted text-xs font-semibold text-muted-foreground transition-colors cursor-pointer"
                      >
                        {language === 'ru' ? 'Отмена' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveClick}
                        className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check size={14} />
                        <span>{language === 'ru' ? 'Сохранить' : 'Save'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Subpanels */}
                  <div className="w-full">
                    {activeEditTool === 'style' && (
                      <StylePresetCarousel
                        selectedPresetId={selectedStylePreset.id}
                        onSelectPreset={handleSelectStylePreset}
                        isComparingBefore={isComparingBefore}
                        onStartCompare={() => setIsComparingBefore(true)}
                        onEndCompare={() => setIsComparingBefore(false)}
                      />
                    )}

                    {activeEditTool === 'rotate' && (
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditorRotate(-90)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <RotateCcw size={14} />
                            <span>{language === 'ru' ? '90° влево' : '90° Left'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditorRotate(90)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <RotateCw size={14} />
                            <span>{language === 'ru' ? '90° вправо' : '90° Right'}</span>
                          </button>
                          {editorRotationDeg !== 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditorRotationDeg(0);
                                if (selectedStylePreset.id === 'original') setHasUnsavedEdits(false);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-xs text-muted-foreground flex items-center gap-1 cursor-pointer"
                              title="Сбросить поворот"
                            >
                              <Undo2 size={13} />
                              <span>{language === 'ru' ? 'Сброс' : 'Reset'}</span>
                            </button>
                          )}
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">
                          {language === 'ru' ? 'Текущий угол:' : 'Current angle:'}{' '}
                          <strong className="text-primary font-bold">{editorRotationDeg}°</strong>
                        </span>
                      </div>
                    )}

                    {activeEditTool === 'crop' && (
                      <CropFrameOverlay
                        aspectRatio={cropAspectRatio}
                        onSelectAspectRatio={(ratio) => {
                          setCropAspectRatio(ratio);
                          setHasUnsavedEdits(true);
                        }}
                        selectedResolution={cropResolution}
                        onSelectResolution={(res) => {
                          setCropResolution(res);
                          setHasUnsavedEdits(true);
                        }}
                        naturalWidth={imageNaturalDimensions?.width || 1920}
                        naturalHeight={imageNaturalDimensions?.height || 1080}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar / Info Panel (Collapsible per FEAT-027, hidden in Edit Mode per FEAT-030) */}
            {!isEditMode && !isSidebarCollapsed && (
              <div className="w-full md:w-80 lg:w-96 border-t md:border-t-0 md:border-l border-border/80 bg-card/60 backdrop-blur-md flex flex-col overflow-y-auto text-xs divide-y divide-border/60 shrink-0">
                {/* File details card */}
                <div className="p-4 space-y-3">
                  {/* Category Taxonomy Badge (FEAT-028) */}
                  {(() => {
                    const rawCt = selectedMedia.content_type || 'other';
                    const badge = TAXONOMY_BADGES[rawCt] || TAXONOMY_BADGES.other;
                    return (
                      <div className={cn('px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 self-start shadow-2xs', badge.color)}>
                        <span>{badge.icon}</span>
                        <span>{activeDetailLang === 'ru' ? badge.labelRu : badge.labelEn}</span>
                      </div>
                    );
                  })()}

                  <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    {t('fileDetails') || 'Сведения о файле'}
                  </h4>
                  {canEdit && selectedMedia.status === 'PROCESSED' && (
                    <button
                      type="button"
                      onClick={() => setIsEditingMetadata(true)}
                      className="px-2 py-1 rounded-lg border border-border/80 hover:bg-muted text-[11px] font-semibold text-primary transition-colors flex items-center gap-1"
                    >
                      <Edit3 size={11} />
                      <span>{t('btnEditMetadata') || 'Изменить'}</span>
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">{t('fullPath') || 'Путь'}:</span>
                    <span className="font-mono text-[11px] text-foreground text-right break-all truncate max-w-[200px]" title={selectedMedia.file_path || selectedMedia.filename}>
                      {selectedMedia.file_path || selectedMedia.filename}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">{t('status') || 'Статус'}:</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase',
                          selectedMedia.status === 'PROCESSED'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : selectedMedia.status === 'PENDING'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {selectedMedia.status || 'UNPROCESSED'}
                      </span>
                    </div>
                  </div>

                  {(Boolean(selectedMedia.is_burst_duplicate) || Boolean(effectiveGroupFiles && effectiveGroupFiles.length > 1)) && (
                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-semibold text-primary">Серия / Дубликаты</span>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {selectedMedia.burst_primary ? `Копия от ${selectedMedia.burst_primary}` : `Группа (${effectiveGroupFiles?.length || selectedMedia.similar_files_count || 2} шт)`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleUnmarkDuplicate}
                        disabled={isUnmarkingDuplicate}
                        className="px-2 py-1 rounded-lg bg-card hover:bg-destructive/15 hover:text-destructive border border-border text-[10px] font-medium transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                        title="Исключить файл из дубликатов"
                      >
                        {isUnmarkingDuplicate ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        <span>Это не дубликат</span>
                      </button>
                    </div>
                  )}

                  {selectedMedia.media_date && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Дата съёмки:</span>
                      <span className="font-medium text-foreground">{selectedMedia.media_date}</span>
                    </div>
                  )}

                  {selectedMedia.location_name && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Место:</span>
                      <span className="font-medium text-foreground truncate max-w-[180px]" title={selectedMedia.location_name}>
                        {selectedMedia.location_name}
                      </span>
                    </div>
                  )}

                  {Boolean(selectedMedia.camera_make || selectedMedia.camera_model) && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Камера:</span>
                      <span className="font-medium text-foreground truncate max-w-[180px]">
                        {[selectedMedia.camera_make, selectedMedia.camera_model].filter(Boolean).join(' ')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  <ModuleStatusBadges media={selectedMedia} variant="chips" />
                </div>
              </div>

              {/* Family Context & Kinship */}
              {Boolean(
                selectedMedia.family_context?.suggested_caption ||
                (selectedMedia.family_context?.identified_members && selectedMedia.family_context.identified_members.length > 0) ||
                (selectedMedia.family_context?.relationships && selectedMedia.family_context.relationships.length > 0) ||
                (selectedMedia.family_context?.milestones && selectedMedia.family_context.milestones.length > 0)
              ) && (
                  <div className="p-4 space-y-2.5 bg-primary/5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                      <TreePine size={13} />
                      <span>Семейный контекст</span>
                    </div>

                    {selectedMedia.family_context?.suggested_caption && (
                      <p className="text-xs font-medium text-foreground leading-relaxed italic">
                        «{selectedMedia.family_context.suggested_caption}»
                      </p>
                    )}

                    {selectedMedia.family_context?.relationships && selectedMedia.family_context.relationships.length > 0 && (
                      <div className="space-y-1 pt-1">
                        {selectedMedia.family_context.relationships.map((rel, idx) => (
                          <div key={idx} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <span>💞</span>
                            <span className="font-semibold text-foreground">{rel.person1}</span>
                            <span>&</span>
                            <span className="font-semibold text-foreground">{rel.person2}</span>:
                            <span className="text-primary font-medium">{rel.relationship}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedMedia.family_context?.milestones && selectedMedia.family_context.milestones.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-border/40">
                        {selectedMedia.family_context.milestones.slice(0, 3).map((ms, idx) => (
                          <div key={idx} className="text-[11px] text-amber-400/90 flex items-center gap-1.5">
                            <span>{CATEGORY_ICONS[ms.type || ''] || '⭐'}</span>
                            <span className="font-medium truncate">{ms.title || ms.date}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              {/* AI Description & Summary */}
              {(selectedMedia.description || selectedMedia.description_ru || selectedMedia.summary || selectedMedia.summary_ru) && (
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider">
                    <Sparkles size={13} className="text-primary" />
                    <span>Описание AI</span>
                  </div>

                  {/* Summary */}
                  {(selectedMedia.summary || selectedMedia.summary_ru) && (
                    <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-1">
                      <span className="text-[10px] font-bold text-primary uppercase">Кратко:</span>
                      <p className="text-xs text-foreground leading-relaxed">
                        {activeDetailLang === 'ru'
                          ? (selectedMedia.summary_ru || selectedMedia.summary)
                          : (selectedMedia.summary || selectedMedia.summary_ru)}
                      </p>
                    </div>
                  )}

                  {/* Detailed Description */}
                  {(selectedMedia.description || selectedMedia.description_ru) && (
                    <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Подробности:</span>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {activeDetailLang === 'ru'
                          ? (selectedMedia.description_ru || selectedMedia.description)
                          : (selectedMedia.description || selectedMedia.description_ru)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Media Tags (FEAT-032) */}
              <div className="p-4 space-y-2.5 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider">
                    <Tag size={13} className="text-primary" />
                    <span>Теги</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{mediaTags.length} тегов</span>
                </div>

                <div className="flex flex-wrap gap-1.5 items-center">
                  {mediaTags.map((t) => (
                    <span
                      key={t.tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono font-medium group transition-all"
                    >
                      <span>#{t.tag.replace(/^#/, '')}</span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMediaTag(t.tag)}
                          className="p-0.5 rounded text-blue-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Удалить тег с файла"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </span>
                  ))}

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setIsTagModalOpen(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted/30 hover:bg-muted/60 border border-border/80 text-muted-foreground hover:text-foreground text-xs font-medium transition-all cursor-pointer"
                    >
                      <Plus size={11} />
                      <span>Добавить</span>
                    </button>
                  )}
                </div>
              </div>

              {/* People & Faces */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider">
                    <User size={13} className="text-primary" />
                    <span>Люди ({groupedVideoFaces.length})</span>
                  </div>

                  {canManageFaces && (
                    <button
                      type="button"
                      onClick={() => setIsAddingPerson((prev) => !prev)}
                      className="px-2 py-1 rounded-lg border border-border/80 hover:bg-muted text-[11px] font-semibold text-primary transition-colors flex items-center gap-1"
                    >
                      <UserPlus size={11} />
                      <span>{isAddingPerson ? 'Отмена' : 'Добавить'}</span>
                    </button>
                  )}
                </div>

                {/* Add Person Inline Form */}
                {isAddingPerson && (
                  <div className="p-3 rounded-2xl border border-primary/30 bg-primary/5 space-y-2.5 animate-in fade-in">
                    <label className="text-[11px] font-semibold text-foreground block">
                      Привязать человека к файлу
                    </label>
                    <select
                      value={selectedPersonToTag}
                      onChange={(e) => setSelectedPersonToTag(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-border/80 bg-card text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Выберите персону...</option>
                      {effectiveKnownPersons.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.display_name || p.name} ({p.count})
                        </option>
                      ))}
                      <option value="__custom__">+ Новое имя...</option>
                    </select>

                    {selectedPersonToTag === '__custom__' && (
                      <input
                        type="text"
                        placeholder="Введите имя и фамилию"
                        value={customPersonName}
                        onChange={(e) => setCustomPersonName(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-border/80 bg-card text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setIsAddingPerson(false); setSelectedPersonToTag(''); setCustomPersonName(''); }}
                        className="flex-1 py-1 rounded-xl border border-border/80 text-[11px] font-medium text-muted-foreground hover:bg-muted"
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        disabled={isTagging || (!selectedPersonToTag || (selectedPersonToTag === '__custom__' && !customPersonName.trim()))}
                        onClick={handleTagPerson}
                        className="flex-1 py-1 rounded-xl bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 disabled:opacity-50"
                      >
                        {isTagging ? 'Сохранение...' : 'Привязать'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Faces List */}
                {loadingFaces ? (
                  <div className="flex items-center justify-center p-4 text-muted-foreground gap-2">
                    <Loader2 size={14} className="animate-spin text-primary" />
                    <span>Поиск лиц...</span>
                  </div>
                ) : groupedVideoFaces.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic py-1">Лица не обнаружены</p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {groupedVideoFaces.map((f) => {
                      const isSelected = selectedFaceId === f.face_id;
                      const isEditing = reassigningFaceId === f.face_id;

                      const isManual = !f.face_id || f.face_id.startsWith('manual_') || f.face_id.startsWith('face_manual_');
                      const cropUrl = !isManual
                        ? (f.image_path
                          ? `/api/faces/image/${f.image_path.split(/[/\\]/).pop()}`
                          : f.face_id
                            ? `/api/faces/image/${encodeURIComponent(f.face_id)}`
                            : null)
                        : null;
                      const personMeta = effectiveKnownPersons.find(
                        (kp) => (f.name && kp.name.toLowerCase() === f.name.toLowerCase()) ||
                          (f.person_id && (kp as any).person_id === f.person_id)
                      );
                      const displayAvatarUrl = cropUrl || personMeta?.avatarUrl || null;

                      return (
                        <div
                          key={f.face_id}
                          className={cn(
                            'p-2 rounded-xl border transition-all flex flex-col gap-2 cursor-pointer',
                            isSelected
                              ? 'border-emerald-500 bg-emerald-500/15 shadow-xs ring-1 ring-emerald-500/30'
                              : 'border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/40'
                          )}
                          onClick={() => setSelectedFaceId(isSelected ? null : f.face_id)}
                          onMouseEnter={() => {
                            if (!selectedFaceId) setSelectedFaceId(f.face_id);
                          }}
                          onMouseLeave={() => {
                            if (selectedFaceId === f.face_id) setSelectedFaceId(null);
                          }}
                          title={f.name ? `Лицо: ${f.name} (нажмите, чтобы выделить на фото)` : 'Нажмите, чтобы выделить на фото'}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {displayAvatarUrl ? (
                                <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-border/80 bg-muted/40 flex items-center justify-center">
                                  <img
                                    src={displayAvatarUrl}
                                    alt={f.name || 'Face'}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      target.style.display = 'none';
                                      const fallback = target.nextElementSibling as HTMLElement;
                                      if (fallback) fallback.style.display = 'flex';
                                    }}
                                  />
                                  <div className="hidden w-full h-full items-center justify-center bg-primary/10 text-primary font-bold text-xs">
                                    {f.name ? f.name.charAt(0).toUpperCase() : <User size={16} />}
                                  </div>
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-border/80 flex items-center justify-center font-bold text-xs shrink-0">
                                  {f.name ? f.name.charAt(0).toUpperCase() : <User size={16} />}
                                </div>
                              )}

                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">
                                  {f.name || 'Неопознанное лицо'}
                                </p>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  {isManual ? (
                                    <span className="text-amber-400 font-medium">Вручную</span>
                                  ) : (
                                    <span>
                                      {f.confidence ? `${Math.round(f.confidence * 100)}% совпадение` : 'Распознано'}
                                    </span>
                                  )}
                                  {Boolean((f as any).occurrencesCount && (f as any).occurrencesCount > 1) && (
                                    <span className="text-primary font-mono">
                                      • {(f as any).occurrencesCount} кадров
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Face actions */}
                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {f.name && onViewInFamilyTree && (
                                <button
                                  type="button"
                                  onClick={() => { onClose(); onViewInFamilyTree(f.name!); }}
                                  className="p-1 rounded-lg text-muted-foreground hover:text-emerald-400 hover:bg-muted transition-colors"
                                  title="Показать в семейном древе"
                                >
                                  <TreePine size={13} />
                                </button>
                              )}

                              {canManageFaces && (
                                <>
                                  {f.name && (
                                    <button
                                      type="button"
                                      onClick={() => handleRejectFace(f.face_id, f.name, f.person_id)}
                                      className="p-1 rounded-lg text-muted-foreground hover:text-amber-400 hover:bg-muted transition-colors"
                                      title="Это не этот человек (Отвязать от персоны)"
                                      id={`btn-reject-face-${f.face_id}`}
                                    >
                                      <UserX size={13} />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReassigningFaceId(isEditing ? null : f.face_id);
                                      setReassignTargetPerson(f.name || '');
                                      setReassignCustomName('');
                                    }}
                                    className="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                                    title="Изменить имя"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFace(f.allFaceIds || f.face_id)}
                                    className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                                    title="Удалить"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Inline Reassign Form */}
                          {isEditing && (
                            <div className="pt-2 border-t border-border/50 space-y-2 animate-in fade-in" onClick={(e) => e.stopPropagation()}>
                              <select
                                value={reassignTargetPerson}
                                onChange={(e) => setReassignTargetPerson(e.target.value)}
                                className="w-full px-2 py-1 rounded-lg border border-border/80 bg-card text-foreground text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                              >
                                <option value="">Выберите персону...</option>
                                {effectiveKnownPersons.map((p) => (
                                  <option key={p.name} value={p.name}>
                                    {p.display_name || p.name}
                                  </option>
                                ))}
                                <option value="__custom__">+ Новое имя...</option>
                              </select>

                              {reassignTargetPerson === '__custom__' && (
                                <input
                                  type="text"
                                  placeholder="Имя и фамилия"
                                  value={reassignCustomName}
                                  onChange={(e) => setReassignCustomName(e.target.value)}
                                  className="w-full px-2 py-1 rounded-lg border border-border/80 bg-card text-foreground text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              )}

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => { setReassigningFaceId(null); setReassignCustomName(''); }}
                                  className="flex-1 py-1 rounded-lg border border-border/80 text-[10px] text-muted-foreground hover:bg-muted"
                                >
                                  Отмена
                                </button>
                                <button
                                  type="button"
                                  disabled={isReassigning || (!reassignTargetPerson || (reassignTargetPerson === '__custom__' && !reassignCustomName.trim()))}
                                  onClick={() => {
                                    const target = reassignTargetPerson === '__custom__' ? reassignCustomName : reassignTargetPerson;
                                    handleReassignFace(f.allFaceIds || f.face_id, target);
                                  }}
                                  className="flex-1 py-1 rounded-lg bg-primary text-primary-foreground text-[10px] font-semibold hover:bg-primary/90 disabled:opacity-50"
                                >
                                  {isReassigning ? 'Сохранение...' : 'Сохранить'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Actions Panel (FEAT-027) */}
              <div className="p-4 mt-auto space-y-3 bg-muted/10 border-t border-border/60">
                {/* 2x3 Modern Action Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {/* 1. Favorite toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedMedia.file_path || selectedMedia.filename;
                      if (target) toggleFavorite(target);
                    }}
                    className={cn(
                      'py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors',
                      isFavorite(selectedMedia.file_path || selectedMedia.filename)
                        ? 'text-rose-500 bg-rose-500/10 border-rose-500/30'
                        : 'text-muted-foreground hover:text-foreground bg-card/50 border-border/70 hover:bg-muted'
                    )}
                    title={isFavorite(selectedMedia.file_path || selectedMedia.filename) ? 'Удалить из избранного' : 'Добавить в избранное'}
                  >
                    <Heart size={14} fill={isFavorite(selectedMedia.file_path || selectedMedia.filename) ? 'currentColor' : 'none'} />
                    <span className="truncate">
                      {isFavorite(selectedMedia.file_path || selectedMedia.filename) ? 'В избранном' : 'В избранное'}
                    </span>
                  </button>

                  {/* 2. Rotate Left 90° */}
                  <button
                    type="button"
                    disabled={selectedMedia.is_video || isRotating || !canEdit}
                    onClick={handleRotateLeft}
                    className="py-2 px-2.5 rounded-xl border border-border/70 bg-card/50 text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    title="Повернуть на 90° против часовой стрелки"
                  >
                    <RotateCcw size={14} className={cn(isRotating && 'animate-spin')} />
                    <span className="truncate">Повернуть</span>
                  </button>

                  {/* 3. Direct Download */}
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="py-2 px-2.5 rounded-xl border border-border/70 bg-card/50 text-foreground hover:bg-muted text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    title="Скачать исходный файл"
                  >
                    <Download size={14} />
                    <span className="truncate">Скачать</span>
                  </button>

                  {/* 4. Rename File */}
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={handleOpenRename}
                    className="py-2 px-2.5 rounded-xl border border-border/70 bg-card/50 text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    title="Переименовать файл"
                  >
                    <Pencil size={14} />
                    <span className="truncate">Имя</span>
                  </button>

                  {/* 5. Metadata Editor */}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setIsEditingMetadata(true)}
                      className="py-2 px-2.5 rounded-xl border border-border/70 bg-card/50 text-foreground hover:bg-muted text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      title="Редактировать метаданные"
                    >
                      <Edit3 size={14} />
                      <span className="truncate">Свойства</span>
                    </button>
                  )}

                  {/* 6. Unified Move Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsMoveMenuOpen((prev) => !prev)}
                      className="w-full py-2 px-2.5 rounded-xl border border-border/70 bg-card/50 text-foreground hover:bg-muted text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      title="Переместить (в альбом, папку или личную папку)"
                    >
                      <FolderInput size={14} />
                      <span className="truncate">Переместить</span>
                      <ChevronDown size={12} className="opacity-60" />
                    </button>

                    {isMoveMenuOpen && (
                      <div className="absolute bottom-full mb-1.5 right-0 w-56 rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md shadow-xl py-1 text-xs z-50 animate-in fade-in zoom-in-95">
                        {/* 6a. Personal folder / Vault */}
                        {isAdmin && (
                          <button
                            id="mov_to_vault_button_id"
                            type="button"
                            onClick={() => {
                              setIsMoveMenuOpen(false);
                              const filePath = selectedMedia.file_path || selectedMedia.filename;
                              if (selectedMedia.is_vault) {
                                handleRestoreFromVault();
                              } else {
                                setPendingVaultFilePath(filePath);
                                setVaultPinInput('');
                                setVaultPinError(null);
                                setShowVaultPinModal(true);
                              }
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2 text-foreground font-medium"
                          >
                            {selectedMedia.is_vault ? <Unlock size={14} className="text-amber-400" /> : <Lock size={14} />}
                            <span>{selectedMedia.is_vault ? 'Восстановить из личной папки' : 'В личную папку (Vault)'}</span>
                          </button>
                        )}

                        {/* 6b. Move to another folder on disk */}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsMoveMenuOpen(false);
                              setTargetFolderInput(selectedMedia.folder || '');
                              setMoveFolderError(null);
                              setShowMoveFolderModal(true);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2 text-foreground font-medium"
                          >
                            <Folder size={14} />
                            <span>В другую папку...</span>
                          </button>
                        )}

                        {/* 6c. Add to Virtual Album */}
                        <button
                          id="add_to_album_button_id"
                          type="button"
                          onClick={() => {
                            setIsMoveMenuOpen(false);
                            setIsAddToAlbumOpen(true);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2 text-foreground font-medium"
                        >
                          <FolderPlus size={14} />
                          <span>Добавить в альбом...</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 7. Delete File Action (Hard-confirmation) */}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setShowDeleteModal(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 flex items-center justify-center gap-2 transition-colors shadow-2xs"
                  >
                    <Trash2 size={14} />
                    <span>Удалить файл</span>
                  </button>
                )}

                {/* 8. Run AI Analysis button */}
                <button
                  id="btn_analyze_file_id"
                  type="button"
                  disabled={disabled || isAnalyzing || !isEngineConnected || !engineOnline}
                  onClick={handleAnalyzeClick}
                  className="w-full py-2.5 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shadow-xs"
                >
                  {isAnalyzing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  <span>
                    {isAnalyzing
                      ? (t('aiAnalyzingInProgress') || 'Анализ выполняется...')
                      : (t('btnAnalyzeFile') || 'Запустить AI анализ')}
                  </span>
                </button>

                {analysisSuccess && (
                  <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs text-center font-medium animate-in fade-in">
                    ✓ Анализ успешно завершён
                  </div>
                )}

                {analysisError && (
                  <div className="p-2 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs text-center font-medium animate-in fade-in">
                    {analysisError}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Metadata Editor Modal */}
      <MetadataEditorModal
        isOpen={isEditingMetadata}
        onClose={() => setIsEditingMetadata(false)}
        mediaFile={selectedMedia}
        onSaved={handleMetadataSaved}
      />

      {/* Add To Virtual Album Modal */}
      {isAddToAlbumOpen && selectedMedia && (
        <AddToAlbumModal
          isOpen={isAddToAlbumOpen}
          onClose={() => setIsAddToAlbumOpen(false)}
          mediaFile={selectedMedia}
          onAdded={() => { if (onRefresh) onRefresh(); }}
        />
      )}

      {/* Vault PIN Confirmation Modal */}
      {showVaultPinModal && (
        <div
          className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setShowVaultPinModal(false); }}
        >
          <div className="w-full max-w-sm bg-card border border-border/80 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-foreground">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Подтверждение PIN-кода</h3>
                <p className="text-[11px] text-muted-foreground">Для перемещения файла в личную папку введите PIN-код</p>
              </div>
            </div>

            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              value={vaultPinInput}
              onChange={(e) => { setVaultPinInput(e.target.value.replace(/\D/g, '')); setVaultPinError(null); }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && vaultPinInput.length >= 4) {
                  e.preventDefault();
                }
              }}
              placeholder="••••••"
              className="w-full px-4 py-3 rounded-xl border border-border/80 bg-muted/30 text-foreground text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />

            {vaultPinError && (
              <div className="flex items-center gap-2 text-xs text-destructive font-semibold">
                <AlertCircle size={14} />
                <span>{vaultPinError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setShowVaultPinModal(false); setVaultPinInput(''); setVaultPinError(null); }}
                className="flex-1 py-2.5 rounded-xl border border-border/80 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={vaultPinLoading || vaultPinInput.length < 4}
                onClick={async () => {
                  if (!pendingVaultFilePath) return;
                  setVaultPinLoading(true);
                  setVaultPinError(null);

                  const res = await unlockVault(vaultPinInput);
                  if (!res.success) {
                    setVaultPinError(res.error || 'Неверный PIN-код');
                    setVaultPinLoading(false);
                    return;
                  }

                  await addVaultItem(pendingVaultFilePath);
                  const updated = { ...selectedMedia!, is_vault: true };
                  setSelectedMedia(updated);
                  if (onMediaUpdated) onMediaUpdated(updated);
                  window.dispatchEvent(new CustomEvent('media_updated', { detail: { filePath: pendingVaultFilePath, is_vault: true } }));
                  if (onRefresh) onRefresh();

                  setVaultPinLoading(false);
                  setShowVaultPinModal(false);
                  setVaultPinInput('');
                  setPendingVaultFilePath(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {vaultPinLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <span>Переместить</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename File Modal (FEAT-027) */}
      {showRenameModal && (
        <div
          className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setShowRenameModal(false); }}
        >
          <div className="w-full max-w-sm bg-card border border-border/80 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-foreground">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Pencil size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Переименовать файл</h3>
                <p className="text-[11px] text-muted-foreground">Введите новое имя файла с расширением</p>
              </div>
            </div>

            <input
              type="text"
              autoFocus
              value={newFilenameInput}
              onChange={(e) => { setNewFilenameInput(e.target.value); setRenameError(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirmRename();
                } else if (e.key === 'Escape') {
                  setShowRenameModal(false);
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-muted/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />

            {renameError && (
              <div className="flex items-center gap-2 text-xs text-destructive font-semibold">
                <AlertCircle size={14} />
                <span>{renameError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setShowRenameModal(false); setRenameError(null); }}
                className="flex-1 py-2.5 rounded-xl border border-border/80 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isRenaming || !newFilenameInput.trim() || newFilenameInput.trim() === selectedMedia?.filename}
                onClick={handleConfirmRename}
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isRenaming ? <Loader2 size={14} className="animate-spin" /> : <span>Сохранить</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (FEAT-027) */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false); }}
        >
          <div className="w-full max-w-sm bg-card border border-destructive/40 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-foreground">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Удаление файла</h3>
                <p className="text-[11px] text-muted-foreground">Это действие необратимо удалит файл с диска</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border/60 break-all font-mono">
              {selectedMedia?.filename}
            </p>

            {deleteError && (
              <div className="flex items-center gap-2 text-xs text-destructive font-semibold">
                <AlertCircle size={14} />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeleteError(null); }}
                className="flex-1 py-2.5 rounded-xl border border-border/80 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <span>Удалить</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move To Folder Modal (FEAT-027) */}
      {showMoveFolderModal && (
        <div
          className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setShowMoveFolderModal(false); }}
        >
          <div className="w-full max-w-md bg-card border border-border/80 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-foreground">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Folder size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Переместить в другую папку</h3>
                <p className="text-[11px] text-muted-foreground">Укажите путь к целевой папке на сервере</p>
              </div>
            </div>

            <input
              type="text"
              autoFocus
              value={targetFolderInput}
              onChange={(e) => { setTargetFolderInput(e.target.value); setMoveFolderError(null); }}
              placeholder="/nas/photos/archive"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirmMoveFolder();
                } else if (e.key === 'Escape') {
                  setShowMoveFolderModal(false);
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-muted/30 text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />

            {moveFolderError && (
              <div className="flex items-center gap-2 text-xs text-destructive font-semibold">
                <AlertCircle size={14} />
                <span>{moveFolderError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setShowMoveFolderModal(false); setMoveFolderError(null); }}
                className="flex-1 py-2.5 rounded-xl border border-border/80 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isMovingFolder || !targetFolderInput.trim()}
                onClick={handleConfirmMoveFolder}
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isMovingFolder ? <Loader2 size={14} className="animate-spin" /> : <span>Переместить</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal 3-Option Save Choice Dialog (FEAT-030) */}
      <SaveChoiceDialog
        isOpen={showSaveChoiceDialog}
        onClose={() => setShowSaveChoiceDialog(false)}
        onConfirm={handleConfirmSaveChoice}
        fileName={selectedMedia?.filename}
        isSaving={isSavingChoice}
      />

      {/* Universal Tag Modal (FEAT-032) */}
      <UniversalTagModal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        mode="viewer_add"
        onSave={handleAddMediaTag}
      />

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-4 py-2 rounded-2xl bg-slate-900/95 text-slate-100 border border-slate-700 shadow-2xl text-xs font-semibold backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-bottom duration-200">
          <Sparkles size={14} className="text-primary" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
}
