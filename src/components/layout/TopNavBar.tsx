import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
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
  ChevronRight,
  LogIn,
  FolderLock,
  Languages,
} from 'lucide-react';
import { cn } from '@/utils';
import { useAuth } from '../../services/authContext';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '@/i18n/LanguageContext';

export interface TopNavBarProps {
  onMenuToggle?: () => void;
  className?: string;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({ onMenuToggle, className }) => {
  const navigate = useNavigate();
  const { currentUser, isAdmin, logout } = useAuth();
  const { themeMode, toggleThemeMode } = useTheme();
  const { language, setLanguage } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Sync search input with URL search param
  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (q !== searchQuery && location.pathname !== '/search') {
      setSearchQuery(q);
    }
  }, [searchParams, location.pathname]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    const trimmed = val.trim();
    const isGallery = location.pathname === '/' || location.pathname === '/photos';

    if (trimmed.length >= 4) {
      if (isGallery) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('q', trimmed);
        setSearchParams(nextParams, { replace: true });
      } else {
        navigate(`/photos?q=${encodeURIComponent(trimmed)}`);
      }
    } else if (trimmed.length === 0) {
      if (isGallery && searchParams.has('q')) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('q');
        setSearchParams(nextParams, { replace: true });
      }
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    const isGallery = location.pathname === '/' || location.pathname === '/photos';
    if (isGallery && searchParams.has('q')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('q');
      setSearchParams(nextParams, { replace: true });
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    const isGallery = location.pathname === '/' || location.pathname === '/photos';
    if (trimmed) {
      if (isGallery) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('q', trimmed);
        setSearchParams(nextParams, { replace: true });
      } else {
        navigate(`/photos?q=${encodeURIComponent(trimmed)}`);
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const token = localStorage.getItem('auth_token');
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);
        const res = await fetch('/api/media/upload', {
          method: 'POST',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        });
        if (!res.ok) {
          console.error('Failed to upload file:', files[i].name);
        } else {
          try {
            const data = await res.json();
            if (data?.file_path && !data?.analysis_triggered) {
              fetch(`/api/analyze-file?file=${encodeURIComponent(data.file_path)}`, {
                method: 'POST',
                headers: {
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
              }).catch(() => {});
            }
          } catch {
            // ignore
          }
        }
      }
      setUploadSuccess(true);
      window.dispatchEvent(new CustomEvent('media_uploaded'));
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const avatarUrl = (currentUser as any)?.avatarUrl || (currentUser as any)?.avatar || localStorage.getItem('user_avatar_url');
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
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Поиск фотографий, людей, мест... (⌘K)"
            aria-label="Поиск по медиатеке"
            className="w-full h-10 pl-10 pr-16 bg-muted/50 hover:bg-muted/70 focus:bg-background border border-border/60 focus:border-primary rounded-full text-sm placeholder:text-muted-foreground/80 text-foreground transition-all duration-200 outline-none focus:ring-2 focus:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"
          />

          {searchQuery ? (
            <button
              type="button"
              onClick={handleClearSearch}
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
        {/* Hidden File Input for Real Media Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {/* Upload CTA Button */}
        <button
          type="button"
          onClick={handleUploadClick}
          disabled={isUploading}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 shadow-xs focus:ring-2 focus:ring-primary/30 cursor-pointer',
            uploadSuccess
              ? 'bg-[#2dc071]'
              : isUploading
                ? 'bg-primary/70 cursor-wait'
                : 'bg-[#23a6f0] hover:bg-[#2091f9] active:bg-[#1c7ed6]'
          )}
          title="Загрузить медиафайлы"
        >
          {uploadSuccess ? (
            <>
              <Check size={16} />
              <span className="hidden sm:inline">Загружено</span>
            </>
          ) : isUploading ? (
            <>
              <UploadCloud size={16} className="animate-bounce" />
              <span className="hidden sm:inline">Загрузка...</span>
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
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(false);
                    navigate('/photos');
                  }}
                  className="w-full text-left p-2.5 rounded-xl bg-muted/40 hover:bg-muted/80 transition-all flex items-start justify-between group cursor-pointer"
                >
                  <div className="space-y-0.5 pr-2">
                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      Индексация завершена
                    </p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Медиафайлы добавлены в общую ленту. Нажмите для перехода к галерее.
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(false);
                    navigate('/duplicates');
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-muted/60 transition-all flex items-start justify-between group cursor-pointer"
                >
                  <div className="space-y-0.5 pr-2">
                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      Обнаружены дубликаты
                    </p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Найдены группы схожих медиафайлов. Нажмите для анализа и очистки.
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Popover / Login Button */}
        {currentUser ? (
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#23a6f0] to-[#2091f9] text-white font-bold text-sm flex items-center justify-center shadow-xs hover:ring-2 hover:ring-primary/40 transition-all focus:ring-2 focus:ring-primary overflow-hidden relative"
              aria-label="Профиль пользователя"
              title="Профиль пользователя"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={currentUser.username}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : null}
              <span className="absolute inset-0 flex items-center justify-center">
                {userInitial}
              </span>
            </button>

            {/* Profile Menu Dropdown */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-card border border-border/80 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* User details header */}
                <div className="px-4 py-2.5 border-b border-border/50">
                  <p className="font-semibold text-sm text-foreground truncate">
                    {currentUser.username}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {currentUser.displayName || currentUser.username}
                  </p>
                  <div className="mt-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                      {isAdmin ? 'Администратор' : 'Пользователь'}
                    </span>
                  </div>
                </div>

                {/* Language Switcher */}
                <div className="px-4 py-2 border-b border-border/50">
                  <span className="text-[11px] font-semibold text-muted-foreground block mb-1.5 flex items-center gap-1.5">
                    <Languages size={13} />
                    <span>{language === 'ru' ? 'Язык системы' : 'System Language'}</span>
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/70">
                    <button
                      type="button"
                      onClick={() => setLanguage('ru')}
                      className={cn(
                        'py-1 text-xs font-semibold rounded-lg transition-all',
                        language === 'ru'
                          ? 'bg-card text-foreground shadow-xs font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      🇷🇺 RU
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      className={cn(
                        'py-1 text-xs font-semibold rounded-lg transition-all',
                        language === 'en'
                          ? 'bg-card text-foreground shadow-xs font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      🇬🇧 EN
                    </button>
                  </div>
                </div>

                {/* Menu Actions */}
                <div className="py-1">
                  <Link
                    to="/locked-folder"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <FolderLock size={16} className="text-primary" />
                    <span>{language === 'ru' ? 'Личная папка' : 'Personal Folder'}</span>
                  </Link>

                  <Link
                    to="/settings"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Settings size={16} />
                    <span>{language === 'ru' ? 'Настройки учётной записи' : 'Account Settings'}</span>
                  </Link>

                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <ShieldAlert size={16} />
                      <span>{language === 'ru' ? 'Управление сервером' : 'Server Management'}</span>
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
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
            title="Войти в систему"
          >
            <LogIn size={15} />
            <span>Войти</span>
          </Link>
        )}
      </div>
    </header>
    </>
  );
};

export default TopNavBar;
