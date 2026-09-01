import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../services/authContext';
import { useVault } from '../services/vaultContext';

export interface HeaderNavTabsProps {
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  isExpanded?: boolean;
}

export interface NavTabItem {
  id: string;
  icon: string;
  titleKey: 'navMain' | 'navMediaLibrary' | 'navFamilyTree' | 'navAdmin' | 'navVault';
  tooltipKey: 'navMainTooltip' | 'navMediaLibraryTooltip' | 'navFamilyTreeTooltip' | 'navAdminTooltip' | 'navVaultTooltip';
  requiredPermission?: 'admin_panel' | 'manage_faces' | 'vault_access';
}

const NAV_TABS: NavTabItem[] = [
  {
    id: 'main',
    icon: '🏠',
    titleKey: 'navMain',
    tooltipKey: 'navMainTooltip',
  },
  {
    id: 'media_library',
    icon: '📚',
    titleKey: 'navMediaLibrary',
    tooltipKey: 'navMediaLibraryTooltip',
    requiredPermission: 'manage_faces',
  },
  {
    id: 'family_tree',
    icon: '🌳',
    titleKey: 'navFamilyTree',
    tooltipKey: 'navFamilyTreeTooltip',
  },
  {
    id: 'vault',
    icon: '🔒',
    titleKey: 'navVault',
    tooltipKey: 'navVaultTooltip',
    requiredPermission: 'vault_access',
  },
  {
    id: 'admin',
    icon: '🛡️',
    titleKey: 'navAdmin',
    tooltipKey: 'navAdminTooltip',
    requiredPermission: 'admin_panel',
  },
];

export default function HeaderNavTabs({
  activeTab = 'main',
  onSelectTab,
  isExpanded = true,
}: HeaderNavTabsProps) {
  const { t } = useLanguage();
  const { hasPermission, isAdmin } = useAuth();
  const { isUnlocked } = useVault();

  return (
    <nav
      className={`app-side-nav ${isExpanded ? 'expanded' : 'collapsed'}`}
      aria-label="Main Navigation"
      id="side-nav-container"
    >
      <div className="side-nav-list">
        {NAV_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const tabTitle = t(tab.titleKey as any) || tab.id;
          const tabTooltip = t(tab.tooltipKey as any) || tabTitle;
          const isRestricted = tab.requiredPermission && !isAdmin && !hasPermission(tab.requiredPermission);
          const icon = tab.id === 'vault' && isUnlocked ? '🔓' : tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              className={`side-nav-tab-btn header-nav-tab-btn ${isActive ? 'active' : ''} ${isExpanded ? 'with-title' : 'icon-only'} ${isRestricted ? 'nav-restricted' : ''}`}
              onClick={() => onSelectTab && onSelectTab(tab.id)}
              id={`tab-btn-${tab.id.replace('_', '-')}`}
              title={isRestricted ? `${tabTooltip} (${t('authLoginRequired' as any) || 'Restricted'})` : tabTooltip}
              aria-label={tabTitle}
            >
              <span className="tab-btn-icon" aria-hidden="true">{icon}</span>
              {isExpanded && (
                <span className="tab-btn-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span>{tabTitle}</span>
                  {isRestricted && <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>🔒</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

