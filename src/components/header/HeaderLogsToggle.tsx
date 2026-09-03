import { useLanguage } from '../../i18n/LanguageContext';

export interface HeaderLogsToggleProps {
  showLogs?: boolean;
  onToggleLogs?: () => void;
}

export default function HeaderLogsToggle({ showLogs = false, onToggleLogs }: HeaderLogsToggleProps) {
  const { t } = useLanguage();

  return (
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
  );
}

export { HeaderLogsToggle };
