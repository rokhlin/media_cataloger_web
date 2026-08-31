import { useLanguage } from '../i18n/LanguageContext';

export interface HeaderNavTabsProps {
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  isExpanded?: boolean;
}

export interface NavTabItem {
  id: string;
  icon: string;
  titleKey: 'navMain' | 'navMediaLibrary' | 'navFamilyTree' | 'navAdmin';
  tooltipKey: 'navMainTooltip' | 'navMediaLibraryTooltip' | 'navFamilyTreeTooltip' | 'navAdminTooltip';
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
  },
  {
    id: 'family_tree',
    icon: '🌳',
    titleKey: 'navFamilyTree',
    tooltipKey: 'navFamilyTreeTooltip',
  },
  {
    id: 'admin',
    icon: '🛡️',
    titleKey: 'navAdmin',
    tooltipKey: 'navAdminTooltip',
  },
];

export default function HeaderNavTabs({
  activeTab = 'main',
  onSelectTab,
  isExpanded = true,
}: HeaderNavTabsProps) {
  const { t } = useLanguage();

  return (
    <nav
      className={`app-side-nav ${isExpanded ? 'expanded' : 'collapsed'}`}
      aria-label="Main Navigation"
      id="side-nav-container"
    >
      <div className="side-nav-list">
        {NAV_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const tabTitle = t(tab.titleKey) || tab.id;
          const tabTooltip = t(tab.tooltipKey) || tabTitle;

          return (
            <button
              key={tab.id}
              type="button"
              className={`side-nav-tab-btn header-nav-tab-btn ${isActive ? 'active' : ''} ${isExpanded ? 'with-title' : 'icon-only'}`}
              onClick={() => onSelectTab && onSelectTab(tab.id)}
              id={`tab-btn-${tab.id.replace('_', '-')}`}
              title={tabTooltip}
              aria-label={tabTitle}
            >
              <span className="tab-btn-icon" aria-hidden="true">{tab.icon}</span>
              {isExpanded && <span className="tab-btn-title">{tabTitle}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
