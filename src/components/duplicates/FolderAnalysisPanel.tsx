import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Folder,
  Sparkles,
  RefreshCw,
  Pause,
  Play,
  StopCircle,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Layers,
  FileText,
  UserCheck,
  CopyCheck,
  Mic,
  Eye,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useAuth } from '../../services/authContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { mediaCacheService } from '../../services/mediaCacheService';

interface FolderAnalysisPanelProps {
  configuredFolders?: string[];
  onRefreshMedia?: () => void;
}

interface AnalysisCategoryItem {
  id: string;
  icon: any;
  labelKey: string;
  descKey: string;
  defaultLabel: string;
  defaultDesc: string;
}

const ANALYSIS_CATEGORIES: AnalysisCategoryItem[] = [
  {
    id: 'vision',
    icon: Eye,
    labelKey: 'categoryVision',
    descKey: 'categoryVisionDesc',
    defaultLabel: 'Метаданные и AI-описание',
    defaultDesc: 'Извлечение EXIF, теги, категории и визуальное AI-описание',
  },
  {
    id: 'faces',
    icon: UserCheck,
    labelKey: 'categoryFaces',
    descKey: 'categoryFacesDesc',
    defaultLabel: 'Поиск и распознавание лиц',
    defaultDesc: 'Детекция лиц, эмбеддинги и кластеризация персон',
  },
  {
    id: 'duplicates',
    icon: CopyCheck,
    labelKey: 'categoryDuplicates',
    descKey: 'categoryDuplicatesDesc',
    defaultLabel: 'Поиск дубликатов и похожих',
    defaultDesc: 'Перцептивные хеши (pHash) и группировка похожих кадров',
  },
  {
    id: 'transcribe',
    icon: Mic,
    labelKey: 'categoryTranscribe',
    descKey: 'categoryTranscribeDesc',
    defaultLabel: 'Транскрибация аудио и видео',
    defaultDesc: 'Распознавание речи через Whisper для видеофайлов',
  },
];

export default function FolderAnalysisPanel({
  configuredFolders = [],
  onRefreshMedia,
}: FolderAnalysisPanelProps) {
  const { authFetch } = useAuth();
  const { t, language } = useLanguage();
  const isRu = language === 'ru';

  const [availableFolders, setAvailableFolders] = useState<string[]>(configuredFolders);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set(configuredFolders));
  
  // Analysis categories / modes - all selected by default per user specification
  const [selectedModes, setSelectedModes] = useState<Set<string>>(
    new Set(['vision', 'faces', 'duplicates', 'transcribe'])
  );

  const [pipelineStatus, setPipelineStatus] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Load configured input folders and distinct cached subdirectories
  useEffect(() => {
    let combined = new Set<string>();

    if (configuredFolders.length > 0) {
      configuredFolders.forEach((f) => combined.add(f));
    }

    // Check media cache for distinct indexed folders/subfolders
    try {
      const cached = mediaCacheService.getAll();
      for (const item of cached) {
        if (item.folder) combined.add(item.folder);
      }
    } catch {
      // cache read optional
    }

    if (combined.size > 0) {
      const arr = Array.from(combined);
      setAvailableFolders(arr);
      setSelectedFolders(new Set(arr));
    } else {
      authFetch('/api/settings')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.input_folders) && data.input_folders.length > 0) {
            setAvailableFolders(data.input_folders);
            setSelectedFolders(new Set(data.input_folders));
          }
        })
        .catch(() => {});
    }
  }, [configuredFolders, authFetch]);

  // Poll status from /api/status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await authFetch('/api/status');
      if (res.ok) {
        const st = await res.json();
        setPipelineStatus(st);
        setIsExecuting(st.status === 'running' || st.status === 'paused');
      }
    } catch {
      // ignore transient polling errors
    }
  }, [authFetch]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Folder toggling
  const handleToggleFolder = (folder: string) => {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  };

  const handleSelectAllFolders = () => {
    setSelectedFolders(new Set(availableFolders));
  };

  const handleDeselectAllFolders = () => {
    setSelectedFolders(new Set());
  };

  // Category / Mode toggling
  const handleToggleMode = (modeId: string) => {
    setSelectedModes((prev) => {
      const next = new Set(prev);
      if (next.has(modeId)) {
        next.delete(modeId);
      } else {
        next.add(modeId);
      }
      return next;
    });
  };

  const handleSelectAllModes = () => {
    setSelectedModes(new Set(ANALYSIS_CATEGORIES.map((c) => c.id)));
  };

  const handleDeselectAllModes = () => {
    setSelectedModes(new Set());
  };

  // Trigger analysis execution
  const handleTriggerAnalysis = async (force: boolean) => {
    if (selectedFolders.size === 0) {
      setFeedback({
        type: 'error',
        message: t('atLeastOneFolder' as any) || (isRu
          ? 'Пожалуйста, выберите хотя бы одну папку для анализа'
          : 'Please select at least one folder for analysis'),
      });
      return;
    }

    if (selectedModes.size === 0) {
      setFeedback({
        type: 'error',
        message: t('atLeastOneCategory' as any) || (isRu
          ? 'Пожалуйста, выберите хотя бы одну категорию анализа'
          : 'Please select at least one analysis category'),
      });
      return;
    }

    setIsExecuting(true);
    setFeedback({
      type: 'info',
      message: isRu ? 'Запуск конвейера анализа...' : 'Starting analysis pipeline...',
    });

    try {
      const targetFoldersArray = Array.from(selectedFolders);
      const targetModesArray = Array.from(selectedModes);
      const modesQuery = `&modes=${encodeURIComponent(targetModesArray.join(','))}`;

      const res = await authFetch(`/api/run?force=${force}${modesQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          force,
          folders: targetFoldersArray,
          folder_paths: targetFoldersArray,
          modes: targetModesArray,
          incremental: !force,
          only_unprocessed: !force,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const count = targetFoldersArray.length;
        const modesCount = targetModesArray.length;
        setFeedback({
          type: 'success',
          message: data.message || (isRu
            ? (force
              ? `Запущен полный переанализ в ${count} папках (${modesCount} видов обработки). Обработка выполняется в фоне.`
              : `Запущен анализ файлов без метаданных в ${count} папках (${modesCount} видов обработки).`)
            : (force
              ? `Full re-analysis started across ${count} folder(s) (${modesCount} mode(s)) in background.`
              : `Selective analysis of unanalyzed files started across ${count} folder(s) (${modesCount} mode(s)).`)),
        });
        fetchStatus();
      } else {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setIsExecuting(true);
          setFeedback({
            type: 'info',
            message: isRu ? 'Анализ уже выполняется в фоне' : 'Analysis is already running in background',
          });
        } else {
          setIsExecuting(false);
          setFeedback({
            type: 'error',
            message: err.message || (isRu ? 'Ошибка при запуске анализа' : 'Failed to start analysis'),
          });
        }
      }
    } catch (e: any) {
      setIsExecuting(false);
      setFeedback({
        type: 'error',
        message: e.message || 'Network error',
      });
    }
  };

  const handlePauseResume = async () => {
    const isPaused = pipelineStatus?.status === 'paused';
    try {
      const endpoint = isPaused ? '/api/resume' : '/api/pause';
      const res = await authFetch(endpoint, { method: 'POST' });
      if (res.ok) {
        fetchStatus();
        setFeedback({
          type: 'success',
          message: isPaused
            ? (isRu ? 'Анализ возобновлен' : 'Analysis resumed')
            : (isRu ? 'Анализ приостановлен' : 'Analysis paused'),
        });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message });
    }
  };

  const handleStop = async () => {
    try {
      const res = await authFetch('/api/stop', { method: 'POST' });
      if (res.ok) {
        fetchStatus();
        setFeedback({
          type: 'info',
          message: isRu ? 'Конвейер остановлен пользователем' : 'Pipeline stopped by user',
        });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message });
    }
  };

  const handleCleanupMemory = async () => {
    try {
      const res = await authFetch('/api/cleanup', { method: 'POST' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setFeedback({
          type: 'success',
          message: isRu
            ? `Память моделей успешно освобождена (${data.message || 'Очистка завершена'})`
            : 'AI models unloaded and memory reclaimed successfully',
        });
        if (onRefreshMedia) onRefreshMedia();
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({
          type: 'error',
          message: err.message || (isRu ? 'Ошибка при освобождении ресурсов' : 'Failed to release resources'),
        });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message });
    }
  };

  const currentProg = pipelineStatus?.progress || {};
  const percent = currentProg.percent ?? currentProg.percentage ?? 0;
  const current = currentProg.current ?? 0;
  const total = currentProg.total ?? 0;
  const currentFile = pipelineStatus?.current_file || currentProg.current_file || '';
  const stage = currentProg.stage || '';
  const isPaused = pipelineStatus?.status === 'paused';
  const isRunning = pipelineStatus?.status === 'running';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Target Folders Selection Card */}
      <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Folder className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  {t('selectFoldersToAnalyze' as any) || (isRu ? 'Выбор папок для анализа' : 'Target Input Folders')}
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {selectedFolders.size} / {availableFolders.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('selectFoldersDesc' as any) || (isRu
                  ? 'Отметьте папки, в которых необходимо произвести анализ или переанализ файлов'
                  : 'Select specific folders to run incremental analysis or full re-processing')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleSelectAllFolders}
              className="px-2.5 py-1 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted text-foreground transition-colors cursor-pointer"
            >
              {isRu ? 'Выбрать все' : 'Select all'}
            </button>
            <button
              type="button"
              onClick={handleDeselectAllFolders}
              className="px-2.5 py-1 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
            >
              {isRu ? 'Снять выбор' : 'Deselect all'}
            </button>
          </div>
        </div>

        {availableFolders.length === 0 ? (
          <div className="p-4 border border-dashed border-border/70 rounded-xl text-center text-xs text-muted-foreground">
            {isRu
              ? 'Входные папки еще не настроены. Добавьте их в «Настройках»'
              : 'No input folders configured yet. Add folders in Settings.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 max-h-60 overflow-y-auto">
            {availableFolders.map((fld) => {
              const isChecked = selectedFolders.has(fld);
              return (
                <div
                  key={fld}
                  onClick={() => handleToggleFolder(fld)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                    isChecked
                      ? 'bg-primary/10 border-primary/50 text-foreground shadow-2xs'
                      : 'bg-muted/20 border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="rounded text-primary focus:ring-primary h-4 w-4 pointer-events-none"
                  />
                  <span className="text-xs font-mono truncate" title={fld}>
                    {fld}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Analysis Categories & Processing Modes Selection Card */}
      <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  {t('analysisCategories' as any) || (isRu ? 'Категории анализа и виды обработки' : 'Analysis Categories & Processing Modes')}
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                  {selectedModes.size} / {ANALYSIS_CATEGORIES.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('analysisCategoriesDesc' as any) || (isRu
                  ? 'Выберите, какие виды обработки применять (по умолчанию включены все)'
                  : 'Select which processing stages to execute (all enabled by default)')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleSelectAllModes}
              className="px-2.5 py-1 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted text-foreground transition-colors cursor-pointer"
            >
              {isRu ? 'Выбрать все' : 'Select all'}
            </button>
            <button
              type="button"
              onClick={handleDeselectAllModes}
              className="px-2.5 py-1 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
            >
              {isRu ? 'Снять выбор' : 'Deselect all'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {ANALYSIS_CATEGORIES.map((cat) => {
            const isChecked = selectedModes.has(cat.id);
            const Icon = cat.icon;
            const label = t(cat.labelKey as any) || cat.defaultLabel;
            const desc = t(cat.descKey as any) || cat.defaultDesc;

            return (
              <div
                key={cat.id}
                onClick={() => handleToggleMode(cat.id)}
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                  isChecked
                    ? 'bg-indigo-500/10 border-indigo-500/40 text-foreground shadow-2xs'
                    : 'bg-muted/20 border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                }`}
              >
                <div className="mt-0.5">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 pointer-events-none"
                  />
                </div>
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon size={15} className={isChecked ? 'text-indigo-500' : 'text-muted-foreground'} />
                    <span className="text-xs font-bold text-foreground truncate">{label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Analysis Triggers & Resource Management Card */}
      <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#23a6f0]/10 text-[#23a6f0]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {isRu ? 'Режимы запуска анализа' : 'Analysis Execution Modes'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isRu
                ? 'Запустите выборочный или полный анализ для выбранных папок и категорий'
                : 'Execute selective incremental scan or complete force re-processing for chosen folders and categories'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {/* Selective / Incremental Analysis */}
          <button
            type="button"
            onClick={() => handleTriggerAnalysis(false)}
            disabled={isExecuting || selectedFolders.size === 0 || selectedModes.size === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title={isRu ? 'Анализировать только файлы без сформированных метаданных' : 'Analyze only files missing metadata sidecars'}
          >
            <Sparkles size={15} className={isRunning ? 'animate-spin' : ''} />
            <span>{isRu ? 'Анализ файлов без метаданных' : 'Analyze files without metadata'}</span>
          </button>

          {/* Full Re-analysis Overwrite */}
          <button
            type="button"
            onClick={() => handleTriggerAnalysis(true)}
            disabled={isExecuting || selectedFolders.size === 0 || selectedModes.size === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/50 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title={isRu ? 'Принудительно переанализировать все файлы заново, перезаписывая метаданные' : 'Force re-process all files, ignoring and overwriting metadata'}
          >
            <RefreshCw size={15} className={isRunning ? 'animate-spin' : ''} />
            <span>{isRu ? 'Полный переанализ (игнорируя метаданные)' : 'Full re-analysis (overwrite)'}</span>
          </button>

          {/* Memory Reclamation / Cleanup */}
          <button
            type="button"
            onClick={handleCleanupMemory}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-500/50 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title={isRu ? 'Выгрузить модели InsightFace и Whisper из памяти и очистить кэш PyTorch' : 'Unload InsightFace & Whisper models and purge CUDA cache'}
          >
            <Cpu size={15} />
            <span>{isRu ? 'Очистить память моделей' : 'Reclaim model memory'}</span>
          </button>

          {/* Execution Controls if Running/Paused */}
          {isExecuting && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={handlePauseResume}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded-xl text-xs font-semibold hover:bg-amber-500/20 cursor-pointer"
              >
                {isPaused ? <Play size={14} /> : <Pause size={14} />}
                <span>{isPaused ? (isRu ? 'Продолжить' : 'Resume') : (isRu ? 'Приостановить' : 'Pause')}</span>
              </button>
              <button
                type="button"
                onClick={handleStop}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 text-rose-500 border border-rose-500/30 rounded-xl text-xs font-semibold hover:bg-rose-500/20 cursor-pointer"
              >
                <StopCircle size={14} />
                <span>{isRu ? 'Остановить' : 'Stop'}</span>
              </button>
            </div>
          )}
        </div>

        {feedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                : feedback.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                : 'bg-primary/10 border-primary/30 text-primary'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={15} className="shrink-0" />
            ) : (
              <AlertCircle size={15} className="shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* 4. Live Pipeline Status & Progress Monitor */}
      <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-bold text-foreground">
              {isRu ? 'Статус обработки и прогресс' : 'Processing Progress & Queue'}
            </h4>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
              isRunning
                ? 'bg-primary/10 text-primary border-primary/30 animate-pulse'
                : isPaused
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                : 'bg-muted text-muted-foreground border-border/60'
            }`}
          >
            {pipelineStatus?.status?.toUpperCase() || 'IDLE'}
          </span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground font-mono">
            <span>
              {total > 0 ? `${current} / ${total} (${Math.round(percent)}%)` : isRu ? 'Ожидание задач' : 'Idle'}
            </span>
            <span className="truncate max-w-xs">{stage}</span>
          </div>
          <div className="w-full h-2.5 bg-muted/60 rounded-full overflow-hidden border border-border/50">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          </div>
        </div>

        {/* Current file name display */}
        {currentFile && (
          <div className="flex items-center gap-2 p-2.5 bg-muted/30 border border-border/50 rounded-xl text-xs text-foreground font-mono truncate">
            <FileText size={14} className="text-primary shrink-0" />
            <span className="text-muted-foreground">{isRu ? 'Текущий файл:' : 'Current file:'}</span>
            <span className="font-semibold truncate">{currentFile}</span>
          </div>
        )}
      </div>
    </div>
  );
}
