import { useState, useRef, useEffect } from 'react';
import type { StatusInfo } from '../models';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';

interface HeaderProps {
  statusInfo?: StatusInfo;
  onOpenSettings?: () => void;
  onOpenAppearanceSettings?: () => void;
  showLogs?: boolean;
  onToggleLogs?: () => void;
  isScanning?: boolean;
  scannedFilesCount?: number;
  currentLoadingFilename?: string | null;
  isNavExpanded?: boolean;
  onToggleNavExpanded?: () => void;
}

export default function Header({
  statusInfo,
  onOpenSettings,
  onOpenAppearanceSettings,
  showLogs = false,
  onToggleLogs,
  isScanning = false,
  scannedFilesCount = 0,
  currentLoadingFilename = null,
  isNavExpanded = true,
  onToggleNavExpanded,
}: HeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const { themeId, themeMode, activeTheme, presets, customThemes, setThemeId, toggleThemeMode } = useTheme();
  const { status, current_task, error, progress } = statusInfo || {};

  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // Close theme menu on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    }
    if (isThemeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isThemeMenuOpen]);

  let dotClass = 'status-dot active';
  let statusText = t('statusIdle');
  let progressText = '';

  if (isScanning) {
    dotClass = 'status-dot running';
    const countPart = scannedFilesCount > 0 ? ` (${scannedFilesCount.toLocaleString()})` : '';
    const filePart = currentLoadingFilename ? ` • ${currentLoadingFilename}` : '';
    statusText = language === 'ru'
      ? `Сканирование папок источников${countPart}${filePart}`
      : `Scanning input sources${countPart}${filePart}`;
  } else if (status === 'running' || status === 'paused') {
    dotClass = status === 'paused' ? 'status-dot warning' : 'status-dot running';
    const taskName = current_task === 'sync' ? t('taskSync') : t('taskSingle');
    const prefix = status === 'paused' ? t('statusPaused') : t('statusRunning');

    if (progress && progress.total > 0) {
      const fileInfo = progress.current_file ? ` • ${progress.current_file}` : '';
      statusText = `${prefix}: ${taskName}`;
      progressText = `(${progress.current}/${progress.total} - ${progress.percent}%${fileInfo})`;
    } else if (progress && progress.stage) {
      statusText = `${prefix}: ${taskName}`;
      progressText = `${progress.stage}`;
    } else {
      statusText = `${prefix}: ${taskName}...`;
    }
  } else if (status === 'completed') {
    dotClass = 'status-dot active';
    statusText = t('statusCompleted');
  } else if (status === 'stopped') {
    dotClass = 'status-dot';
    statusText = t('statusStopped');
  } else if (status === 'failed') {
    dotClass = 'status-dot error';
    statusText = `${t('statusFailed')}: ${error || 'Unknown error'}`;
  } else if (status === 'checking') {
    dotClass = 'status-dot';
    statusText = t('statusChecking');
  }

  const allPresets = [...presets, ...customThemes];

  // Combine and truncate status text to max 50 chars for clean badge display
  const fullStatusString = progressText ? `${statusText} ${progressText}` : statusText;
  const displayStatus = fullStatusString.length > 50
    ? fullStatusString.slice(0, 49) + '…'
    : fullStatusString;

  const toggleTooltip = isNavExpanded
    ? (t('navCollapse' as any) || 'Collapse navigation')
    : (t('navExpand' as any) || 'Expand navigation');

  return (
    <header className="app-header">
      <div className="header-brand-wrap">
        {/* Bigger Hamburger icon in app-header with height matching logo-section */}
        <button
          type="button"
          className={`nav-hamburger-btn header-hamburger-btn ${isNavExpanded ? 'active' : ''}`}
          onClick={onToggleNavExpanded}
          title={toggleTooltip}
          aria-label="Toggle navigation menu"
          aria-expanded={isNavExpanded}
          id="btn-nav-hamburger"
        >
          <span className="hamburger-icon-bars" aria-hidden="true">
            <span className="bar bar-1"></span>
            <span className="bar bar-2"></span>
            <span className="bar bar-3"></span>
          </span>
        </button>

        <div className="logo-section">
          <h1>{t('appTitle')}</h1>
          <p>{t('appSubtitle')}</p>
        </div>
      </div>

      <div className="header-right-section">
        {/* visual-controls: Theme switcher, Language switcher, Logs toggle, Settings */}
        <div className="visual-controls" id="visual-controls">
          {/* Theme Quick Switcher & Mode Toggle */}
          <div className="theme-switcher-container" ref={themeMenuRef}>
            <div className="theme-switcher-group">
              <button
                type="button"
                className="btn-theme-quick-toggle"
                onClick={toggleThemeMode}
                title={t('themeToggleDarkLight')}
                id="btn-theme-quick-toggle"
                aria-label={t('themeToggleDarkLight')}
              >
                {themeMode === 'dark' ? '🌙' : '☀️'}
              </button>

              <button
                type="button"
                className={`btn-theme-menu-trigger ${isThemeMenuOpen ? 'active' : ''}`}
                onClick={() => setIsThemeMenuOpen((prev) => !prev)}
                title={t('themeQuickSwitchTooltip')}
                id="btn-theme-menu-trigger"
                aria-expanded={isThemeMenuOpen}
              >
                <span className="theme-trigger-icon">{activeTheme.icon || '🎨'}</span>
                <span className="theme-trigger-swatch" style={{ background: activeTheme.tokens.primaryGradient }} />
                <span className="theme-trigger-arrow">{isThemeMenuOpen ? '▲' : '▼'}</span>
              </button>
            </div>

            {isThemeMenuOpen && (
              <div className="theme-dropdown-menu" role="menu">
                <div className="theme-dropdown-header">
                  <span>{t('themePresetsLabel')}</span>
                </div>
                <div className="theme-dropdown-list">
                  {allPresets.map((preset) => {
                    const isSelected = preset.id === themeId;
                    const name = 'nameKey' in preset ? t(preset.nameKey as any) : preset.name;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`theme-dropdown-item ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          setThemeId(preset.id);
                          setIsThemeMenuOpen(false);
                        }}
                      >
                        <span className="theme-item-icon">{preset.icon || '🎨'}</span>
                        <span className="theme-item-name">{name}</span>
                        <div className="theme-item-preview-dots">
                          {preset.previewColors.map((color, idx) => (
                            <span
                              key={idx}
                              className="theme-preview-dot"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        {isSelected && <span className="theme-item-check">✓</span>}
                      </button>
                    );
                  })}
                </div>
                {onOpenAppearanceSettings && (
                  <div className="theme-dropdown-footer">
                    <button
                      type="button"
                      className="btn-dropdown-customize"
                      onClick={() => {
                        setIsThemeMenuOpen(false);
                        onOpenAppearanceSettings();
                      }}
                    >
                      🎨 {t('customThemeBuilder')}...
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Language Switcher Button */}
          <div
            className="lang-switcher-wrap"
            role="group"
            aria-label={t('langSwitchTooltip')}
            title={t('langSwitchTooltip')}
          >
            <button
              type="button"
              className={`lang-btn ${language === 'en' ? 'active' : ''}`}
              onClick={() => setLanguage('en')}
              id="btn-lang-en"
              title="English"
            >
              🇬🇧 EN
            </button>
            <button
              type="button"
              className={`lang-btn ${language === 'ru' ? 'active' : ''}`}
              onClick={() => setLanguage('ru')}
              id="btn-lang-ru"
              title="Русский"
            >
              🇷🇺 RU
            </button>
          </div>

          {/* Logs toggle button */}
          <button
            className={`btn btn-secondary btn-logs-toggle ${showLogs ? 'active' : ''}`}
            onClick={onToggleLogs}
            id="btn-toggle-logs"
            type="button"
            title={showLogs ? t('btnHideLogs') : t('btnShowLogs')}
            style={{ padding: '0.55rem 1.1rem', fontSize: '0.88rem' }}
          >
            📋 {showLogs ? t('btnHideLogs') : t('btnShowLogs')}
          </button>

          {/* Settings button */}
          <button
            className="btn btn-secondary"
            onClick={onOpenSettings}
            id="btn-open-settings"
            type="button"
            style={{ padding: '0.55rem 1.2rem', fontSize: '0.88rem' }}
          >
            ⚙️ {t('btnSettings')}
          </button>
        </div>

        {/* status-badge placed under visual-controls, aligned right, max length: 50 chars */}
        <div className="status-badge" id="status-panel" title={fullStatusString}>
          <span className={dotClass} id="status-dot"></span>
          <span id="status-text">{displayStatus}</span>
        </div>
      </div>
    </header>
  );
}
