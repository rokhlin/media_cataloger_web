import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';

interface PipelineLogsProps {
  isOpen: boolean;
  onClose: () => void;
  logs?: string[];
  onRefreshLogs?: () => void;
  onClearLogs?: () => Promise<void> | void;
  isRefreshing?: boolean;
}

export default function PipelineLogs({
  isOpen,
  onClose,
  logs = [],
  onRefreshLogs,
  onClearLogs,
  isRefreshing = false,
}: PipelineLogsProps) {
  const { t } = useLanguage();
  const [autoScroll, setAutoScroll] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const consoleRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll when new logs arrive
  useEffect(() => {
    if (isOpen && autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, autoScroll, isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Save logs to a downloadable file
  const handleSaveLogs = () => {
    if (!logs || logs.length === 0) return;
    const content = logs.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    a.href = url;
    a.download = `pipeline_logs_${timestamp}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy logs to clipboard
  const handleCopyLogs = async () => {
    if (!logs || logs.length === 0) return;
    try {
      await navigator.clipboard.writeText(logs.join('\n'));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs to clipboard:', err);
    }
  };

  // Clear logs action
  const handleClearLogs = async () => {
    if (!onClearLogs) return;
    if (window.confirm(t('confirmClearLogs'))) {
      setIsClearing(true);
      try {
        await onClearLogs();
      } finally {
        setIsClearing(false);
      }
    }
  };

  if (!isOpen) return null;

  const hasLogs = Boolean(logs && logs.length > 0);

  return (
    <div className="modal-overlay active" onClick={onClose} id="pipeline-logs-modal-overlay">
      <div
        className="modal-card logs-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '960px',
          width: '92vw',
          height: '84vh',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            paddingBottom: '0.8rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.6rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>📋 {t('logsTitle')}</h2>
            <span className="badge-pill badge-pill-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}>
              {logs.length} lines
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <label className="checkbox-group" style={{ fontSize: '0.82rem', marginRight: '0.4rem' }}>
              <input
                type="checkbox"
                id="modal-auto-scroll"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
              />
              {t('autoScroll')}
            </label>

            {/* Save / Download logs button */}
            <button
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              onClick={handleSaveLogs}
              disabled={!hasLogs}
              type="button"
              title={t('btnSaveLogs')}
            >
              💾 {t('btnSaveLogs')}
            </button>

            {/* Copy to clipboard */}
            <button
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              onClick={handleCopyLogs}
              disabled={!hasLogs}
              type="button"
              title="Copy to clipboard"
            >
              {isCopied ? '✓ Copied' : '📋 Copy'}
            </button>

            {/* Clear logs button */}
            {onClearLogs && (
              <button
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#f87171' }}
                onClick={handleClearLogs}
                disabled={!hasLogs || isClearing}
                type="button"
                title={t('btnClearLogs')}
              >
                🗑️ {t('btnClearLogs')}
              </button>
            )}

            {/* Refresh button */}
            {onRefreshLogs && (
              <button
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                onClick={onRefreshLogs}
                disabled={isRefreshing}
                type="button"
                title={t('btnRefreshLogs')}
              >
                {isRefreshing ? t('btnRefreshingLogs') : `🔄 ${t('btnRefreshLogs')}`}
              </button>
            )}

            {/* Close button */}
            <button
              className="close-btn"
              onClick={onClose}
              type="button"
              title={t('close')}
              style={{ fontSize: '1.4rem', lineHeight: 1, marginLeft: '0.2rem' }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Console content */}
        <div
          className="console-container"
          id="console"
          ref={consoleRef}
          style={{
            flex: 1,
            height: '100%',
            minHeight: '300px',
            margin: '1rem 0 0.6rem 0',
            overflowY: 'auto',
          }}
        >
          {hasLogs ? (
            logs.map((line, idx) => (
              <div className="console-line" key={idx}>
                {line}
              </div>
            ))
          ) : (
            <div className="console-line" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {t('noLogsAvailable')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '0.6rem',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {autoScroll ? '🟢 Auto-scroll active' : '⏸️ Auto-scroll paused'}
          </span>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '0.45rem 1.1rem', fontSize: '0.85rem' }}>
              {t('btnClose')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
