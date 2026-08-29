import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';

interface ExecutionControlsProps {
  isRunning?: boolean;
  isPaused?: boolean;
  currentTask?: string | null;
  onStartSync: (force: boolean) => void;
  onPauseSync: () => void;
  onResumeSync: () => void;
  onStopSync: () => void;
  onStartSingleAnalysis: (path: string, onSuccess?: () => void) => void;
  onPickSingleFile: () => Promise<string>;
  pickerPending?: boolean;
}

export default function ExecutionControls({
  isRunning = false,
  isPaused = false,
  currentTask = null,
  onStartSync,
  onPauseSync,
  onResumeSync,
  onStopSync,
  onStartSingleAnalysis,
  onPickSingleFile,
  pickerPending = false,
}: ExecutionControlsProps) {
  const { t } = useLanguage();
  const [forceReprocess, setForceReprocess] = useState(false);
  const [singleFilePath, setSingleFilePath] = useState('');

  const handleSyncClick = () => {
    onStartSync(forceReprocess);
  };

  const handleAnalyzeClick = () => {
    const trimmed = singleFilePath.trim();
    if (!trimmed) {
      alert(t('alertEnterPath'));
      return;
    }
    onStartSingleAnalysis(trimmed, () => setSingleFilePath(''));
  };

  const handlePickFileClick = async () => {
    const selected = await onPickSingleFile();
    if (selected) {
      setSingleFilePath(selected);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAnalyzeClick();
    }
  };

  const isSyncActive = (isRunning || isPaused) && (!currentTask || currentTask === 'sync');
  const disabled = isRunning || isPaused || pickerPending;

  return (
    <div className="card">
      <h2>⚡ {t('controlsTitle')}</h2>

      {/* Full Archive Sync */}
      <div className="form-group" style={{ marginTop: '0.25rem' }}>
        <label>{t('syncSectionTitle')}</label>
        <p className="description">{t('syncSectionDesc')}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.5rem 0' }}>
          <label className="checkbox-group">
            <input
              type="checkbox"
              id="force-reprocess"
              checked={forceReprocess}
              onChange={(e) => setForceReprocess(e.target.checked)}
              disabled={isSyncActive || disabled}
            />
            {t('forceReprocessLabel')}
          </label>
        </div>

        {isSyncActive ? (
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            {isPaused ? (
              <button
                className="btn btn-success"
                id="btn-resume-sync"
                onClick={onResumeSync}
                style={{ flex: 1 }}
                type="button"
              >
                ▶ {t('btnResume')}
              </button>
            ) : (
              <button
                className="btn btn-warning"
                id="btn-pause-sync"
                onClick={onPauseSync}
                style={{ flex: 1 }}
                type="button"
              >
                ⏸ {t('btnPause')}
              </button>
            )}
            <button
              className="btn btn-danger"
              id="btn-stop-sync"
              onClick={onStopSync}
              style={{ flex: 1 }}
              type="button"
            >
              ⏹ {t('btnStop')}
            </button>
          </div>
        ) : (
          <button
            className="btn btn-primary"
            id="btn-sync"
            onClick={handleSyncClick}
            disabled={disabled}
          >
            ⚡ {t('btnRunSync')}
          </button>
        )}
      </div>

      {/* Single File Analysis */}
      <div
        className="form-group"
        style={{
          marginTop: '0.75rem',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '1.5rem',
        }}
      >
        <label htmlFor="single-file-input">{t('singleFileSectionTitle')}</label>
        <p className="description">{t('singleFileSectionDesc')}</p>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <input
            type="text"
            className="input-control"
            id="single-file-input"
            value={singleFilePath}
            onChange={(e) => setSingleFilePath(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('placeholderSingleFile')}
            disabled={disabled}
          />
          <button
            className="btn-icon"
            title={t('chooseFileTooltip')}
            id="btn-pick-file"
            onClick={handlePickFileClick}
            disabled={disabled}
            type="button"
          >
            📄
          </button>
          <button
            className="btn btn-accent"
            id="btn-analyze"
            onClick={handleAnalyzeClick}
            disabled={disabled}
            type="button"
          >
            {t('analyzeButtonText')}
          </button>
        </div>
      </div>
    </div>
  );
}
