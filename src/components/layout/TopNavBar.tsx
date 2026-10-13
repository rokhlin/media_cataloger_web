import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Menu,
  Search,
  UploadCloud,
  Sun,
  Moon,
  Bell,
  Settings,
  ShieldAlert,
  LogOut,
  X,
  Check,
  Folder,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/utils';
import { useAuth } from '../../services/authContext';
import { useTheme } from '../../theme/ThemeContext';
import FolderConfigModal from '../common/FolderConfigModal';

export interface TopNavBarProps {
  onMenuToggle?: () => void;
  className?: string;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({ onMenuToggle, className }) => {
  const navigate = useNavigate();
  const { currentUser, isAdmin, logout } = useAuth();
  const { themeMode, toggleThemeMode } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Global Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleUploadClick = () => {
    // Simulated upload trigger
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 2500);
  };

  const userInitial = (currentUser?.username || 'U').charAt(0).toUpperCase();

  return (
    <>
      <header
        className={cn(
          'h-16 border-b border-border/80 bg-card/95 backdrop-blur-md px-4 flex items-center justify-between gap-3 sticky top-0 z-30 shrink-0 shadow-xs',
          className
        )}
      >
      {/* Left: Mobile Drawer Trigger */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMenuToggle}
          className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground md:hidden transition-colors"
          aria-label="Открыть меню навигации"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Center: SearchPillInput */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex-1 max-w-xl mx-auto min-w-[180px] relative"
        role="search"
      >
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск фотографий, людей, мест... (⌘K)"
            aria-label="Поиск по медиатеке"
            className="w-full h-10 pl-10 pr-16 bg-muted/50 hover:bg-muted/70 focus:bg-background border border-border/60 focus:border-primary rounded-full text-sm placeholder:text-muted-foreground/80 text-foreground transition-all duration-200 outline-none focus:ring-2 focus:ring-primary/20"
          />

          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-10 p-1 text-muted-foreground hover:text-foreground"
              aria-label="Очистить поиск"
            >
              <X size={14} />
            </button>
          ) : null}

          <div className="absolute right-3.5 hidden sm:flex items-center gap-1 pointer-events-none text-[11px] font-mono text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded border border-border/60">
            <span>⌘K</span>
          </div>
        </div>
      </form>

      {/* Right Cluster: Upload CTA, Theme Toggle, Notifications, User Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Upload CTA Button */}
        <button
          type="button"
          onClick={handleUploadClick}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 shadow-xs focus:ring-2 focus:ring-primary/30',
            uploadSuccess
              ? 'bg-[#2dc071]'
              : 'bg-[#23a6f0] hover:bg-[#2091f9] active:bg-[#1c7ed6]'
          )}
          title="Загрузить медиафайлы"
        >
          {uploadSuccess ? (
            <>
              <Check size={16} />
              <span className="hidden sm:inline">Готово</span>
            </>
          ) : (
            <>
              <UploadCloud size={16} />
              <span className="hidden sm:inline">Загрузить</span>
            </>
          )}
        </button>

        {/* Theme Toggle (Light / Dark) */}
        <button
          type="button"
          onClick={toggleThemeMode}
          className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:ring-2 focus:ring-primary/30"
          aria-label={themeMode === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          title={themeMode === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
        >
          {themeMode === 'dark' ? (
            <Sun size={18} className="text-[#f3cd03]" />
          ) : (
            <Moon size={18} className="text-foreground" />
          )}
        </button>

        {/* Notifications Popover Trigger */}
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors relative focus:ring-2 focus:ring-primary/30"
            aria-label="Уведомления"
            title="Уведомления"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#e74040]" />
          </button>

          {/* Notifications Dropdown */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-card border border-border/80 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-border/50 px-1">
                <span className="font-semibold text-sm text-foreground">Уведомления</span>
                <span className="text-[11px] text-primary cursor-pointer hover:underline">
                  Прочитать все
                </span>
              </div>
              <div className="py-2 space-y-2 text-xs">
                <div className="p-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
                  <p className="font-medium text-foreground">Индексация завершена</p>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    120 новых фотографий добавлены в общую ленту.
                  </p>
                </div>
                <div className="p-2 rounded-lg hover:bg-muted/40 transition-colors">
                  <p className="font-medium text-foreground">Обнаружены дубликаты</p>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    Найдено 14 групп схожих медиафайлов для анализа.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Popover */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#23a6f0] to-[#2091f9] text-white font-bold text-sm flex items-center justify-center shadow-xs hover:ring-2 hover:ring-primary/40 transition-all focus:ring-2 focus:ring-primary"
            aria-label="Профиль пользователя"
            title="Профиль пользователя"
          >
            {userInitial}
          </button>

          {/* Profile Menu Dropdown */}
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-card border border-border/80 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* User details header */}
              <div className="px-4 py-2.5 border-b border-border/50">
                <p className="font-semibold text-sm text-foreground truncate">
                  {currentUser?.username || 'Пользователь'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {currentUser?.displayName || currentUser?.username || 'user@example.local'}
                </p>
                <div className="mt-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                    {isAdmin ? 'Администратор' : 'Пользователь'}
                  </span>
                </div>
              </div>

              {/* Menu Actions */}
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    setFolderModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left"
                >
                  <Folder size={16} className="text-primary" />
                  <span>Настройка папок и источников</span>
                </button>

                <Link
                  to="/onboarding"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Sparkles size={16} className="text-[#f3cd03]" />
                  <span>Мастер настройки (С нуля)</span>
                </Link>

                <Link
                  to="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Settings size={16} />
                  <span>Настройки учётной записи</span>
                </Link>

                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <ShieldAlert size={16} />
                    <span>Управление сервером</span>
                  </Link>
                )}
              </div>

              <div className="border-t border-border/50 my-1" />

              {/* Logout Button */}
              <button
                type="button"
                onClick={async () => {
                  setProfileOpen(false);
                  await logout();
                  navigate('/login');
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#e74040] hover:bg-[#e74040]/10 transition-colors text-left"
              >
                <LogOut size={16} />
                <span>Выход</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

    {/* Folder Configuration Modal */}
    <FolderConfigModal
      isOpen={folderModalOpen}
      onClose={() => setFolderModalOpen(false)}
    />
    </>
  );
};

export default TopNavBar;
