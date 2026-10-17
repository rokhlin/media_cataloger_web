import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, X, Folder, Play, Pause, Square } from 'lucide-react';
import { cn } from '@/utils';
import FolderConfigModal from '../common/FolderConfigModal';
import { useAuth } from '../../services/authContext';
import { useLanguage } from '@/i18n/LanguageContext';

export interface StatusBarProps {
  progress?: number; // 0 - 100
  title?: string;
  detail?: string;
  status?: 'idle' | 'running' | 'completed' | 'error';
  isCollapsible?: boolean;
  onDismiss?: () => void;
  onConfigureFolders?: () => void;
  className?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  progress: propProgress,
  title: propTitle,
  detail: propDetail,
  status: propStatus,
  isCollapsible = true,
  onDismiss,
  onConfigureFolders,
  className,
}) => {
  const { authFetch } = useAuth();
  const { language } = useLanguage();
  const isRu = language === 'ru';
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [isTriggeringScan, setIsTriggeringScan] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  // Live polling state from backend
  const [backendStatus, setBackendStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [liveProgress, setLiveProgress] = useState<number>(0);
  const [liveTitle, setLiveTitle] = useState<string>('Фоновое сканирование медиатеки');
  const [liveDetail, setLiveDetail] = useState<string>('');
  const [configuredFolders, setConfiguredFolders] = useState<string[]>([]);
  const [activeWorkers, setActiveWorkers] = useState<number>(0);
  const [modelsLoaded, setModelsLoaded] = useState<Record<string, boolean>>({});

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        const isRunning = data.status === 'running';
        const isCurrentlyPaused = data.status === 'paused' || data.is_paused === true;
        setIsPaused(isCurrentlyPaused);
        setBackendStatus(isRunning || isCurrentlyPaused ? 'running' : 'idle');

        if (isRunning || isCurrentlyPaused) {
          const percent = data.progress?.percent ?? data.progress?.percentage ?? 0;
          setLiveProgress(percent);
          const currentFile = data.progress?.current_file ? (isRu ? `Файл: ${data.progress.current_file}` : `File: ${data.progress.current_file}`) : '';
          const stage = data.progress?.stage ? `[${data.progress.stage}] ` : '';
          setLiveTitle(
            isCurrentlyPaused
              ? (isRu ? 'Сканирование приостановлено' : 'Scan paused')
              : (isRu ? 'Фоновое сканирование медиатеки' : 'Background media library scan')
          );
          setLiveDetail(
            isCurrentlyPaused
              ? (isRu ? 'Обработка временно приостановлена' : 'Processing temporarily paused')
              : `${stage}${currentFile || (isRu ? 'Обработка медиафайлов и индексация...' : 'Processing media files and indexing...')}`
          );
        } else {
          setLiveProgress(100);
          setLiveTitle(isRu ? 'Медиатека готова к работе' : 'Media library ready');
        }

        if (data.queue) {
          setActiveWorkers(data.queue.active_workers || 0);
        }
        if (data.models_loaded) {
          setModelsLoaded(data.models_loaded);
        }
      }
    } catch {
      // Backend not yet responding
    }
  }, [isRu]);

  const [modelProvider, setModelProvider] = useState<'gemini' | 'local'>('gemini');
  const [activeModelName, setActiveModelName] = useState('Gemini 3.8 Flash');

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.input_folders)) {
          setConfiguredFolders(data.input_folders);
        }
        if (data.model_provider) {
          setModelProvider(data.model_provider);
        }
        if (data.model_provider === 'gemini') {
          setActiveModelName(data.gemini_model || 'Gemini 3.8 Flash');
        } else if (data.local_model_name) {
          setActiveModelName(data.local_model_name);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchSettings();
    const interval = setInterval(fetchStatus, 3000);
    window.addEventListener('ai_settings_updated', fetchSettings);

    const onPipelineStarted = () => {
      setBackendStatus('running');
      setLiveTitle(isRu ? 'Фоновое сканирование медиатеки' : 'Background media library scan');
      setLiveDetail(isRu ? 'Запуск пайплайна сканирования...' : 'Starting scanning pipeline...');
      fetchStatus();
    };
    window.addEventListener('pipeline_started', onPipelineStarted);

    return () => {
      clearInterval(interval);
      window.removeEventListener('ai_settings_updated', fetchSettings);
      window.removeEventListener('pipeline_started', onPipelineStarted);
    };
  }, [fetchStatus, fetchSettings, isRu]);

  const handleStartScan = async () => {
    setIsTriggeringScan(true);
    try {
      const res = await authFetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setBackendStatus('running');
        setLiveTitle(isRu ? 'Фоновое сканирование медиатеки' : 'Background media library scan');
        setLiveDetail(isRu ? 'Запуск пайплайна сканирования...' : 'Starting scanning pipeline...');
        fetchStatus();
      }
    } catch (err) {
      console.error('Failed to trigger scan:', err);
    } finally {
      setIsTriggeringScan(false);
    }
  };

  const handleTogglePause = async () => {
    setIsActionInProgress(true);
    try {
      const endpoint = isPaused ? '/api/resume' : '/api/pause';
      const res = await authFetch(endpoint, { method: 'POST' });
      if (res.ok) {
        setIsPaused(!isPaused);
        fetchStatus();
      }
    } catch (err) {
      console.error('Failed to toggle pause:', err);
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleStopScan = async () => {
    setIsActionInProgress(true);
    try {
      const res = await authFetch('/api/stop', { method: 'POST' });
      if (res.ok) {
        setBackendStatus('idle');
        setIsPaused(false);
        setLiveProgress(0);
        setLiveTitle(isRu ? 'Сканирование отменено' : 'Scan cancelled');
        setLiveDetail(isRu ? 'Процесс сканирования остановлен пользователем' : 'Scan stopped by user');
        fetchStatus();
      }
    } catch (err) {
      console.error('Failed to stop scan:', err);
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleOpenFolderConfig = () => {
    if (onConfigureFolders) {
      onConfigureFolders();
    } else {
      setFolderModalOpen(true);
    }
  };

  if (dismissed) return null;

  // Determine effective status, progress, and messages
  const effectiveStatus = propStatus !== undefined ? propStatus : backendStatus;
  const effectiveProgress = propProgress !== undefined ? propProgress : liveProgress;
  const effectiveTitle = propTitle !== undefined ? propTitle : liveTitle;

  // The idle status badge and folder config button is only relevant when viewing the photo gallery (/ or /photos)
  const isGalleryView = location.pathname === '/' || location.pathname === '/photos';
  if (effectiveStatus === 'idle' && !isGalleryView) {
    return null;
  }

  const effectiveDetail = propDetail !== undefined ? propDetail : (
    effectiveStatus === 'idle'
      ? (configuredFolders.length > 0
          ? (isRu ? `Папки: ${configuredFolders.join(', ')}` : `Folders: ${configuredFolders.join(', ')}`)
          : (isRu ? 'Папки для сканирования не настроены' : 'Folders for scanning are not configured'))
      : liveDetail
  );

  const clampedProgress = Math.min(100, Math.max(0, effectiveProgress));

  return (
    <>
      <aside
        aria-label={isRu ? "Состояние фоновых процессов" : "Background process status"}
        className={cn(
          'w-full border-t bg-card/95 backdrop-blur-md px-4 py-2 transition-all duration-300 text-xs text-foreground shadow-sm',
          className
        )}
      >
        <div className="max-w-7xl mx-auto flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {effectiveStatus === 'running' && (
                <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin shrink-0" aria-hidden="true" />
              )}
              {effectiveStatus === 'completed' && (
                <CheckCircle2 className="h-3.5 w-3.5 text-[#2dc071] shrink-0" aria-hidden="true" />
              )}
              {effectiveStatus === 'idle' && (
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2dc071]" />
                </span>
              )}
              {effectiveStatus === 'error' && (
                <AlertCircle className="h-3.5 w-3.5 text-[#e74040] shrink-0" aria-hidden="true" />
              )}

              <div className="truncate flex items-center gap-2 min-w-0">
                <span className="font-semibold text-foreground shrink-0">{effectiveTitle}</span>
                <span className="text-muted-foreground truncate hidden sm:inline" title={effectiveDetail}>
                  {effectiveDetail}
                </span>
              </div>
            </div>

            {/* Quick Actions & Controls */}
            <div className="flex items-center gap-2 shrink-0">
              {effectiveStatus === 'idle' && (
                <>
                  <button
                    type="button"
                    onClick={handleOpenFolderConfig}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border/60"
                    title={isRu ? "Указать папки на диске для поиска фото и видео" : "Specify folders on disk for photos and videos"}
                  >
                    <Folder size={13} className="text-primary" />
                    <span>{isRu ? 'Настроить папки' : 'Configure folders'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isTriggeringScan}
                    onClick={handleStartScan}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-white shadow-xs transition-colors"
                    title={isRu ? "Запустить сканирование медиафайлов" : "Start scanning media files"}
                  >
                    <Play size={12} className="fill-white" />
                    <span>{isRu ? 'Сканировать' : 'Scan'}</span>
                  </button>
                </>
              )}

              {effectiveStatus === 'running' && (
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-primary text-xs">
                    {clampedProgress}%
                  </span>
                  <button
                    type="button"
                    disabled={isActionInProgress}
                    onClick={handleTogglePause}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border/60 disabled:opacity-50"
                    title={isPaused ? (isRu ? 'Продолжить анализ' : 'Resume analysis') : (isRu ? 'Приостановить анализ' : 'Pause analysis')}
                  >
                    {isPaused ? <Play size={11} className="fill-current text-primary" /> : <Pause size={11} className="text-amber-500" />}
                    <span>{isPaused ? (isRu ? 'Продолжить' : 'Resume') : (isRu ? 'Приостановить' : 'Pause')}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isActionInProgress}
                    onClick={handleStopScan}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors border border-destructive/30 disabled:opacity-50"
                    title={isRu ? 'Отменить сканирование' : 'Cancel scan'}
                  >
                    <Square size={11} className="fill-current text-destructive" />
                    <span>{isRu ? 'Отменить' : 'Cancel'}</span>
                  </button>
                </div>
              )}

              {isCollapsible && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title={expanded ? (isRu ? 'Свернуть детали' : 'Collapse details') : (isRu ? 'Развернуть детали' : 'Expand details')}
                  aria-label={expanded ? (isRu ? 'Свернуть детали' : 'Collapse details') : (isRu ? 'Развернуть детали' : 'Expand details')}
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
              )}

              {onDismiss && (
                <button
                  type="button"
                  onClick={() => {
                    setDismissed(true);
                    onDismiss();
                  }}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title={isRu ? "Скрыть" : "Dismiss"}
                  aria-label={isRu ? "Скрыть строку прогресса" : "Dismiss progress bar"}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Accessible Progress Bar line */}
          <div
            role="progressbar"
            aria-valuenow={clampedProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden"
          >
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300 ease-out',
                effectiveStatus === 'running'
                  ? 'bg-gradient-to-r from-[#23a6f0] to-[#2091f9]'
                  : 'bg-[#2dc071]'
              )}
              style={{ width: `${clampedProgress}%` }}
            />
          </div>

          {/* Expanded detail box */}
          {expanded && (
            <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">{isRu ? 'Потоки обработки:' : 'Worker threads:'}</span>{' '}
                {activeWorkers > 0 ? (isRu ? `${activeWorkers} активных потоков` : `${activeWorkers} active threads`) : (isRu ? 'В режиме ожидания' : 'Idle')}
              </div>
              <div>
                <span className="font-medium text-foreground">{isRu ? 'ИИ Модели:' : 'AI Models:'}</span>{' '}
                {modelProvider === 'gemini' ? (
                  `${activeModelName} ${isRu ? '(Онлайн)' : '(Online)'}`
                ) : (
                  <>
                    {modelsLoaded.vision_llm ? (activeModelName || (isRu ? 'Qwen2.5-VL онлайн' : 'Qwen2.5-VL online')) : (isRu ? 'Загрузка' : 'Loading')}
                    {modelsLoaded.whisper ? (isRu ? ', Whisper готов' : ', Whisper ready') : ''}
                  </>
                )}
              </div>
              <div>
                <span className="font-medium text-foreground">{isRu ? 'Источники:' : 'Sources:'}</span>{' '}
                {configuredFolders.length > 0 ? configuredFolders[0] : (isRu ? 'Не заданы' : 'Not configured')}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Embedded Folder Configuration Modal */}
      <FolderConfigModal
        isOpen={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
        onScanStarted={() => {
          setBackendStatus('running');
          fetchStatus();
          fetchSettings();
        }}
      />
    </>
  );
};

export default StatusBar;
