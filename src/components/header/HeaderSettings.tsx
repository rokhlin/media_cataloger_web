import { useLanguage } from '../../i18n/LanguageContext';

export interface HeaderSettingsProps {
  onOpenSettings?: () => void;
}

export default function HeaderSettings({ onOpenSettings }: HeaderSettingsProps) {
  const { t } = useLanguage();

  return (
    <button
      className="btn btn-secondary"
      onClick={onOpenSettings}
      id="btn-open-settings"
      type="button"
      style={{ padding: '0.55rem 1.2rem', fontSize: '0.88rem' }}
    >
      ⚙️ {t('btnSettings')}
    </button>
  );
}

export { HeaderSettings };
