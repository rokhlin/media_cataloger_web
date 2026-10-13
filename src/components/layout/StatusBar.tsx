import React from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '@/utils';

export interface StatusBarProps {
  progress?: number; // 0 - 100
  title?: string;
  detail?: string;
  status?: 'idle' | 'running' | 'completed' | 'error';
  isCollapsible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  progress = 45,
  title = 'Фоновое сканирование медиатеки',
  detail = 'Обработано 1,240 из 2,800 файлов (AI индексация)',
  status = 'running',
  isCollapsible = true,
  onDismiss,
  className,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed || status === 'idle') return null;

  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <aside
      aria-label="Состояние фоновых процессов"
      className={cn(
        'w-full border-t bg-card/95 backdrop-blur-md px-4 py-2 transition-all duration-300 text-xs text-foreground shadow-sm',
        className
      )}
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {status === 'running' && (
              <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin shrink-0" aria-hidden="true" />
            )}
            {status === 'completed' && (
              <CheckCircle2 className="h-3.5 w-3.5 text-[#2dc071] shrink-0" aria-hidden="true" />
            )}
            {status === 'error' && (
              <AlertCircle className="h-3.5 w-3.5 text-[#e74040] shrink-0" aria-hidden="true" />
            )}
            <div className="truncate">
              <span className="font-semibold text-foreground mr-2">{title}</span>
              <span className="text-muted-foreground hidden sm:inline">{detail}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono font-medium text-primary text-xs">
              {clampedProgress}%
            </span>
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

        {/* Progress bar line */}
        <div 
          role="progressbar" 
          aria-valuenow={clampedProgress} 
          aria-valuemin={0} 
          aria-valuemax={100}
          className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-gradient-to-r from-[#23a6f0] to-[#2091f9] rounded-full transition-all duration-300 ease-out"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>

        {/* Expanded detail box */}
        {expanded && (
          <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Загрузка:</span> 18.4 МБ/сек
            </div>
            <div>
              <span className="font-medium text-foreground">Память:</span> 420 МБ / 2 ГБ
            </div>
            <div>
              <span className="font-medium text-foreground">Оставшееся время:</span> ~ 1 мин 45 сек
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default StatusBar;
