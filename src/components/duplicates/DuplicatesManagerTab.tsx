import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  DuplicateGroup,
  DuplicateItemInfo,
  DuplicateSummary,
  DuplicateScanStatus,
  DuplicateConfig,
} from '../../models/media';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../services/authContext';
import { mediaCacheService } from '../../services/mediaCacheService';
import LibraryOrganizationPanel from './LibraryOrganizationPanel';
import DuplicateDetectionRules from './DuplicateDetectionRules';
import FolderAnalysisPanel from './FolderAnalysisPanel';
import {
  ChevronDown,
  FolderCog,
  CopyCheck,
  Layers,
  Files,
  HardDrive,
  Zap,
  CheckCheck,
  XCircle,
  Sparkles,
} from 'lucide-react';
import './DuplicatesManagerTab.css';

export interface DuplicatesManagerTabProps {
  onRefreshMedia?: () => void;
  activeInputFolders?: string[];
  onOpenViewer?: (filePath: string) => void;
}

export default function DuplicatesManagerTab({
  onRefreshMedia,
  activeInputFolders = [],
  onOpenViewer,
}: DuplicatesManagerTabProps) {
  const { t } = useLanguage();
  const { authFetch } = useAuth();

  // Data state
  const [summary, setSummary] = useState<DuplicateSummary | null>(null);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [scanStatus, setScanStatus] = useState<DuplicateScanStatus | null>(null);
  const [, setConfig] = useState<DuplicateConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const prevIsScanningRef = useRef(false);
  const GROUPS_PER_PAGE = 25;

  // Scan settings state
  const [selectedEngine, setSelectedEngine] = useState<'auto' | 'cpu' | 'gpu'>('auto');
  const [selectedMode, setSelectedMode] = useState<'all' | 'exact' | 'visual' | 'burst'>('all');
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.85);
  const [burstWindowSec, setBurstWindowSec] = useState<number>(3.0);
  const [selectedFolderScope, setSelectedFolderScope] = useState<string>('all');
  const [forceRehash, setForceRehash] = useState(false);
  const [hasUserEditedConfig, setHasUserEditedConfig] = useState(false);

  // Selection state for batch actions (File paths selected for cleanup)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // Modal states
  const [comparatorGroup, setComparatorGroup] = useState<{
    primary: DuplicateItemInfo;
    duplicate: DuplicateItemInfo;
  } | null>(null);

  const [previewItem, setPreviewItem] = useState<{
    item: DuplicateItemInfo;
    isPrimary?: boolean;
    primaryFile?: DuplicateItemInfo;
  } | null>(null);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [targetMoveFolder, setTargetMoveFolder] = useState('');
  const [isActionPending, setIsActionPending] = useState(false);

  // Accordion sections state
  const [isOrganizeOpen, setIsOrganizeOpen] = useState(true);
  const [isDuplicatesOpen, setIsDuplicatesOpen] = useState(true);
  const [utilitiesSubTab, setUtilitiesSubTab] = useState<'duplicates' | 'analysis'>('duplicates');

  // Unmark a file as duplicate
  const handleUnmarkDuplicate = async (filePath: string) => {
    try {
      const res = await authFetch('/api/duplicates/unmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath }),
      });
      if (res.ok) {
        loadData();
        mediaCacheService.clearCache();
        if (onRefreshMedia) onRefreshMedia();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to unmark duplicate');
      }
    } catch (e: any) {
      alert(`Error unmarking duplicate: ${e.message}`);
    }
  };

  // Fetch groups & summary
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [resGroups, resSum, resConfig] = await Promise.all([
        fetch('/api/duplicates/groups'),
        fetch('/api/duplicates/summary'),
        fetch('/api/duplicates/config'),
      ]);

      if (resGroups.ok) {
        const data = await resGroups.json();
        setGroups(data);
        setCurrentPage(1);
      }
      if (resSum.ok) {
        const data = await resSum.json();
        setSummary(data);
      }
      if (resConfig.ok) {
        const data = await resConfig.json();
        setConfig(data);
        if (!hasUserEditedConfig) {
          if (data.default_engine) setSelectedEngine(data.default_engine);
          if (data.similarity_threshold) setSimilarityThreshold(data.similarity_threshold);
          if (data.burst_window_seconds) setBurstWindowSec(data.burst_window_seconds);
          if (data.target_move_folder) setTargetMoveFolder(data.target_move_folder);
        }
      }
    } catch (err) {
      console.error('Error loading duplicates data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll scan status
  useEffect(() => {
    let timer: any;
    let isCancelled = false;

    const checkStatus = async () => {
      try {
        const res = await fetch('/api/duplicates/scan-status');
        if (res.ok && !isCancelled) {
          const st: DuplicateScanStatus = await res.json();
          setScanStatus(st);
          if (st.isScanning) {
            prevIsScanningRef.current = true;
            timer = setTimeout(checkStatus, 1000);
          } else {
            if (prevIsScanningRef.current) {
              prevIsScanningRef.current = false;
              // Just finished scanning -> refresh groups and update media gallery
              loadData();
              onRefreshMedia?.();
            }
          }
        }
      } catch {
        // ignore polling errors
      }
    };

    checkStatus();
    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [loadData, onRefreshMedia]);

  // Keyboard listener for Escape to close modals
  useEffect(() => {
    if (!previewItem && !comparatorGroup && !isDeleteConfirmOpen && !isMoveModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewItem(null);
        setComparatorGroup(null);
        setIsDeleteConfirmOpen(false);
        setIsMoveModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewItem, comparatorGroup, isDeleteConfirmOpen, isMoveModalOpen]);

  // Trigger scan
  const handleStartScan = async () => {
    try {
      setHasUserEditedConfig(true);
      const folders = selectedFolderScope !== 'all' ? [selectedFolderScope] : undefined;
      try {
        await authFetch('/api/duplicates/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            default_engine: selectedEngine,
            similarity_threshold: similarityThreshold,
            burst_window_seconds: burstWindowSec,
          }),
        });
      } catch {}
      const res = await authFetch('/api/duplicates/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine: selectedEngine,
          mode: selectedMode,
          similarity_threshold: similarityThreshold,
          burst_window_seconds: burstWindowSec,
          folders,
          force_rehash: forceRehash,
        }),
      });

      if (res.ok) {
        const st = await res.json();
        setScanStatus(st);
        prevIsScanningRef.current = true;
      } else {
        const err = await res.json();
        alert(`Error: ${err.message || 'Failed to start duplicate scan'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

  // Stop scan
  const handleStopScan = async () => {
    try {
      await authFetch('/api/duplicates/stop-scan', { method: 'POST' });
    } catch (err) {
      console.error('Failed to stop scan:', err);
    }
  };

  // Toggle individual file selection
  const handleToggleSelectFile = (filePath: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  // Smart Selection: Select All Non-Primary Duplicates
  const handleSelectAllDuplicates = () => {
    const allDups = new Set<string>();
    filteredGroups.forEach((g) => {
      g.duplicates.forEach((d) => {
        allDups.add(d.filePath);
      });
    });
    setSelectedFiles(allDups);
  };

  const handleDeselectAll = () => {
    setSelectedFiles(new Set());
  };

  // Execute Deletion
  const handleConfirmDelete = async () => {
    if (selectedFiles.size === 0) return;
    setIsActionPending(true);

    try {
      const res = await authFetch('/api/duplicates/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: Array.from(selectedFiles) }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.deletedFiles && Array.isArray(data.deletedFiles)) {
          await mediaCacheService.removeFiles(data.deletedFiles);
        }
        alert(t('duplicatesDeleteSuccess' as any) || `Successfully deleted ${data.deletedCount} duplicate file(s).`);
        setSelectedFiles(new Set());
        setIsDeleteConfirmOpen(false);
        await loadData();
        onRefreshMedia?.();
      } else {
        const err = await res.json();
        alert(`Deletion error: ${err.message || 'Failed to delete files'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  // Execute Move
  const handleConfirmMove = async () => {
    if (selectedFiles.size === 0 || !targetMoveFolder.trim()) return;
    setIsActionPending(true);

    try {
      const res = await authFetch('/api/duplicates/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: Array.from(selectedFiles),
          destination_folder: targetMoveFolder.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.movedFiles && Array.isArray(data.movedFiles)) {
          const originalPaths = data.movedFiles.map((m: any) => m.original);
          await mediaCacheService.removeFiles(originalPaths);
        }
        alert(t('duplicatesMoveSuccess' as any) || `Successfully moved ${data.movedCount} duplicate file(s).`);
        setSelectedFiles(new Set());
        setIsMoveModalOpen(false);
        await loadData();
        onRefreshMedia?.();
      } else {
        const err = await res.json();
        alert(`Move error: ${err.message || 'Failed to move files'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  // Compute selected bytes
  const selectedBytesTotal = useMemo(() => {
    let total = 0;
    groups.forEach((g) => {
      g.duplicates.forEach((d) => {
        if (selectedFiles.has(d.filePath)) {
          total += d.fileSize;
        }
      });
      if (selectedFiles.has(g.primaryFile.filePath)) {
        total += g.primaryFile.fileSize;
      }
    });
    return total;
  }, [groups, selectedFiles]);

  // Filter groups in real time based on active user controls (mode, similarity threshold, and folder)
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (selectedMode !== 'all' && g.matchType !== selectedMode) {
        return false;
      }
      if (g.matchType === 'visual' && g.similarity < similarityThreshold) {
        return false;
      }
      if (selectedFolderScope !== 'all') {
        const scopeLower = selectedFolderScope.toLowerCase();
        const inPrimary = g.primaryFile?.folder?.toLowerCase().includes(scopeLower);
        const inDups = g.duplicates?.some((d) => d.folder?.toLowerCase().includes(scopeLower));
        if (!inPrimary && !inDups) return false;
      }
      return true;
    });
  }, [groups, selectedMode, similarityThreshold, selectedFolderScope]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMode, similarityThreshold, selectedFolderScope]);

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / GROUPS_PER_PAGE));
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * GROUPS_PER_PAGE;
    return filteredGroups.slice(start, start + GROUPS_PER_PAGE);
  }, [filteredGroups, currentPage]);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isScanning = Boolean(scanStatus?.isScanning);

  return (
    <div className="duplicates-manager-container space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in duration-300">
      {/* Utilities Hub Subtab Navigation */}
      <div className="flex items-center gap-2.5 pb-2 border-b border-border/80 flex-wrap">
        <button
          type="button"
          onClick={() => setUtilitiesSubTab('duplicates')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
            utilitiesSubTab === 'duplicates'
              ? 'bg-primary text-white border-primary shadow-xs'
              : 'bg-card text-muted-foreground border-border/70 hover:bg-muted hover:text-foreground'
          }`}
          id="btn-subtab-duplicates"
        >
          <CopyCheck size={15} />
          <span>{t('sectionDuplicatesManager' as any) || 'Поиск дубликатов'}</span>
        </button>

        <button
          type="button"
          onClick={() => setUtilitiesSubTab('analysis')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
            utilitiesSubTab === 'analysis'
              ? 'bg-primary text-white border-primary shadow-xs'
              : 'bg-card text-muted-foreground border-border/70 hover:bg-muted hover:text-foreground'
          }`}
          id="btn-subtab-analysis"
        >
          <Sparkles size={15} />
          <span>{t('sectionMediaAnalysis' as any) || 'Анализ медиа'}</span>
        </button>
      </div>

      {utilitiesSubTab === 'analysis' ? (
        <FolderAnalysisPanel configuredFolders={activeInputFolders} onRefreshMedia={onRefreshMedia} />
      ) : (
        <>
          {/* Collapsible Section 1: Media Library Organization */}
          <div className="organize-accordion-section bg-card border border-border/70 rounded-2xl shadow-xs overflow-hidden transition-all duration-200">
        <div
          className="organize-accordion-header flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-muted/40 transition-colors select-none"
          onClick={() => setIsOrganizeOpen((prev) => !prev)}
        >
          <div className="organize-accordion-title flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <FolderCog className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {t('sectionLibraryOrganize' as any) || 'Организация медиатеки'}
              </h2>
              <p className="text-xs text-muted-foreground font-normal">
                Структурирование файлов по папкам, датам и событиям
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span>{isOrganizeOpen ? 'Свернуть' : 'Развернуть'}</span>
            <ChevronDown
              size={18}
              className={`transition-transform duration-200 ${isOrganizeOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </div>

        {isOrganizeOpen && (
          <div className="organize-accordion-content p-5 border-t border-border/60">
            <LibraryOrganizationPanel onRefreshMedia={onRefreshMedia} />
          </div>
        )}
      </div>

      {/* Collapsible Section 2: Duplicates & Cleanup */}
      <div className="organize-accordion-section bg-card border border-border/70 rounded-2xl shadow-xs overflow-hidden transition-all duration-200">
        <div
          className="organize-accordion-header flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-muted/40 transition-colors select-none"
          onClick={() => setIsDuplicatesOpen((prev) => !prev)}
        >
          <div className="organize-accordion-title flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#23a6f0]/10 text-[#23a6f0] shrink-0">
              <CopyCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {t('sectionDuplicatesManager' as any) || 'Поиск и управление дубликатами'}
              </h2>
              <p className="text-xs text-muted-foreground font-normal">
                Поиск полных копий, визуально похожих фото и серийной съемки
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span>{isDuplicatesOpen ? 'Свернуть' : 'Развернуть'}</span>
            <ChevronDown
              size={18}
              className={`transition-transform duration-200 ${isDuplicatesOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </div>

        {isDuplicatesOpen && (
          <div className="organize-accordion-content p-5 border-t border-border/60 space-y-6">
            {/* Metric Summary Cards */}
            <div className="dup-metrics-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="dup-metric-card p-4 bg-muted/20 border border-border/60 rounded-xl flex items-center gap-3.5 shadow-xs">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="dup-metric-info">
                  <span className="dup-metric-value text-xl font-extrabold text-foreground font-mono">
                    {summary?.totalGroups || groups.length}
                  </span>
                  <span className="dup-metric-label text-xs text-muted-foreground">
                    {t('duplicateGroups' as any) || 'Групп дубликатов'}
                  </span>
                </div>
              </div>

              <div className="dup-metric-card p-4 bg-muted/20 border border-border/60 rounded-xl flex items-center gap-3.5 shadow-xs">
                <div className="p-2.5 rounded-xl bg-[#f3cd03]/10 text-[#f3cd03] shrink-0">
                  <Files className="h-5 w-5" />
                </div>
                <div className="dup-metric-info">
                  <span className="dup-metric-value text-xl font-extrabold text-foreground font-mono">
                    {summary?.totalDuplicateFiles || 0}
                  </span>
                  <span className="dup-metric-label text-xs text-muted-foreground">
                    {t('duplicateCopies' as any) || 'Повторяющихся копий'}
                  </span>
                </div>
              </div>

              <div className="dup-metric-card p-4 bg-muted/20 border border-border/60 rounded-xl flex items-center gap-3.5 shadow-xs">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
                  <HardDrive className="h-5 w-5" />
                </div>
                <div className="dup-metric-info">
                  <span className="dup-metric-value text-xl font-extrabold text-emerald-500 font-mono">
                    {formatBytes(summary?.totalReclaimableBytes || 0)}
                  </span>
                  <span className="dup-metric-label text-xs text-muted-foreground">
                    {t('reclaimableSpace' as any) || 'Освобождаемое место'}
                  </span>
                </div>
              </div>

              <div className="dup-metric-card p-4 bg-muted/20 border border-border/60 rounded-xl flex items-center gap-3.5 shadow-xs">
                <div className="p-2.5 rounded-xl bg-[#23a6f0]/10 text-[#23a6f0] shrink-0">
                  <Zap className="h-5 w-5" />
                </div>
                <div className="dup-metric-info">
                  <span className="dup-metric-value text-base font-extrabold text-foreground font-mono">
                    {summary?.engineUsed === 'gpu' ? 'GPU (RTX 4080)' : 'CPU (Low-Memory Safe)'}
                  </span>
                  <span className="dup-metric-label text-xs text-muted-foreground">
                    {t('duplicateEngine' as any) || 'Режим движка'}
                  </span>
                </div>
              </div>
            </div>

            {/* Control Panel: Detection Rules & Thresholds */}
            <DuplicateDetectionRules
              activeInputFolders={activeInputFolders}
              selectedEngine={selectedEngine}
              setSelectedEngine={setSelectedEngine}
              selectedMode={selectedMode}
              setSelectedMode={setSelectedMode}
              similarityThreshold={similarityThreshold}
              setSimilarityThreshold={setSimilarityThreshold}
              burstWindowSec={burstWindowSec}
              setBurstWindowSec={setBurstWindowSec}
              selectedFolderScope={selectedFolderScope}
              setSelectedFolderScope={setSelectedFolderScope}
              forceRehash={forceRehash}
              setForceRehash={setForceRehash}
              isScanning={Boolean(scanStatus?.isScanning)}
              scanStatus={scanStatus}
              onStartScan={handleStartScan}
              onStopScan={handleStopScan}
            />

            {/* Smart Selection & Action Bar */}
            {groups.length > 0 && (
              <div className="dup-actions-bar flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/20 border border-border/60 rounded-xl">
                <div className="dup-selection-tools flex items-center gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors shadow-xs cursor-pointer"
                    onClick={handleSelectAllDuplicates}
                  >
                    <CheckCheck size={14} className="text-primary" />
                    <span>{t('selectAllDuplicates' as any) || 'Выбрать все дубликаты'}</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                    onClick={handleDeselectAll}
                    disabled={selectedFiles.size === 0}
                  >
                    <XCircle size={14} className="text-muted-foreground" />
                    <span>{t('deselectAll' as any) || 'Снять выбор'}</span>
                  </button>

                  {selectedFiles.size > 0 && (
                    <span className="text-xs font-semibold text-primary ml-2">
                      {t('selectedSummary' as any) || `Выбрано ${selectedFiles.size} дубликатов (${formatBytes(selectedBytesTotal)})`}
                    </span>
                  )}
                </div>

          <div className="dup-action-buttons">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsMoveModalOpen(true)}
              disabled={selectedFiles.size === 0}
            >
              📦 {t('btnMoveDuplicates' as any) || 'Move Selected...'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsDeleteConfirmOpen(true)}
              disabled={selectedFiles.size === 0}
              style={{
                background: selectedFiles.size > 0 ? 'rgba(239, 68, 68, 0.15)' : undefined,
                borderColor: selectedFiles.size > 0 ? '#ef4444' : undefined,
                color: selectedFiles.size > 0 ? '#ef4444' : undefined,
              }}
            >
              🗑️ {t('btnDeleteDuplicates' as any) || 'Delete Selected'}
            </button>
          </div>
        </div>
      )}

      {/* Duplicate Groups List */}
      <div className="dup-groups-list">
        {filteredGroups.length === 0 && !isLoading && !isScanning ? (
          <div
            style={{
              padding: '3rem',
              textAlign: 'center',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '16px',
              border: '1px dashed rgba(255, 255, 255, 0.15)',
              color: '#94a3b8',
            }}
          >
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🎉</span>
            <h3 style={{ color: '#fff', margin: '0 0 0.5rem' }}>
              {t('noDuplicatesFound' as any) || 'No duplicate files detected'}
            </h3>
            <p style={{ margin: 0 }}>
              {t('noDuplicatesHint' as any) || 'Run a duplicate scan above to inspect exact matches, visual similarities, and burst shots across your media libraries.'}
            </p>
          </div>
        ) : (
          paginatedGroups.map((group) => {
            const badgeClass =
              group.matchType === 'exact'
                ? 'dup-badge-exact'
                : group.matchType === 'visual'
                ? 'dup-badge-visual'
                : 'dup-badge-burst';

            const badgeLabel =
              group.matchType === 'exact'
                ? 'Exact Match (100%)'
                : group.matchType === 'visual'
                ? `Visual (${Math.round(group.similarity * 100)}%)`
                : 'Burst Series';

            return (
              <div key={group.id} className="dup-group-card">
                <div className="dup-group-header">
                  <div className="dup-group-badges">
                    <span className={`dup-badge ${badgeClass}`}>{badgeLabel}</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                      {group.totalFiles} items ({formatBytes(group.reclaimableBytes)} reclaimable)
                    </span>
                  </div>

                  {group.duplicates.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() =>
                        setComparatorGroup({
                          primary: group.primaryFile,
                          duplicate: group.duplicates[0],
                        })
                      }
                    >
                      ⚖️ {t('btnCompare' as any) || 'Compare Side-by-Side'}
                    </button>
                  )}
                </div>

                <div className="dup-group-items-grid">
                  {/* Primary Item */}
                  <div
                    className={`dup-item-card is-primary ${selectedFiles.has(group.primaryFile.filePath) ? 'is-selected' : ''}`}
                    onClick={() => handleToggleSelectFile(group.primaryFile.filePath)}
                  >
                    <div className="dup-item-preview-wrap">
                      <input
                        type="checkbox"
                        className="dup-item-checkbox"
                        checked={selectedFiles.has(group.primaryFile.filePath)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => handleToggleSelectFile(group.primaryFile.filePath)}
                      />
                      <span className="dup-item-primary-tag">
                        🌟 {t('keepPrimary' as any) || 'KEEP'}
                      </span>
                      {group.primaryFile.isVideo && (
                        <span className="dup-item-video-tag" title="Video file">
                          🎥
                        </span>
                      )}
                      <img
                        className="dup-item-img"
                        src={`/api/media/thumbnail?path=${encodeURIComponent(group.primaryFile.filePath)}&size=300`}
                        alt={group.primaryFile.filename}
                        loading="lazy"
                      />
                      <button
                        type="button"
                        className="dup-item-zoom-btn"
                        title={t('previewImage' as any) || 'Full Preview'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewItem({ item: group.primaryFile, isPrimary: true });
                        }}
                      >
                        🔍
                      </button>
                    </div>

                    <div className="dup-item-details">
                      <div className="dup-item-filename" title={group.primaryFile.filename}>
                        {group.primaryFile.filename}
                      </div>
                      <div className="dup-item-meta-row">
                        <span>Resolution</span>
                        <strong>
                          {group.primaryFile.width && group.primaryFile.height
                            ? `${group.primaryFile.width}x${group.primaryFile.height} (${group.primaryFile.megapixels} MP)`
                            : 'Unknown'}
                        </strong>
                      </div>
                      <div className="dup-item-meta-row">
                        <span>Size</span>
                        <strong>{formatBytes(group.primaryFile.fileSize)}</strong>
                      </div>
                      <div className="dup-item-meta-row">
                        <span>Folder</span>
                        <strong title={group.primaryFile.folder}>{group.primaryFile.folder.split(/[/\\]/).pop()}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Duplicate Items */}
                  {group.duplicates.map((dup) => {
                    const isSelected = selectedFiles.has(dup.filePath);
                    return (
                      <div
                        key={dup.filePath}
                        className={`dup-item-card ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => handleToggleSelectFile(dup.filePath)}
                      >
                        <div className="dup-item-preview-wrap">
                          <input
                            type="checkbox"
                            className="dup-item-checkbox"
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => handleToggleSelectFile(dup.filePath)}
                          />
                          {dup.isVideo && (
                            <span className="dup-item-video-tag" title="Video file">
                              🎥
                            </span>
                          )}
                          <img
                            className="dup-item-img"
                            src={`/api/media/thumbnail?path=${encodeURIComponent(dup.filePath)}&size=300`}
                            alt={dup.filename}
                            loading="lazy"
                          />
                          <button
                            type="button"
                            className="dup-item-zoom-btn"
                            title={t('previewImage' as any) || 'Full Preview'}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewItem({
                                item: dup,
                                isPrimary: false,
                                primaryFile: group.primaryFile,
                              });
                            }}
                          >
                            🔍
                          </button>
                        </div>

                        <div className="dup-item-details">
                          <div className="dup-item-filename" title={dup.filename}>
                            {dup.filename}
                          </div>
                          <div className="dup-item-meta-row">
                            <span>Resolution</span>
                            <strong>
                              {dup.width && dup.height
                                ? `${dup.width}x${dup.height} (${dup.megapixels} MP)`
                                : 'Unknown'}
                            </strong>
                          </div>
                          <div className="dup-item-meta-row">
                            <span>Size</span>
                            <strong>{formatBytes(dup.fileSize)}</strong>
                          </div>
                          <div className="dup-item-meta-row">
                            <span>Similarity</span>
                            <strong style={{ color: '#c084fc' }}>
                              {dup.similarityToPrimary ? `${Math.round(dup.similarityToPrimary * 100)}%` : 'Duplicate'}
                            </strong>
                          </div>

                          <button
                            type="button"
                            className="mt-2 w-full py-1.5 px-2 text-[11px] font-semibold rounded-lg border border-border/80 bg-muted/40 hover:bg-muted text-foreground transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            title="Исключить из дубликатов и запланировать индивидуальный анализ"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnmarkDuplicate(dup.filePath);
                            }}
                          >
                            <span>Это не дубликат</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1rem',
            margin: '1.5rem 0',
            padding: '0.75rem',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{ fontSize: '0.85rem' }}
          >
            ◀ {t('btnPrevPage' as any) || 'Previous'}
          </button>
          <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>
            Page {currentPage} of {totalPages} ({groups.length} {t('duplicateGroups' as any) || 'groups'})
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{ fontSize: '0.85rem' }}
          >
            {t('btnNextPage' as any) || 'Next'} ▶
          </button>
        </div>
      )}
          </div>
        )}
      </div>
        </>
      )}

      {/* Single Item Full Preview Lightbox Modal */}
      {previewItem && (
        <div className="dup-comparator-modal" onClick={() => setPreviewItem(null)}>
          <div
            className="dup-comparator-container"
            style={{ maxWidth: '850px', width: '92vw', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dup-comparator-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <span style={{ fontSize: '1.2rem' }}>🖼️</span>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {previewItem.item.filename}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    {previewItem.isPrimary ? '🌟 Recommended Primary File' : 'Duplicate Candidate'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setPreviewItem(null)}
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>

            <div className="dup-preview-modal-body">
              <div className="dup-preview-img-wrap">
                {previewItem.item.isVideo ? (
                  <video
                    className="dup-preview-modal-video"
                    src={`/api/media/file?path=${encodeURIComponent(previewItem.item.filePath)}`}
                    poster={`/api/media/thumbnail?path=${encodeURIComponent(previewItem.item.filePath)}&size=1080`}
                    controls
                    autoPlay
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    className="dup-preview-modal-img"
                    src={
                      /\.(heic|heif)$/i.test(previewItem.item.filePath)
                        ? `/api/media/thumbnail?path=${encodeURIComponent(previewItem.item.filePath)}&size=1920`
                        : `/api/media/file?path=${encodeURIComponent(previewItem.item.filePath)}`
                    }
                    alt={previewItem.item.filename}
                  />
                )}
              </div>

              <div className="dup-preview-meta-panel">
                <table className="dup-comparator-meta-table">
                  <tbody>
                    <tr>
                      <td>Resolution</td>
                      <td>
                        {previewItem.item.width && previewItem.item.height
                          ? `${previewItem.item.width}x${previewItem.item.height} (${previewItem.item.megapixels} MP)`
                          : 'Unknown'}
                      </td>
                    </tr>
                    <tr>
                      <td>File Size</td>
                      <td>{formatBytes(previewItem.item.fileSize)}</td>
                    </tr>
                    <tr>
                      <td>Folder</td>
                      <td>{previewItem.item.folder}</td>
                    </tr>
                    {previewItem.item.similarityToPrimary !== undefined && (
                      <tr>
                        <td>Similarity</td>
                        <td style={{ color: '#c084fc' }}>
                          {Math.round(previewItem.item.similarityToPrimary * 100)}%
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="dup-preview-modal-actions">
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={`btn ${selectedFiles.has(previewItem.item.filePath) ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => handleToggleSelectFile(previewItem.item.filePath)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: selectedFiles.has(previewItem.item.filePath) ? '#ef4444' : undefined,
                        borderColor: selectedFiles.has(previewItem.item.filePath) ? '#ef4444' : undefined,
                        color: '#fff',
                      }}
                    >
                      {selectedFiles.has(previewItem.item.filePath) ? '☑️ Marked for Deletion' : '☐ Mark for Deletion'}
                    </button>

                    {!previewItem.isPrimary && previewItem.primaryFile && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          const prim = previewItem.primaryFile!;
                          const dup = previewItem.item;
                          setPreviewItem(null);
                          setComparatorGroup({ primary: prim, duplicate: dup });
                        }}
                      >
                        ⚖️ Compare Side-by-Side
                      </button>
                    )}
                  </div>

                  {onOpenViewer && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        onOpenViewer(previewItem.item.filePath);
                        setPreviewItem(null);
                      }}
                      title="View file in Media Gallery"
                    >
                      ↗️ Open in Gallery
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Visual Comparator Modal */}
      {comparatorGroup && (
        <div className="dup-comparator-modal" onClick={() => setComparatorGroup(null)}>
          <div className="dup-comparator-container" onClick={(e) => e.stopPropagation()}>
            <div className="dup-comparator-header">
              <h3 style={{ margin: 0, color: '#fff' }}>
                ⚖️ {t('visualComparator' as any) || 'Side-by-Side Duplicate Comparator'}
              </h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setComparatorGroup(null)}
              >
                ✕
              </button>
            </div>

            <div className="dup-comparator-body">
              {/* Primary Item Pane */}
              <div className="dup-comparator-pane">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="dup-badge dup-badge-exact">🌟 Recommended Primary (Keep)</span>
                  <span style={{ fontWeight: 600, color: '#fff' }}>{comparatorGroup.primary.filename}</span>
                </div>
                {comparatorGroup.primary.isVideo ? (
                  <video
                    className="dup-comparator-preview"
                    src={`/api/media/file?path=${encodeURIComponent(comparatorGroup.primary.filePath)}`}
                    poster={`/api/media/thumbnail?path=${encodeURIComponent(comparatorGroup.primary.filePath)}&size=720`}
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    className="dup-comparator-preview"
                    src={
                      /\.(heic|heif)$/i.test(comparatorGroup.primary.filePath)
                        ? `/api/media/thumbnail?path=${encodeURIComponent(comparatorGroup.primary.filePath)}&size=1080`
                        : `/api/media/file?path=${encodeURIComponent(comparatorGroup.primary.filePath)}`
                    }
                    alt="Primary"
                  />
                )}
                <table className="dup-comparator-meta-table">
                  <tbody>
                    <tr>
                      <td>Resolution</td>
                      <td>{comparatorGroup.primary.width}x{comparatorGroup.primary.height} ({comparatorGroup.primary.megapixels} MP)</td>
                    </tr>
                    <tr>
                      <td>File Size</td>
                      <td>{formatBytes(comparatorGroup.primary.fileSize)}</td>
                    </tr>
                    <tr>
                      <td>Folder</td>
                      <td>{comparatorGroup.primary.folder}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Duplicate Item Pane */}
              <div className="dup-comparator-pane">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="dup-badge dup-badge-burst">Duplicate Candidate</span>
                  <span style={{ fontWeight: 600, color: '#fff' }}>{comparatorGroup.duplicate.filename}</span>
                </div>
                {comparatorGroup.duplicate.isVideo ? (
                  <video
                    className="dup-comparator-preview"
                    src={`/api/media/file?path=${encodeURIComponent(comparatorGroup.duplicate.filePath)}`}
                    poster={`/api/media/thumbnail?path=${encodeURIComponent(comparatorGroup.duplicate.filePath)}&size=720`}
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    className="dup-comparator-preview"
                    src={
                      /\.(heic|heif)$/i.test(comparatorGroup.duplicate.filePath)
                        ? `/api/media/thumbnail?path=${encodeURIComponent(comparatorGroup.duplicate.filePath)}&size=1080`
                        : `/api/media/file?path=${encodeURIComponent(comparatorGroup.duplicate.filePath)}`
                    }
                    alt="Duplicate"
                  />
                )}
                <table className="dup-comparator-meta-table">
                  <tbody>
                    <tr>
                      <td>Resolution</td>
                      <td>{comparatorGroup.duplicate.width}x{comparatorGroup.duplicate.height} ({comparatorGroup.duplicate.megapixels} MP)</td>
                    </tr>
                    <tr>
                      <td>File Size</td>
                      <td>{formatBytes(comparatorGroup.duplicate.fileSize)}</td>
                    </tr>
                    <tr>
                      <td>Folder</td>
                      <td>{comparatorGroup.duplicate.folder}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <div className="dup-comparator-modal" onClick={() => setIsDeleteConfirmOpen(false)}>
          <div
            className="dup-comparator-container"
            style={{ maxWidth: '540px', margin: 'auto', height: 'auto', padding: '1.75rem', gap: '1.25rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span>⚠️</span>
              <span>{t('confirmDeletionTitle' as any) || 'Confirm Duplicate Deletion'}</span>
            </h3>

            <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.5 }}>
              {t('confirmDeletionPrompt' as any) || `You are about to permanently delete ${selectedFiles.size} duplicate file(s), freeing ${formatBytes(selectedBytesTotal)} of storage space. This action cannot be undone.`}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={isActionPending}
              >
                {t('btnCancel' as any) || 'Cancel'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#ef4444', borderColor: '#ef4444' }}
                onClick={handleConfirmDelete}
                disabled={isActionPending}
              >
                {isActionPending ? 'Deleting...' : (t('btnConfirmDelete' as any) || 'Delete Files Permanently')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Confirmation Modal */}
      {isMoveModalOpen && (
        <div className="dup-comparator-modal" onClick={() => setIsMoveModalOpen(false)}>
          <div
            className="dup-comparator-container"
            style={{ maxWidth: '540px', margin: 'auto', height: 'auto', padding: '1.75rem', gap: '1.25rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span>📦</span>
              <span>{t('moveDuplicatesTitle' as any) || 'Move Duplicates to Archive'}</span>
            </h3>

            <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.5 }}>
              {t('moveDuplicatesPrompt' as any) || `Select target destination directory to archive ${selectedFiles.size} duplicate file(s).`}
            </p>

            <div className="dup-form-group">
              <label>{t('destinationFolder' as any) || 'Destination Folder'}</label>
              <input
                type="text"
                className="dup-form-input"
                placeholder="e.g. Z:\duplicates_archive"
                value={targetMoveFolder}
                onChange={(e) => setTargetMoveFolder(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsMoveModalOpen(false)}
                disabled={isActionPending}
              >
                {t('btnCancel' as any) || 'Cancel'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmMove}
                disabled={isActionPending || !targetMoveFolder.trim()}
              >
                {isActionPending ? 'Moving...' : (t('btnConfirmMove' as any) || 'Move Files')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
