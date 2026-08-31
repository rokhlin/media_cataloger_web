import React, { useState, useMemo, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useFeatureFlags, normalizeClassName, DEFAULT_FEATURE_FLAG_PRESETS } from '../services/featureFlagsContext';
import type { FeatureFlag } from '../models/featureFlags';
import type { StatusInfo } from '../models/status';
import './AdminPanel.css';

interface AdminPanelProps {
  statusInfo?: StatusInfo;
  mediaFilesCount?: number;
  facesCount?: number;
}

export default function AdminPanel({
  statusInfo,
  mediaFilesCount = 0,
  facesCount = 0,
}: AdminPanelProps) {
  const { t } = useLanguage();
  const {
    flags,
    addFlag,
    updateFlag,
    toggleFlag,
    removeFlag,
    resetToDefaults,
    clearAllFlags,
    disabledClassesCount,
  } = useFeatureFlags();

  // Accordion open states
  const [isFlagsSectionOpen, setIsFlagsSectionOpen] = useState(true);
  const [isSandboxOpen, setIsSandboxOpen] = useState(true);
  const [isSystemStatsOpen, setIsSystemStatsOpen] = useState(true);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFlagKey, setEditingFlagKey] = useState<string | null>(null);
  const [formKey, setFormKey] = useState('');
  const [formClassNames, setFormClassNames] = useState<string[]>([]);
  const [currentClassInput, setCurrentClassInput] = useState('');
  const [formIsEnabled, setFormIsEnabled] = useState(true);
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Filtered flags
  const filteredFlags = useMemo(() => {
    if (!searchQuery.trim()) return flags;
    const q = searchQuery.toLowerCase().trim();
    return flags.filter(
      (f) =>
        f.key.toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q)) ||
        f.classNames.some((c) => c.toLowerCase().includes(q))
    );
  }, [flags, searchQuery]);

  const enabledFlagsCount = useMemo(
    () => flags.filter((f) => f.isEnabled).length,
    [flags]
  );

  // Open modal for Create
  const handleOpenAddModal = useCallback(() => {
    setEditingFlagKey(null);
    setFormKey('');
    setFormClassNames([]);
    setCurrentClassInput('');
    setFormIsEnabled(true);
    setFormDescription('');
    setFormError(null);
    setIsModalOpen(true);
  }, []);

  // Open modal for Edit
  const handleOpenEditModal = useCallback((flag: FeatureFlag) => {
    setEditingFlagKey(flag.key);
    setFormKey(flag.key);
    setFormClassNames([...flag.classNames]);
    setCurrentClassInput('');
    setFormIsEnabled(flag.isEnabled);
    setFormDescription(flag.description || '');
    setFormError(null);
    setIsModalOpen(true);
  }, []);

  // Add class tag to form
  const handleAddClassTag = useCallback(() => {
    const norm = normalizeClassName(currentClassInput);
    if (norm && !formClassNames.includes(norm)) {
      setFormClassNames((prev) => [...prev, norm]);
      setCurrentClassInput('');
    }
  }, [currentClassInput, formClassNames]);

  const handleRemoveClassTag = useCallback((clsToRemove: string) => {
    setFormClassNames((prev) => prev.filter((c) => c !== clsToRemove));
  }, []);

  const handleClassInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      handleAddClassTag();
    }
  };

  // Submit Modal
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = formKey.trim();
    if (!cleanKey) {
      setFormError('Flag key is required.');
      return;
    }

    // Include any pending text in the class input
    const finalClasses = [...formClassNames];
    const pendingNorm = normalizeClassName(currentClassInput);
    if (pendingNorm && !finalClasses.includes(pendingNorm)) {
      finalClasses.push(pendingNorm);
    }

    if (finalClasses.length === 0) {
      setFormError('At least one CSS class name is required.');
      return;
    }

    if (editingFlagKey) {
      // Editing existing
      const ok = updateFlag(editingFlagKey, {
        classNames: finalClasses,
        isEnabled: formIsEnabled,
        description: formDescription,
      });
      if (!ok) {
        setFormError('Failed to update feature flag.');
        return;
      }
    } else {
      // Creating new
      const existing = flags.some((f) => f.key.toLowerCase() === cleanKey.toLowerCase());
      if (existing) {
        setFormError(`A flag with key "${cleanKey}" already exists.`);
        return;
      }
      const ok = addFlag({
        key: cleanKey,
        classNames: finalClasses,
        isEnabled: formIsEnabled,
        description: formDescription,
      });
      if (!ok) {
        setFormError('Failed to create feature flag.');
        return;
      }
    }

    setIsModalOpen(false);
  };

  // Quick Preset Add
  const handleAddPreset = (preset: (typeof DEFAULT_FEATURE_FLAG_PRESETS)[0]) => {
    const existing = flags.find((f) => f.key.toLowerCase() === preset.key.toLowerCase());
    if (existing) {
      // Toggle it or ensure it exists
      toggleFlag(existing.key);
    } else {
      addFlag({
        key: preset.key,
        classNames: preset.classNames,
        isEnabled: preset.isEnabled,
        description: preset.description,
      });
    }
  };

  // Export Flags to JSON file
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(flags, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `media_cataloger_feature_flags_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import Flags from JSON
  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          let count = 0;
          for (const item of parsed) {
            if (item.key && Array.isArray(item.classNames)) {
              addFlag({
                key: item.key,
                classNames: item.classNames,
                isEnabled: Boolean(item.isEnabled),
                description: item.description || '',
              });
              count++;
            }
          }
          alert(`Successfully imported ${count} feature flag(s).`);
        } else {
          alert('Invalid JSON file format. Expected an array of feature flags.');
        }
      } catch (err) {
        alert('Failed to read or parse JSON file: ' + err);
      }
    };
    input.click();
  };

  // Suggested common class names in the app
  const COMMON_APP_CLASSES = [
    'btn-logs-toggle',
    'theme-switcher-container',
    'lang-switcher-wrap',
    'status-badge',
    'header-brand-wrap',
    'gallery-filter-bar',
    'view-mode-selector',
    'gallery-refresh-btn',
    'execution-controls-panel',
    'pipeline-sync-section',
    'test-feature-alpha',
    'test-feature-beta',
    'test-feature-gamma',
  ];

  return (
    <div className="admin-panel-container" id="admin-panel-root">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header-title-wrap">
          <div className="admin-header-icon" aria-hidden="true">🛡️</div>
          <div className="admin-header-text">
            <h2>{t('adminTitle')}</h2>
            <p>{t('adminSubtitle')}</p>
          </div>
        </div>

        <div className="admin-header-badges">
          <div className="admin-stat-pill active" title="Total feature flags count">
            <span>⚡ Flags:</span>
            <strong>{flags.length}</strong>
          </div>
          <div className="admin-stat-pill" title="Enabled flags count">
            <span>✓ Active:</span>
            <strong>{enabledFlagsCount}</strong>
          </div>
          {disabledClassesCount > 0 && (
            <div className="admin-stat-pill warning" title="CSS classes currently hidden">
              <span>🚫 Hidden Classes:</span>
              <strong>{disabledClassesCount}</strong>
            </div>
          )}
        </div>
      </div>

      {/* 1. Feature Flags Management Dropdown / Accordion Section */}
      <div className="admin-card" id="admin-feature-flags-card">
        <div
          className={`admin-card-header-collapsible ${isFlagsSectionOpen ? 'open' : ''}`}
          onClick={() => setIsFlagsSectionOpen((prev) => !prev)}
          role="button"
          aria-expanded={isFlagsSectionOpen}
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIsFlagsSectionOpen((prev) => !prev)}
          id="btn-toggle-feature-flags-section"
        >
          <div className="admin-card-title-group">
            <span className="admin-card-title-icon">⚡</span>
            <div>
              <h3>
                {t('featureFlagsSectionTitle')}
                <span className="admin-stat-pill" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                  {flags.length} {flags.length === 1 ? 'flag' : 'flags'}
                </span>
              </h3>
              <p className="admin-card-subtitle">{t('featureFlagsSectionSubtitle')}</p>
            </div>
          </div>

          <div className="admin-card-header-right">
            <button
              type="button"
              className="btn-add-flag"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenAddModal();
              }}
              id="btn-add-feature-flag-header"
              title="Add a new feature toggle"
            >
              <span>+</span>
              <span>{t('btnAddFlag')}</span>
            </button>
            <span className={`accordion-arrow ${isFlagsSectionOpen ? 'open' : ''}`}>▼</span>
          </div>
        </div>

        {isFlagsSectionOpen && (
          <div className="admin-card-body">
            {/* Toolbar: Search, Add, Presets, Export/Import */}
            <div className="flags-toolbar">
              <div className="flags-search-box">
                <span className="flags-search-icon">🔍</span>
                <input
                  type="text"
                  className="flags-search-input"
                  placeholder={t('searchFlagsPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  id="input-search-flags"
                />
              </div>

              <div className="flags-actions-group">
                <button
                  type="button"
                  className="btn-add-flag"
                  onClick={handleOpenAddModal}
                  id="btn-add-feature-flag-toolbar"
                >
                  <span>+</span>
                  <span>{t('btnAddFlag')}</span>
                </button>
                <button
                  type="button"
                  className="btn-admin-secondary"
                  onClick={handleExportJSON}
                  title="Export feature flags to JSON file"
                  id="btn-export-flags"
                >
                  📥 {t('btnExportFlags')}
                </button>
                <button
                  type="button"
                  className="btn-admin-secondary"
                  onClick={handleImportJSON}
                  title="Import feature flags from JSON file"
                  id="btn-import-flags"
                >
                  📤 {t('btnImportFlags')}
                </button>
                <button
                  type="button"
                  className="btn-admin-secondary"
                  onClick={() => {
                    if (window.confirm('Reset all feature flags to default presets?')) {
                      resetToDefaults();
                    }
                  }}
                  title="Reset to default presets"
                  id="btn-reset-flags"
                >
                  🔄 {t('btnResetFlags')}
                </button>
                {flags.length > 0 && (
                  <button
                    type="button"
                    className="btn-admin-secondary"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to clear all feature flags?')) {
                        clearAllFlags();
                      }
                    }}
                    title="Clear all flags"
                    id="btn-clear-flags"
                  >
                    🗑️ {t('btnClearAllFlags')}
                  </button>
                )}
              </div>
            </div>

            {/* Quick Presets Bar */}
            <div className="presets-section">
              <div className="presets-header">⚡ {t('quickPresetsTitle')}</div>
              <div className="presets-pills-list">
                {DEFAULT_FEATURE_FLAG_PRESETS.map((preset) => {
                  const existing = flags.find((f) => f.key.toLowerCase() === preset.key.toLowerCase());
                  const isCreated = Boolean(existing);
                  const isEnabled = existing ? existing.isEnabled : false;

                  return (
                    <button
                      key={preset.key}
                      type="button"
                      className="preset-chip-btn"
                      onClick={() => handleAddPreset(preset)}
                      title={preset.description || preset.key}
                      id={`btn-preset-${preset.key}`}
                    >
                      <span>{isCreated ? (isEnabled ? '✓' : '○') : '+'}</span>
                      <span>{preset.description || preset.key}</span>
                      <code style={{ fontSize: '0.72rem', opacity: 0.8 }}>.{preset.classNames[0]}</code>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Feature Flags List */}
            <div className="flags-list-container">
              {filteredFlags.length === 0 ? (
                <div className="flags-empty-state">
                  <div className="flags-empty-icon">🚩</div>
                  <h4>{searchQuery ? t('noFlagsMatchSearch') : t('noFlagsFound')}</h4>
                  <p>
                    {searchQuery
                      ? 'Try clearing or changing your search term.'
                      : 'Create your first feature flag by clicking the "+ Add Feature Flag" button above.'}
                  </p>
                  <button
                    type="button"
                    className="btn-add-flag"
                    onClick={handleOpenAddModal}
                    style={{ margin: '0 auto' }}
                  >
                    + {t('btnAddFlag')}
                  </button>
                </div>
              ) : (
                filteredFlags.map((flag) => {
                  const isEnabled = flag.isEnabled;

                  return (
                    <div
                      key={flag.key}
                      className={`flag-item-card ${isEnabled ? 'enabled' : 'disabled'}`}
                      id={`flag-card-${flag.key}`}
                    >
                      <div className="flag-main-info">
                        <div className="flag-key-row">
                          <span className="flag-key-name" title={`Flag key: ${flag.key}`}>
                            {flag.key}
                          </span>
                          <span
                            className={`flag-status-pill ${isEnabled ? 'enabled' : 'disabled'}`}
                          >
                            {isEnabled ? t('flagEnabled') : t('flagDisabled')}
                          </span>
                        </div>

                        {flag.description && (
                          <p className="flag-description-text">{flag.description}</p>
                        )}

                        <div className="flag-classes-list">
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                            Classes:
                          </span>
                          {flag.classNames.map((cls) => (
                            <span
                              key={cls}
                              className={`class-tag ${isEnabled ? '' : 'disabled-class'}`}
                              title={
                                isEnabled
                                  ? `Class .${cls} is currently visible`
                                  : `Class .${cls} is hidden via display:none`
                              }
                            >
                              .{cls}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flag-actions-wrap">
                        {/* Toggle Switch */}
                        <label
                          className="flag-toggle-switch"
                          title={isEnabled ? 'Click to disable and hide class' : 'Click to enable and show class'}
                        >
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => toggleFlag(flag.key)}
                            id={`toggle-flag-${flag.key}`}
                            aria-label={`Toggle ${flag.key}`}
                          />
                          <span className="flag-toggle-slider" />
                        </label>

                        {/* Edit Button */}
                        <button
                          type="button"
                          className="btn-icon-action"
                          onClick={() => handleOpenEditModal(flag)}
                          title="Edit flag"
                          id={`btn-edit-flag-${flag.key}`}
                          aria-label={`Edit ${flag.key}`}
                        >
                          ✏️
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          className="btn-icon-action danger"
                          onClick={() => {
                            if (window.confirm(`Delete feature flag "${flag.key}"?`)) {
                              removeFlag(flag.key);
                            }
                          }}
                          title="Delete flag"
                          id={`btn-delete-flag-${flag.key}`}
                          aria-label={`Delete ${flag.key}`}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Interactive Live Testing Sandbox */}
      <div className="admin-card" id="admin-sandbox-card">
        <div
          className={`admin-card-header-collapsible ${isSandboxOpen ? 'open' : ''}`}
          onClick={() => setIsSandboxOpen((prev) => !prev)}
          role="button"
          aria-expanded={isSandboxOpen}
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIsSandboxOpen((prev) => !prev)}
          id="btn-toggle-sandbox-section"
        >
          <div className="admin-card-title-group">
            <span className="admin-card-title-icon">🧪</span>
            <div>
              <h3>{t('testSandboxTitle')}</h3>
              <p className="admin-card-subtitle">{t('testSandboxDesc')}</p>
            </div>
          </div>
          <span className={`accordion-arrow ${isSandboxOpen ? 'open' : ''}`}>▼</span>
        </div>

        {isSandboxOpen && (
          <div className="sandbox-content">
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              These test elements demonstrate live class-based toggling. Create or toggle flags with class names{' '}
              <code>test-feature-alpha</code>, <code>test-feature-beta</code>, or <code>test-feature-gamma</code> to see them vanish and reappear instantly!
            </p>

            <div className="sandbox-demo-grid">
              <div className="sandbox-box test-feature-alpha">
                <h5>🟢 Alpha Component</h5>
                <p>Visible when class <code>test-feature-alpha</code> is enabled.</p>
                <span className="sandbox-class-code">.test-feature-alpha</span>
              </div>

              <div className="sandbox-box test-feature-beta">
                <h5>🟣 Beta Component</h5>
                <p>Visible when class <code>test-feature-beta</code> is enabled.</p>
                <span className="sandbox-class-code">.test-feature-beta</span>
              </div>

              <div className="sandbox-box test-feature-gamma">
                <h5>🟡 Gamma Component</h5>
                <p>Visible when class <code>test-feature-gamma</code> is enabled.</p>
                <span className="sandbox-class-code">.test-feature-gamma</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn-admin-secondary"
                onClick={() => {
                  const key = 'test_alpha_feature';
                  const existing = flags.find((f) => f.key === key);
                  if (existing) {
                    toggleFlag(key);
                  } else {
                    addFlag({
                      key,
                      classNames: ['test-feature-alpha'],
                      isEnabled: false,
                      description: 'Test flag for Alpha box',
                    });
                  }
                }}
              >
                ⚡ Toggle Alpha Flag
              </button>

              <button
                type="button"
                className="btn-admin-secondary"
                onClick={() => {
                  const key = 'test_beta_feature';
                  const existing = flags.find((f) => f.key === key);
                  if (existing) {
                    toggleFlag(key);
                  } else {
                    addFlag({
                      key,
                      classNames: ['test-feature-beta'],
                      isEnabled: false,
                      description: 'Test flag for Beta box',
                    });
                  }
                }}
              >
                ⚡ Toggle Beta Flag
              </button>

              <button
                type="button"
                className="btn-admin-secondary"
                onClick={() => {
                  const key = 'test_gamma_feature';
                  const existing = flags.find((f) => f.key === key);
                  if (existing) {
                    toggleFlag(key);
                  } else {
                    addFlag({
                      key,
                      classNames: ['test-feature-gamma'],
                      isEnabled: false,
                      description: 'Test flag for Gamma box',
                    });
                  }
                }}
              >
                ⚡ Toggle Gamma Flag
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. System Health & Storage Overview Section */}
      <div className="admin-card" id="admin-system-health-card">
        <div
          className={`admin-card-header-collapsible ${isSystemStatsOpen ? 'open' : ''}`}
          onClick={() => setIsSystemStatsOpen((prev) => !prev)}
          role="button"
          aria-expanded={isSystemStatsOpen}
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIsSystemStatsOpen((prev) => !prev)}
          id="btn-toggle-system-stats-section"
        >
          <div className="admin-card-title-group">
            <span className="admin-card-title-icon">📊</span>
            <div>
              <h3>{t('systemHealthTitle')}</h3>
              <p className="admin-card-subtitle">{t('systemStorageTitle')}</p>
            </div>
          </div>
          <span className={`accordion-arrow ${isSystemStatsOpen ? 'open' : ''}`}>▼</span>
        </div>

        {isSystemStatsOpen && (
          <div className="stats-grid">
            <div className="stat-box">
              <span className="stat-box-label">Backend Status</span>
              <span className="stat-box-value" style={{ color: statusInfo?.status === 'running' ? '#10b981' : '#818cf8' }}>
                {statusInfo?.status || 'Active'}
              </span>
            </div>

            <div className="stat-box">
              <span className="stat-box-label">Media Files in Index</span>
              <span className="stat-box-value">{mediaFilesCount.toLocaleString()}</span>
            </div>

            <div className="stat-box">
              <span className="stat-box-label">Known Faces in Registry</span>
              <span className="stat-box-value">{facesCount.toLocaleString()}</span>
            </div>

            <div className="stat-box">
              <span className="stat-box-label">Feature Flags Defined</span>
              <span className="stat-box-value">{flags.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Feature Flag Modal */}
      {isModalOpen && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setIsModalOpen(false)}
          role="dialog"
          aria-modal="true"
          id="modal-feature-flag"
        >
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>
                <span>⚡</span>
                <span>{editingFlagKey ? t('modalEditFlagTitle') : t('modalAddFlagTitle')}</span>
              </h3>
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                id="btn-close-flag-modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal}>
              <div className="admin-modal-body">
                {formError && (
                  <div
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#fca5a5',
                      fontSize: '0.85rem',
                    }}
                  >
                    ⚠️ {formError}
                  </div>
                )}

                {/* Key */}
                <div className="admin-form-group">
                  <label className="admin-form-label" htmlFor="input-flag-key">
                    <span>{t('flagKeyLabel')} *</span>
                    <span className="admin-form-hint">Unique identifier (e.g. "hide_logs_btn")</span>
                  </label>
                  <input
                    type="text"
                    id="input-flag-key"
                    className="admin-form-input"
                    placeholder="e.g. hide_logs_btn"
                    value={formKey}
                    onChange={(e) => setFormKey(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                    disabled={Boolean(editingFlagKey)}
                    required
                  />
                </div>

                {/* Class Names Tag Input */}
                <div className="admin-form-group">
                  <label className="admin-form-label">
                    <span>{t('flagClassesLabel')} *</span>
                    <span className="admin-form-hint">Press Enter or comma to add class names</span>
                  </label>

                  <div className="tag-input-container">
                    {formClassNames.map((cls) => (
                      <span key={cls} className="tag-input-tag">
                        .{cls}
                        <button
                          type="button"
                          className="tag-remove-btn"
                          onClick={() => handleRemoveClassTag(cls)}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      className="tag-input-field"
                      placeholder={formClassNames.length === 0 ? "e.g. btn-logs-toggle (press Enter)" : "Add more classes..."}
                      value={currentClassInput}
                      onChange={(e) => setCurrentClassInput(e.target.value)}
                      onKeyDown={handleClassInputKeyDown}
                      id="input-tag-class-name"
                    />
                  </div>

                  {/* Suggestions Chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                      Suggested:
                    </span>
                    {COMMON_APP_CLASSES.filter((c) => !formClassNames.includes(c))
                      .slice(0, 6)
                      .map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            padding: '0.15rem 0.45rem',
                            fontSize: '0.72rem',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            if (!formClassNames.includes(suggestion)) {
                              setFormClassNames((prev) => [...prev, suggestion]);
                            }
                          }}
                        >
                          +{suggestion}
                        </button>
                      ))}
                  </div>
                </div>

                {/* Enabled Switch */}
                <div className="admin-form-group">
                  <label className="admin-form-label">
                    <span>Initial State</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <label className="flag-toggle-switch">
                      <input
                        type="checkbox"
                        checked={formIsEnabled}
                        onChange={(e) => setFormIsEnabled(e.target.checked)}
                        id="input-flag-enabled-modal"
                      />
                      <span className="flag-toggle-slider" />
                    </label>
                    <span style={{ fontSize: '0.88rem', color: formIsEnabled ? '#34d399' : '#fbbf24' }}>
                      {formIsEnabled ? 'Enabled (Class is visible)' : 'Disabled (Class is hidden)'}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div className="admin-form-group">
                  <label className="admin-form-label" htmlFor="input-flag-description">
                    <span>{t('flagDescLabel')}</span>
                  </label>
                  <textarea
                    id="input-flag-description"
                    className="admin-form-textarea"
                    rows={2}
                    placeholder="Optional details or context for this toggle..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="btn-admin-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-add-flag"
                  id="btn-submit-flag-modal"
                >
                  💾 {t('btnSaveFlag')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
