import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, X, Folder, Play } from 'lucide-react';
import { cn } from '@/utils';
import FolderConfigModal from '../common/FolderConfigModal';

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
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [isTriggeringScan, setIsTriggeringScan] = useState(false);

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
        setBackendStatus(isRunning ? 'running' : 'idle');

        if (isRunning) {
          const percent = data.progress?.percent ?? data.progress?.percentage ?? 0;
          setLiveProgress(percent);
          const currentFile = data.progress?.current_file ? `Файл: ${data.progress.current_file}` : '';
          const stage = data.progress?.stage ? `[${data.progress.stage}] ` : '';
          setLiveTitle('Фоновое сканирование медиатеки');
          setLiveDetail(`${stage}${currentFile || 'Обработка медиафайлов и индексация...'}`);
        } else {
          setLiveProgress(100);
          setLiveTitle('Медиатека готова к работе');
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
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.input_folders)) {
          setConfiguredFolders(data.input_folders);
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
    return () => clearInterval(interval);
  }, [fetchStatus, fetchSettings]);

  const handleStartScan = async () => {
    setIsTriggeringScan(true);
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setBackendStatus('running');
        setLiveTitle('Фоновое сканирование медиатеки');
        setLiveDetail('Запуск пайплайна сканирования...');
        fetchStatus();
      }
    } catch (err) {
      console.error('Failed to trigger scan:', err);
    } finally {
      setIsTriggeringScan(false);
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
      ? (configuredFolders.length > 0 ? `Папки: ${configuredFolders.join(', ')}` : 'Папки для сканирования не настроены')
      : liveDetail
  );

  const clampedProgress = Math.min(100, Math.max(0, effectiveProgress));

  return (
    <>
      <aside
        aria-label="Состояние фоновых процессов"
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
                    title="Указать папки на диске для поиска фото и видео"
                  >
                    <Folder size={13} className="text-primary" />
                    <span>Настроить папки</span>
                  </button>

                  <button
                    type="button"
                    disabled={isTriggeringScan}
                    onClick={handleStartScan}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-white shadow-xs transition-colors"
                    title="Запустить сканирование медиафайлов"
                  >
                    <Play size={12} className="fill-white" />
                    <span>Сканировать</span>
                  </button>
                </>
              )}

              {effectiveStatus === 'running' && (
                <span className="font-mono font-medium text-primary text-xs">
                  {clampedProgress}%
                </span>
              )}

              {isCollapsible && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title={expanded ? 'Свернуть детали' : 'Развернуть детали'}
                  aria-label={expanded ? 'Свернуть детали' : 'Развернуть детали'}
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
                  title="Скрыть"
                  aria-label="Скрыть строку прогресса"
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
                <span className="font-medium text-foreground">Потоки обработки:</span>{' '}
                {activeWorkers > 0 ? `${activeWorkers} активных потоков` : 'В режиме ожидания'}
              </div>
              <div>
                <span className="font-medium text-foreground">ИИ Модели:</span>{' '}
                {modelsLoaded.vision_llm ? 'Qwen2.5-VL онлайн' : 'Загрузка'}
                {modelsLoaded.whisper ? ', Whisper готов' : ''}
              </div>
              <div>
                <span className="font-medium text-foreground">Источники:</span>{' '}
                {configuredFolders.length > 0 ? configuredFolders[0] : 'Не заданы'}
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
