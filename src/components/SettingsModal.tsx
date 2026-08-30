import React, { useState, useEffect } from 'react';
import type { SettingsData, UISettings } from '../models';
import type { ThemeMode } from '../models/theme';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import DirectoryBrowserModal from './DirectoryBrowserModal';

export type SettingsTab = 'execution' | 'paths' | 'models' | 'appearance' | 'preferences';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SettingsData | null;
  onSaveSettings: (newSettings: SettingsData) => Promise<boolean>;
  onPickFolder?: (title?: string) => Promise<string>;
  isRunning?: boolean;
  isPaused?: boolean;
  currentTask?: string | null;
  onStartSync: (force: boolean) => void;
  onPauseSync: () => void;
  onResumeSync: () => void;
  onStopSync: () => void;
  onStartSingleAnalysis: (path: string) => void;
  onPickSingleFile?: () => Promise<string>;
  pickerPending?: boolean;
  uiSettings?: UISettings;
  onSaveUiSettings?: (settings: UISettings) => void;
  initialTab?: SettingsTab;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  isRunning = false,
  isPaused = false,
  currentTask = null,
  onStartSync,
  onPauseSync,
  onResumeSync,
  onStopSync,
  onStartSingleAnalysis,
  pickerPending = false,
  uiSettings = { maxImagesPerRow: 10, maxRows: 1, maxWidth: 1600, galleryMaxRows: 10 },
  onSaveUiSettings,
  initialTab = 'execution',
}: SettingsModalProps) {
  const { language, setLanguage, t } = useLanguage();
  const {
    themeId,
    themeMode,
    presets,
    customThemes,
    setThemeId,
    saveCustomTheme,
    deleteCustomTheme,
    toggleThemeMode,
  } = useTheme();

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [formData, setFormData] = useState<SettingsData>({});
  const [isSaving, setIsSaving] = useState(false);

  // Directory Browser Modal state
  const [browserModal, setBrowserModal] = useState<{
    isOpen: boolean;
    title: string;
    initialPath: string;
    mode: 'folder' | 'file';
    targetType: 'input' | 'output' | 'singleFile';
    inputIndex?: number;
  }>({
    isOpen: false,
    title: '',
    initialPath: '',
    mode: 'folder',
    targetType: 'input',
  });

  // Execution tab states
  const [forceReprocess, setForceReprocess] = useState(false);
  const [singleFilePath, setSingleFilePath] = useState('');

  // UI preferences local state
  const [localUiSettings, setLocalUiSettings] = useState<UISettings>(uiSettings);

  // Connection validation state
  const [validatingConnection, setValidatingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ connected?: boolean; message?: string } | null>(null);

  // Custom theme builder form state
  const [customName, setCustomName] = useState('My Custom Theme');
  const [customMode, setCustomMode] = useState<ThemeMode>('dark');
  const [customBg, setCustomBg] = useState('#0d1117');
  const [customCard, setCustomCard] = useState('#161b22');
  const [customPrimary, setCustomPrimary] = useState('#58a6ff');
  const [customAccent, setCustomAccent] = useState('#bc8cff');
  const [customText, setCustomText] = useState('#c9d1d9');
  const [customSavedMsg, setCustomSavedMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen && settings) {
      setFormData({
        input_folders: settings.input_folders ? [...settings.input_folders] : [],
        output_folder: settings.output_folder || '',
        model_provider: settings.model_provider || 'gemini',
        gemini_model: settings.gemini_model || 'gemini-3.6-flash',
        local_model_name: settings.local_model_name || '',
        gemini_max_workers: settings.gemini_max_workers || 3,
        local_max_workers: settings.local_max_workers || 2,
        whisper_model: settings.whisper_model || 'large-v3-turbo',
        preserve_structure: settings.preserve_structure !== undefined ? settings.preserve_structure : true,
      });
    }
  }, [isOpen, settings]);

  useEffect(() => {
    setLocalUiSettings(uiSettings);
  }, [uiSettings]);

  if (!isOpen) return null;

  const handleInputChange = (field: keyof SettingsData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddFolder = () => {
    setFormData((prev) => ({
      ...prev,
      input_folders: [...(prev.input_folders || []), ''],
    }));
  };

  const handleFolderChange = (index: number, value: string) => {
    setFormData((prev) => {
      const updated = [...(prev.input_folders || [])];
      updated[index] = value;
      return { ...prev, input_folders: updated };
    });
  };

  const handleRemoveFolder = (index: number) => {
    setFormData((prev) => {
      const updated = [...(prev.input_folders || [])];
      updated.splice(index, 1);
      return { ...prev, input_folders: updated };
    });
  };

  const handlePickInputFolder = (index: number) => {
    const currentVal = formData.input_folders?.[index] || '';
    setBrowserModal({
      isOpen: true,
      title: t('browserTitle'),
      initialPath: currentVal,
      mode: 'folder',
      targetType: 'input',
      inputIndex: index,
    });
  };

  const handlePickOutputFolder = () => {
    setBrowserModal({
      isOpen: true,
      title: t('outputFolder'),
      initialPath: formData.output_folder || '',
      mode: 'folder',
      targetType: 'output',
    });
  };

  const handlePickFileClick = () => {
    setBrowserModal({
      isOpen: true,
      title: t('browserTitleFile'),
      initialPath: singleFilePath || '',
      mode: 'file',
      targetType: 'singleFile',
    });
  };

  const handleBrowserSelect = (selectedPath: string) => {
    if (!selectedPath) return;
    if (browserModal.targetType === 'input' && browserModal.inputIndex !== undefined) {
      handleFolderChange(browserModal.inputIndex, selectedPath);
    } else if (browserModal.targetType === 'output') {
      handleInputChange('output_folder', selectedPath);
    } else if (browserModal.targetType === 'singleFile') {
      setSingleFilePath(selectedPath);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const cleanedFolders = (formData.input_folders || [])
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const payload: SettingsData = {
      ...formData,
      input_folders: cleanedFolders,
      output_folder: formData.output_folder ? formData.output_folder.trim() : '',
    };

    const success = await onSaveSettings(payload);

    if (onSaveUiSettings) {
      onSaveUiSettings(localUiSettings);
    }

    setIsSaving(false);
    if (success) {
      onClose();
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm(t('promptResetSettingsConfirm'))) {
      setFormData({
        input_folders: [],
        output_folder: '',
        model_provider: 'gemini',
        gemini_model: 'gemini-1.5-flash',
        local_model_name: '',
        whisper_model: 'base',
        preserve_structure: true,
      });
      setLocalUiSettings({
        maxImagesPerRow: 10,
        maxRows: 1,
        maxWidth: 1600,
        galleryMaxRows: 10,
      });
      setThemeId('dark');
    }
  };

  const handleSaveCustomTheme = () => {
    saveCustomTheme({
      name: customName,
      mode: customMode,
      bgColor: customBg,
      cardBgSolid: customCard,
      primaryColor: customPrimary,
      accentColor: customAccent,
      textColor: customText,
    });
    setCustomSavedMsg(t('customThemeCreated'));
    setTimeout(() => setCustomSavedMsg(''), 3500);
  };

  const handleDeleteCustomTheme = (id: string, name: string) => {
    if (window.confirm(`${t('confirmDeleteTheme')} (${name})`)) {
      deleteCustomTheme(id);
    }
  };

  const isSyncActive = (isRunning || isPaused) && (!currentTask || currentTask === 'sync');
  const disabled = isRunning || isPaused || pickerPending;

  const handleSyncClick = () => {
    onStartSync(forceReprocess);
  };

  const handleAnalyzeClick = () => {
    const trimmed = singleFilePath.trim();
    if (!trimmed) {
      alert(t('alertEnterPath'));
      return;
    }
    onStartSingleAnalysis(trimmed);
  };

  const handleValidateConnection = async () => {
    setValidatingConnection(true);
    setConnectionResult(null);
    try {
      const startTime = Date.now();
      let res = await fetch('/api/validate-connection');
      if (res.status === 404) {
        // Graceful fallback to /api/status for running instances
        res = await fetch('/api/status');
      }
      if (res.ok) {
        const data = await res.json();
        const latencyMs = Date.now() - startTime;
        const isConnected = data.connected !== undefined 
          ? Boolean(data.connected) 
          : (data.status !== undefined && data.status !== 'offline');
        setConnectionResult({
          connected: isConnected,
          message: data.message || (isConnected ? `Connected to media_cataloger (${latencyMs}ms)` : 'Cataloger service offline or unreachable'),
        });
      } else {
        setConnectionResult({
          connected: false,
          message: `Server returned HTTP ${res.status}`,
        });
      }
    } catch (err: any) {
      setConnectionResult({
        connected: false,
        message: `Network error: ${err.message}`,
      });
    } finally {
      setValidatingConnection(false);
    }
  };

  const allPresets = [...presets, ...customThemes];

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="modal-card settings-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '840px', width: '92vw' }}
      >
        <div className="modal-header">
          <h2>⚙️ {t('settingsTitle')}</h2>
          <button className="close-btn" onClick={onClose} type="button">
            &times;
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'execution' ? 'active' : ''}`}
            onClick={() => setActiveTab('execution')}
          >
            ⚡ {t('tabExecution')}
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'paths' ? 'active' : ''}`}
            onClick={() => setActiveTab('paths')}
          >
            📁 {t('tabPaths')}
            {Boolean(settings?.is_custom_input || settings?.is_custom_output) && (
              <span className="badge-pill badge-pill-accent" style={{ marginLeft: '4px', fontSize: '0.65rem' }}>
                {t('badgeCustomPath')}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'models' ? 'active' : ''}`}
            onClick={() => setActiveTab('models')}
          >
            🤖 {t('tabModels')}
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            🎨 {t('tabAppearance')}
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            🖼️ {t('tabPreferences')}
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto', padding: '1rem 0' }}>
            {/* Tab 1: Execution Controls */}
            {activeTab === 'execution' && (
              <div className="settings-tab-pane">
                {/* Full Archive Sync Section */}
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label>{t('syncSectionTitle')}</label>
                  <p className="description">{t('syncSectionDesc')}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.5rem 0' }}>
                    <label className="checkbox-group">
                      <input
                        type="checkbox"
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
                        <button type="button" className="btn btn-primary" onClick={onResumeSync} style={{ flex: 1 }}>
                          ▶️ {t('btnResume')}
                        </button>
                      ) : (
                        <button type="button" className="btn btn-warning" onClick={onPauseSync} style={{ flex: 1 }}>
                          ⏸️ {t('btnPause')}
                        </button>
                      )}
                      <button type="button" className="btn btn-danger" onClick={onStopSync} style={{ flex: 1 }}>
                        ⏹️ {t('btnStop')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSyncClick}
                      disabled={disabled}
                      style={{ width: '100%' }}
                    >
                      🚀 {t('btnRunSync')}
                    </button>
                  )}
                </div>

                {/* Single File Analysis Section */}
                <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                  <label>{t('singleFileSectionTitle')}</label>
                  <p className="description">{t('singleFileSectionDesc')}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', margin: '0.5rem 0' }}>
                    <input
                      type="text"
                      className="input-control"
                      value={singleFilePath}
                      onChange={(e) => setSingleFilePath(e.target.value)}
                      placeholder={t('placeholderSingleFile')}
                      disabled={disabled}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handlePickFileClick}
                      disabled={disabled}
                      title={t('chooseFileTooltip')}
                    >
                      📂
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-accent"
                    onClick={handleAnalyzeClick}
                    disabled={disabled || !singleFilePath.trim()}
                    style={{ width: '100%' }}
                  >
                    ⚡ {t('analyzeButtonText')}
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Paths & Storage */}
            {activeTab === 'paths' && (
              <div className="settings-tab-pane">
                {/* Input Folders */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>
                      {t('inputFolders')}
                      {settings?.is_custom_input ? (
                        <span className="badge-custom" style={{ marginLeft: '8px' }}>
                          {t('badgeCustomPath')}
                        </span>
                      ) : (
                        <span className="badge-default" style={{ marginLeft: '8px' }}>
                          {t('badgeDefaultPath')}
                        </span>
                      )}
                    </label>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={handleAddFolder}
                    >
                      + {t('btnAddFolder')}
                    </button>
                  </div>
                  <p className="description">{t('inputFoldersDesc')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.4rem' }}>
                    {(formData.input_folders || []).map((folder, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          className="input-control"
                          value={folder}
                          onChange={(e) => handleFolderChange(idx, e.target.value)}
                          placeholder="e.g. C:\Users\Media\Pictures"
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.7rem' }}
                          title={t('btnBrowse')}
                          onClick={() => handlePickInputFolder(idx)}
                          disabled={pickerPending}
                        >
                          📂
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '0.4rem 0.7rem' }}
                          onClick={() => handleRemoveFolder(idx)}
                          title={t('delete')}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {(!formData.input_folders || formData.input_folders.length === 0) && (
                      <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {t('default')}: (defined in .env / INPUT_FOLDERS)
                      </div>
                    )}
                  </div>
                </div>

                {/* Output Folder */}
                <div className="form-group" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                  <label>
                    {t('outputFolder')}
                    {settings?.is_custom_output ? (
                      <span className="badge-custom" style={{ marginLeft: '8px' }}>
                        {t('badgeCustomPath')}
                      </span>
                    ) : (
                      <span className="badge-default" style={{ marginLeft: '8px' }}>
                        {t('badgeDefaultPath')}
                      </span>
                    )}
                  </label>
                  <p className="description">{t('outputFolderDesc')}</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="input-control"
                      value={formData.output_folder || ''}
                      onChange={(e) => handleInputChange('output_folder', e.target.value)}
                      placeholder={settings?.default_output_folder || 'e.g. ./output'}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem 0.7rem' }}
                      title={t('btnBrowse')}
                      onClick={handlePickOutputFolder}
                      disabled={pickerPending}
                    >
                      📂
                    </button>
                  </div>
                </div>

                {/* Preserve Structure */}
                <div className="form-group" style={{ marginTop: '1.25rem' }}>
                  <label className="checkbox-group">
                    <input
                      type="checkbox"
                      checked={formData.preserve_structure}
                      onChange={(e) => handleInputChange('preserve_structure', e.target.checked)}
                    />
                    {t('preserveStructure')}
                  </label>
                </div>
              </div>
            )}

            {/* Tab 3: AI & Models */}
            {activeTab === 'models' && (
              <div className="settings-tab-pane">
                {/* AI Engine Connection & Status */}
                <div
                  className="card"
                  style={{
                    marginBottom: '1.25rem',
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--border-color)',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.1rem' }}>🔗</span>
                      <strong>AI Engine Service Connection</strong>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleValidateConnection}
                      disabled={validatingConnection}
                      style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      {validatingConnection ? '⏳ Testing...' : '⚡ Test Connection'}
                    </button>
                  </div>
                  <p className="description" style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem' }}>
                    The Python <code>media_cataloger</code> engine executes AI pipelines, InsightFace embeddings, and vision processing.
                  </p>
                  {connectionResult && (
                    <div
                      style={{
                        padding: '0.45rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                        backgroundColor: connectionResult.connected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        border: `1px solid ${connectionResult.connected ? '#22c55e' : '#ef4444'}`,
                        color: connectionResult.connected ? '#4ade80' : '#f87171',
                      }}
                    >
                      {connectionResult.connected ? '✅' : '❌'} {connectionResult.message}
                    </div>
                  )}
                </div>

                {/* Model Provider */}
                <div className="form-group">
                  <label>{t('modelProvider')}</label>
                  <select
                    className="input-control"
                    value={formData.model_provider}
                    onChange={(e) => handleInputChange('model_provider', e.target.value)}
                  >
                    <option value="gemini">Gemini API (Cloud AI)</option>
                    <option value="local">LM Studio / Local LLM (Local AI)</option>
                    <option value="hybrid">Hybrid (Gemini with Local Fallback)</option>
                  </select>
                </div>

                {/* Gemini Model */}
                {(formData.model_provider === 'gemini' || formData.model_provider === 'hybrid') && (
                  <div className="form-group">
                    <label>{t('geminiModel')}</label>
                    <select
                      className="input-control"
                      value={formData.gemini_model}
                      onChange={(e) => handleInputChange('gemini_model', e.target.value)}
                    >
                      <option value="gemini-1.5-flash">gemini-1.5-flash (Fast & Recommended)</option>
                      <option value="gemini-1.5-pro">gemini-1.5-pro (High Precision)</option>
                      <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp (Experimental)</option>
                    </select>
                  </div>
                )}

                {/* Local Model Name */}
                {(formData.model_provider === 'local' || formData.model_provider === 'hybrid') && (
                  <div className="form-group">
                    <label>{t('localModelName')}</label>
                    <input
                      type="text"
                      className="input-control"
                      value={formData.local_model_name || ''}
                      onChange={(e) => handleInputChange('local_model_name', e.target.value)}
                      placeholder="e.g. qwen2.5-vl-7b-instruct"
                    />
                  </div>
                )}

                {/* Parallel Worker Queue Section */}
                <div className="form-group" style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                  <label>⚡ Parallel Processing & Worker Queue</label>
                  <p className="description" style={{ marginBottom: '0.75rem' }}>
                    Configure how many media files are analyzed simultaneously in the background worker queue.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {/* Gemini Parallel Workers */}
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                        Gemini API Parallel Workers: <span style={{ color: 'var(--primary-color)' }}>{formData.gemini_max_workers || 3}</span>
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="15"
                        step="1"
                        value={formData.gemini_max_workers || 3}
                        onChange={(e) => handleInputChange('gemini_max_workers', parseInt(e.target.value, 10))}
                        style={{ width: '100%', accentColor: 'var(--primary-color)' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span>1 (Sequential)</span>
                        <span>3 (Recommended)</span>
                        <span>15 (Max)</span>
                      </div>
                    </div>

                    {/* Local Model Parallel Workers */}
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                        Local Model Parallel Workers: <span style={{ color: 'var(--accent-color)' }}>{formData.local_max_workers || 2}</span>
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        step="1"
                        value={formData.local_max_workers || 2}
                        onChange={(e) => handleInputChange('local_max_workers', parseInt(e.target.value, 10))}
                        style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span>1 (Single)</span>
                        <span>2 (Recommended)</span>
                        <span>8 (High VRAM)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Whisper Speech Model */}
                <div className="form-group" style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <label>{t('whisperModel')}</label>
                  <select
                    className="input-control"
                    value={formData.whisper_model}
                    onChange={(e) => handleInputChange('whisper_model', e.target.value)}
                  >
                    <option value="tiny">tiny (Fastest, Lower accuracy)</option>
                    <option value="base">base (Balanced & Recommended)</option>
                    <option value="small">small (High accuracy)</option>
                    <option value="medium">medium (Very high accuracy)</option>
                    <option value="large-v3-turbo">large-v3-turbo (State of the art)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Tab 4: Theme & Appearance */}
            {activeTab === 'appearance' && (
              <div className="settings-tab-pane appearance-tab-pane">
                {/* Theme Mode Quick Switch */}
                <div className="form-group">
                  <label>{t('themeModeLabel')}</label>
                  <div className="theme-mode-toggle-group">
                    <button
                      type="button"
                      className={`theme-mode-btn ${themeMode === 'dark' ? 'active' : ''}`}
                      onClick={() => themeMode !== 'dark' && toggleThemeMode()}
                    >
                      🌙 {t('modeDark')}
                    </button>
                    <button
                      type="button"
                      className={`theme-mode-btn ${themeMode === 'light' ? 'active' : ''}`}
                      onClick={() => themeMode !== 'light' && toggleThemeMode()}
                    >
                      ☀️ {t('modeLight')}
                    </button>
                  </div>
                </div>

                {/* Presets Selection Grid */}
                <div className="form-group" style={{ marginTop: '1.25rem' }}>
                  <label>{t('themePresetsLabel')}</label>
                  <p className="description">{t('themePresetsDesc')}</p>
                  
                  <div className="theme-presets-grid">
                    {allPresets.map((preset) => {
                      const isSelected = preset.id === themeId;
                      const isCustom = preset.id.startsWith('custom-');
                      const name = 'nameKey' in preset ? t(preset.nameKey as any) : preset.name;

                      return (
                        <div
                          key={preset.id}
                          className={`theme-preset-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => setThemeId(preset.id)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="theme-preset-header">
                            <span className="theme-preset-icon">{preset.icon || '🎨'}</span>
                            <span className="theme-preset-name">{name}</span>
                            <span className="theme-preset-mode-badge">{preset.mode === 'dark' ? 'Dark' : 'Light'}</span>
                          </div>

                          <div className="theme-preset-swatches">
                            {preset.previewColors.map((color, idx) => (
                              <span
                                key={idx}
                                className="theme-preset-swatch-circle"
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                          </div>

                          {isCustom && (
                            <button
                              type="button"
                              className="btn-delete-custom-preset"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCustomTheme(preset.id, name);
                              }}
                              title={t('btnDeleteCustomTheme')}
                            >
                              ✕
                            </button>
                          )}

                          {isSelected && <div className="theme-preset-active-check">✓</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Theme Builder Section */}
                <div className="custom-theme-builder-section" style={{ marginTop: '1.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                  <div className="settings-section-title">
                    <span>🎨 {t('customThemeBuilder')}</span>
                  </div>
                  <p className="description">{t('customThemeBuilderDesc')}</p>

                  <div className="custom-builder-grid">
                    <div className="form-group">
                      <label>{t('customThemeName')}</label>
                      <input
                        type="text"
                        className="input-control"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="e.g. Cyberpunk Violet"
                      />
                    </div>

                    <div className="form-group">
                      <label>{t('themeModeLabel')}</label>
                      <select
                        className="input-control"
                        value={customMode}
                        onChange={(e) => {
                          const newMode = e.target.value as ThemeMode;
                          setCustomMode(newMode);
                          if (newMode === 'light') {
                            setCustomBg('#f8fafc');
                            setCustomCard('#ffffff');
                            setCustomText('#0f172a');
                          } else {
                            setCustomBg('#0d1117');
                            setCustomCard('#161b22');
                            setCustomText('#c9d1d9');
                          }
                        }}
                      >
                        <option value="dark">🌙 Dark Mode Base</option>
                        <option value="light">☀️ Light Mode Base</option>
                      </select>
                    </div>
                  </div>

                  <div className="custom-color-pickers-row">
                    <div className="color-picker-item">
                      <label>{t('customThemeBg')}</label>
                      <div className="color-input-wrapper">
                        <input
                          type="color"
                          value={customBg}
                          onChange={(e) => setCustomBg(e.target.value)}
                          className="native-color-picker"
                        />
                        <span className="color-hex-text">{customBg}</span>
                      </div>
                    </div>

                    <div className="color-picker-item">
                      <label>{t('customThemeCard')}</label>
                      <div className="color-input-wrapper">
                        <input
                          type="color"
                          value={customCard}
                          onChange={(e) => setCustomCard(e.target.value)}
                          className="native-color-picker"
                        />
                        <span className="color-hex-text">{customCard}</span>
                      </div>
                    </div>

                    <div className="color-picker-item">
                      <label>{t('customThemePrimary')}</label>
                      <div className="color-input-wrapper">
                        <input
                          type="color"
                          value={customPrimary}
                          onChange={(e) => setCustomPrimary(e.target.value)}
                          className="native-color-picker"
                        />
                        <span className="color-hex-text">{customPrimary}</span>
                      </div>
                    </div>

                    <div className="color-picker-item">
                      <label>{t('customThemeAccent')}</label>
                      <div className="color-input-wrapper">
                        <input
                          type="color"
                          value={customAccent}
                          onChange={(e) => setCustomAccent(e.target.value)}
                          className="native-color-picker"
                        />
                        <span className="color-hex-text">{customAccent}</span>
                      </div>
                    </div>

                    <div className="color-picker-item">
                      <label>{t('customThemeText')}</label>
                      <div className="color-input-wrapper">
                        <input
                          type="color"
                          value={customText}
                          onChange={(e) => setCustomText(e.target.value)}
                          className="native-color-picker"
                        />
                        <span className="color-hex-text">{customText}</span>
                      </div>
                    </div>
                  </div>

                  {/* Live preview mini card */}
                  <div
                    className="custom-theme-live-preview"
                    style={{
                      backgroundColor: customBg,
                      borderColor: customPrimary,
                      color: customText,
                    }}
                  >
                    <div
                      className="preview-card"
                      style={{
                        backgroundColor: customCard,
                        borderColor: `${customPrimary}44`,
                        color: customText,
                      }}
                    >
                      <span className="preview-title" style={{ color: customPrimary }}>
                        Preview: {customName || 'Custom Palette'}
                      </span>
                      <p className="preview-text" style={{ color: customText, opacity: 0.85 }}>
                        Glassmorphic dashboard surfaces and interactive components render seamlessly.
                      </p>
                      <div className="preview-buttons-row">
                        <button
                          type="button"
                          className="btn"
                          style={{
                            background: `linear-gradient(135deg, ${customPrimary} 0%, ${customAccent} 100%)`,
                            color: '#ffffff',
                            padding: '0.4rem 0.9rem',
                            fontSize: '0.8rem',
                          }}
                        >
                          Primary Action
                        </button>
                        <button
                          type="button"
                          className="btn"
                          style={{
                            background: `linear-gradient(135deg, ${customAccent} 0%, ${customPrimary} 100%)`,
                            color: '#ffffff',
                            padding: '0.4rem 0.9rem',
                            fontSize: '0.8rem',
                          }}
                        >
                          Accent Action
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="btn btn-accent"
                      onClick={handleSaveCustomTheme}
                    >
                      💾 {t('btnSaveCustomTheme')}
                    </button>
                    {customSavedMsg && (
                      <span className="custom-theme-saved-toast">
                        ✨ {customSavedMsg}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 5: Display & Preferences */}
            {activeTab === 'preferences' && (
              <div className="settings-tab-pane">
                {/* Language Selection */}
                <div className="form-group">
                  <label>{t('languageSetting')}</label>
                  <p className="description">{t('languageSettingDesc')}</p>
                  <select
                    className="input-control"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'en' | 'ru')}
                  >
                    <option value="en">🇬🇧 English (EN)</option>
                    <option value="ru">🇷🇺 Русский (RU)</option>
                  </select>
                </div>

                <div className="settings-section-title" style={{ marginTop: '1.25rem' }}>
                  <span>🖼️ {t('tabPreferences')}</span>
                </div>

                <div className="settings-grid-row">
                  <div className="form-group">
                    <label>{t('maxImagesPerRowLabel')}</label>
                    <p className="description">{t('maxImagesPerRowDesc')}</p>
                    <input
                      type="number"
                      className="input-control"
                      min={4}
                      max={24}
                      value={localUiSettings.maxImagesPerRow}
                      onChange={(e) =>
                        setLocalUiSettings((prev) => ({
                          ...prev,
                          maxImagesPerRow: Math.max(4, Math.min(24, parseInt(e.target.value, 10) || 10)),
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>{t('galleryMaxRowsLabel')}</label>
                    <p className="description">{t('galleryMaxRowsDesc')}</p>
                    <input
                      type="number"
                      className="input-control"
                      min={1}
                      max={100}
                      value={localUiSettings.galleryMaxRows ?? 10}
                      onChange={(e) =>
                        setLocalUiSettings((prev) => ({
                          ...prev,
                          galleryMaxRows: Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 10)),
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>{t('maxDashboardWidthLabel')}</label>
                    <p className="description">{t('maxDashboardWidthDesc')}</p>
                    <input
                      type="number"
                      className="input-control"
                      min={1000}
                      max={2560}
                      step={50}
                      value={localUiSettings.maxWidth}
                      onChange={(e) =>
                        setLocalUiSettings((prev) => ({
                          ...prev,
                          maxWidth: Math.max(1000, Math.min(2560, parseInt(e.target.value, 10) || 1600)),
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ color: '#f87171' }}
              onClick={handleResetDefaults}
            >
              {t('btnResetDefaults')}
            </button>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
                {t('btnClose')}
              </button>
              <button type="submit" className="btn btn-accent" disabled={isSaving}>
                {isSaving ? t('btnSavingSettings') : t('btnSaveSettings')}
              </button>
            </div>
          </div>
        </form>

        {/* Interactive Directory / File Browser Modal */}
        <DirectoryBrowserModal
          isOpen={browserModal.isOpen}
          title={browserModal.title}
          initialPath={browserModal.initialPath}
          mode={browserModal.mode}
          onSelect={handleBrowserSelect}
          onClose={() => setBrowserModal((prev) => ({ ...prev, isOpen: false }))}
        />
      </div>
    </div>
  );
}
