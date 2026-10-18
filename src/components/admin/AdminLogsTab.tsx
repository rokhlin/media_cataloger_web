import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Trash2, RefreshCw, Terminal, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../services/authContext';
import { useLanguage } from '../../i18n/LanguageContext';

export default function AdminLogsTab() {
  const { authFetch } = useAuth();
  const { language } = useLanguage();
  const isRu = language === 'ru';

  const [level, setLevel] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'>('ALL');
  const [logsText, setLogsText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const url = level === 'ALL' ? '/api/logs' : `/api/logs?level=${level}`;
      const res = await authFetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogsText(data.logs || (isRu ? 'Логи пусты' : 'Logs are empty'));
      }
    } catch {
      // ignore transient polling errors
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, level, isRu]);

  useEffect(() => {
    setIsLoading(true);
    fetchLogs();
    const interval = setInterval(fetchLogs, 2500);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logsText, autoScroll]);

  const handleClearLogs = async () => {
    if (!window.confirm(isRu ? 'Вы уверены, что хотите очистить журнал логов?' : 'Are you sure you want to clear the logs?')) {
      return;
    }
    try {
      const res = await authFetch('/api/logs/clear', { method: 'POST' });
      if (res.ok) {
        setLogsText('');
        setFeedback(isRu ? 'Логи успешно очищены' : 'Logs cleared successfully');
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (err: any) {
      setFeedback(err.message || 'Error clearing logs');
    }
  };

  const handleDownloadLogs = () => {
    if (!logsText) return;
    const blob = new Blob([logsText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `media_catalog_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const levels: Array<'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'> = ['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'];

  return (
    <div className="space-y-4">
      {/* Header controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-card border border-border/70 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {isRu ? 'Системный журнал и диагностика' : 'System Logs & Diagnostics'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isRu ? 'Просмотр журнала событий backend-сервиса и фоновых AI-воркеров' : 'Real-time event stream from backend and AI worker processes'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Level Filter Pills */}
          <div className="flex items-center bg-muted/40 p-1 rounded-xl border border-border/60">
            {levels.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevel(lvl)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  level === lvl
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Auto-scroll toggle */}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none px-2 py-1 bg-muted/20 border border-border/50 rounded-xl">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded text-primary"
            />
            <span>{isRu ? 'Автоскролл' : 'Auto-scroll'}</span>
          </label>

          {/* Download Logs */}
          <button
            type="button"
            onClick={handleDownloadLogs}
            disabled={!logsText}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer disabled:opacity-50"
            title={isRu ? 'Скачать лог-файл' : 'Download log file'}
          >
            <Download size={14} />
            <span>{isRu ? 'Скачать логи' : 'Download logs'}</span>
          </button>

          {/* Clear Logs */}
          <button
            type="button"
            onClick={handleClearLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-500 transition-all cursor-pointer"
            title={isRu ? 'Очистить журнал логов' : 'Clear log history'}
          >
            <Trash2 size={14} />
            <span>{isRu ? 'Очистить' : 'Clear'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              fetchLogs();
            }}
            className="p-1.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
            title={isRu ? 'Обновить сейчас' : 'Refresh now'}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-primary' : ''} />
          </button>
        </div>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-500 font-medium animate-in fade-in">
          <CheckCircle2 size={15} />
          <span>{feedback}</span>
        </div>
      )}

      {/* Terminal View Container */}
      <div className="bg-[#0f172a] text-[#f8fafc] border border-border/80 rounded-2xl shadow-inner p-4 font-mono text-xs overflow-auto max-h-[600px] min-h-[350px] select-text">
        {logsText ? (
          <pre className="whitespace-pre-wrap leading-relaxed break-words font-mono">
            {logsText.split('\n').map((line, idx) => {
              let colorClass = 'text-slate-300';
              if (/ERROR|FATAL|Exception|Traceback/i.test(line)) {
                colorClass = 'text-rose-400 font-semibold';
              } else if (/WARN|Warning/i.test(line)) {
                colorClass = 'text-amber-300';
              } else if (/SUCCESS|DONE|COMPLETED/i.test(line)) {
                colorClass = 'text-emerald-400';
              } else if (/START|INIT|Pipeline/i.test(line)) {
                colorClass = 'text-cyan-300';
              }
              return (
                <div key={idx} className={`${colorClass} hover:bg-slate-800/40 px-1 rounded`}>
                  {line}
                </div>
              );
            })}
          </pre>
        ) : (
          <div className="flex items-center justify-center h-48 text-slate-500">
            {isRu ? 'Журнал событий пуст или еще не сформирован' : 'Log buffer is empty'}
          </div>
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
