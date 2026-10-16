import { useState, useEffect, useMemo } from 'react';
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
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
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
} from 'lucide-react';
import { cn } from '../../utils';
import './MediaViewerModal.css';

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

  // Fetch detected faces for current file
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
        const res = await fetchFn(`/api/faces/detect?file=${encodeURIComponent(filePath)}${vaultTokenQuery}`);
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

            setSelectedMedia((prev) => (prev ? { ...prev, family_context: updatedContext } : null));
            if (onMediaUpdated && isMounted) {
              onMediaUpdated({
                ...selectedMedia,
                family_context: updatedContext,
              });
            }
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

  const handleMetadataSaved = (updated: GalleryMediaFile) => {
    setSelectedMedia(updated);
    if (onMediaUpdated) onMediaUpdated(updated);
    if (onRefresh) onRefresh();
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showVaultPinModal || isAddingPerson || reassigningFaceId || isEditingMetadata || isAddToAlbumOpen) {
        return;
      }
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && onPrev && hasPrev) {
        onPrev();
      } else if (e.key === 'ArrowRight' && onNext && hasNext) {
        onNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onPrev, onNext, hasPrev, hasNext, showVaultPinModal, isAddingPerson, reassigningFaceId, isEditingMetadata, isAddToAlbumOpen]);

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
          className="relative w-full max-w-7xl h-[94vh] bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-foreground backdrop-blur-2xl"
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
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
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

              {/* Favorite toggle */}
              <button
                type="button"
                onClick={() => {
                  const target = selectedMedia.file_path || selectedMedia.filename;
                  if (target) toggleFavorite(target);
                }}
                className={cn(
                  'w-8 h-8 rounded-xl border border-border/70 flex items-center justify-center transition-colors',
                  isFavorite(selectedMedia.file_path || selectedMedia.filename)
                    ? 'text-rose-500 bg-rose-500/10 border-rose-500/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
                title={isFavorite(selectedMedia.file_path || selectedMedia.filename) ? 'Удалить из избранного' : 'Добавить в избранное'}
              >
                <Heart size={16} fill={isFavorite(selectedMedia.file_path || selectedMedia.filename) ? 'currentColor' : 'none'} />
              </button>

              {/* Add to album */}
              <button
                type="button"
                onClick={() => setIsAddToAlbumOpen(true)}
                className="w-8 h-8 rounded-xl border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                title="Добавить в альбом"
              >
                <FolderPlus size={16} />
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
                  <div className="relative inline-flex items-center justify-center max-w-full max-h-full">
                    <img
                      src={mainImageSrc}
                      alt={selectedMedia.filename}
                      className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl transition-all"
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

                    {/* Interactive green highlight for selected face */}
                    {(() => {
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

              {/* Navigation overlays */}
              {onPrev && hasPrev && (
                <button
                  type="button"
                  onClick={onPrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-2xl bg-black/60 hover:bg-black/90 border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-xs shadow-lg"
                  title="Предыдущее (Стрелка влево)"
                >
                  <ChevronLeft size={22} />
                </button>
              )}
              {onNext && hasNext && (
                <button
                  type="button"
                  onClick={onNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-2xl bg-black/60 hover:bg-black/90 border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-xs shadow-lg"
                  title="Следующее (Стрелка вправо)"
                >
                  <ChevronRight size={22} />
                </button>
              )}

              {/* Similar & Burst Series Minimap Filmstrip */}
              {effectiveGroupFiles && effectiveGroupFiles.length > 1 && (
                <div className="w-full max-w-xl mx-auto mt-2 p-2 rounded-2xl bg-card/80 border border-border/80 backdrop-blur-md shadow-xl flex flex-col gap-1.5 shrink-0 z-10">
                  <div className="flex items-center justify-between text-[11px] px-1 font-semibold text-primary">
                    <span>{t('similarPhotosInGroup') || 'Серия похожих снимков'} ({effectiveGroupFiles.length})</span>
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
            </div>

            {/* Sidebar / Info Panel */}
            <div className="w-full md:w-80 lg:w-96 border-t md:border-t-0 md:border-l border-border/80 bg-card/60 backdrop-blur-md flex flex-col overflow-y-auto text-xs divide-y divide-border/60 shrink-0">
              {/* File details card */}
              <div className="p-4 space-y-3">
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

              {/* Actions Footer */}
              <div className="p-4 mt-auto space-y-2 bg-muted/10">
                {/* Move to Vault / Restore button */}
                {isAdmin && (
                  <button
                    id="mov_to_vault_button_id"
                    type="button"
                    onClick={async () => {
                      const filePath = selectedMedia.file_path || selectedMedia.filename;
                      if (selectedMedia.is_vault) {
                        // Restore from vault
                        await removeVaultItem(filePath);
                        const updated = { ...selectedMedia, is_vault: false };
                        setSelectedMedia(updated);
                        if (onMediaUpdated) onMediaUpdated(updated);
                        window.dispatchEvent(new CustomEvent('media_updated', { detail: { filePath, is_vault: false } }));
                        if (onRefresh) onRefresh();
                      } else {
                        // Move to vault with PIN
                        setPendingVaultFilePath(filePath);
                        setVaultPinInput('');
                        setVaultPinError(null);
                        setShowVaultPinModal(true);
                      }
                    }}
                    className={cn(
                      'w-full py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs',
                      selectedMedia.is_vault
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                        : 'border-border/80 bg-muted/40 text-foreground hover:bg-muted'
                    )}
                  >
                    {selectedMedia.is_vault ? <Unlock size={14} /> : <Lock size={14} />}
                    <span>
                      {selectedMedia.is_vault
                        ? 'Восстановить из личной папки'
                        : 'Переместить в личную папку'}
                    </span>
                  </button>
                )}

                {/* Add to album */}
                <button
                  id="add_to_album_button_id"
                  type="button"
                  onClick={() => setIsAddToAlbumOpen(true)}
                  className="w-full py-2.5 px-3 rounded-xl border border-border/80 bg-muted/30 text-foreground text-xs font-semibold hover:bg-muted flex items-center justify-center gap-2 transition-colors shadow-xs"
                >
                  <FolderPlus size={14} />
                  <span>{t('btnAddToAlbum' as any) || 'Добавить в альбом'}</span>
                </button>

                {/* Run AI Analysis button */}
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
    </>
  );
}
