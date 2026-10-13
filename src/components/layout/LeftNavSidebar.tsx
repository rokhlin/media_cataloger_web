import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Image,
  Search,
  MapPin,
  Smile,
  Users,
  Share2,
  Heart,
  FolderHeart,
  Sliders,
  Archive,
  Lock,
  Trash2,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  HardDrive,
  X,
} from 'lucide-react';
import { cn } from '@/utils';
import { useAuth } from '../../services/authContext';

export interface LeftNavSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

export const LeftNavSidebar: React.FC<LeftNavSidebarProps> = ({
  isOpen = true,
  onClose,
  className,
}) => {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const [albumsExpanded, setAlbumsExpanded] = useState(true);

  const mainRoutes = [
    { label: 'Фото', path: '/', icon: Image },
    { label: 'Поиск', path: '/search', icon: Search },
    { label: 'Карта', path: '/map', icon: MapPin },
    { label: 'Люди', path: '/people', icon: Smile },
    { label: 'Семейное древо', path: '/family-tree', icon: Users },
    { label: 'Общие', path: '/shared', icon: Share2 },
  ];

  const libraryRoutes = [
    { label: 'Избранное', path: '/favorites', icon: Heart },
    { label: 'Утилиты', path: '/duplicates', icon: Sliders },
    { label: 'Архив', path: '/archive', icon: Archive },
    { label: 'Личная папка', path: '/locked-folder', icon: Lock },
    { label: 'Корзина', path: '/trash', icon: Trash2 },
  ];

  const sampleAlbums = [
    { name: 'Горы', count: 12, path: '/albums' },
    { name: 'Красные авто', count: 8, path: '/albums' },
    { name: '2024\'12 — Декабрь', count: 45, path: '/albums' },
  ];

  const renderNavLink = (item: { label: string; path: string; icon: React.ElementType }) => {
    const isRoot = item.path === '/';
    const isActive = isRoot
      ? location.pathname === '/' || location.pathname === '/photos'
      : location.pathname.startsWith(item.path);

    const Icon = item.icon;

    return (
      <NavLink
        key={item.path + item.label}
        to={item.path}
        onClick={onClose}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isActive
            ? 'bg-primary/15 text-primary font-semibold shadow-xs'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
        )}
      >
        <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
        <span className="truncate">{item.label}</span>
      </NavLink>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          role="presentation"
          onClick={onClose}
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-xs transition-opacity duration-300"
        />
      )}

      {/* Main Drawer Container */}
      <aside
        aria-label="Основная навигация"
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 border-r border-border/80 bg-card/95 backdrop-blur-md flex flex-col justify-between transition-transform duration-300 md:static md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          className
        )}
      >
        {/* Top Header / Brand Logo */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="h-16 px-4 flex items-center justify-between border-b border-border/60 shrink-0">
            <NavLink
              to="/"
              onClick={onClose}
              className="flex items-center gap-3 group outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
            >
              {/* Immich / Media Cataloger Pinwheel Icon */}
              <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
                <svg
                  viewBox="0 0 32 32"
                  fill="none"
                  className="w-8 h-8 transition-transform duration-300 group-hover:rotate-45"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M16 16V4C19.3137 4 22 6.68629 22 10C22 13.3137 19.3137 16 16 16Z"
                    fill="#23a6f0"
                  />
                  <path
                    d="M16 16H28C28 19.3137 25.3137 22 22 22C18.6863 22 16 19.3137 16 16Z"
                    fill="#2dc071"
                  />
                  <path
                    d="M16 16V28C12.6863 28 10 25.3137 10 22C10 18.6863 12.6863 16 16 16Z"
                    fill="#f3cd03"
                  />
                  <path
                    d="M16 16H4C4 12.6863 6.68629 10 10 10C13.3137 10 16 12.6863 16 16Z"
                    fill="#e74040"
                  />
                  <circle cx="16" cy="16" r="3" fill="#ffffff" />
                </svg>
              </div>

              <div className="flex flex-col">
                <span className="font-extrabold text-base tracking-tight text-foreground group-hover:text-primary transition-colors">
                  immich
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground -mt-1">
                  Cataloger V2
                </span>
              </div>
            </NavLink>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
              aria-label="Закрыть меню"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Links Scroll Container */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {/* Primary Core Routes */}
            <div className="space-y-1">
              {mainRoutes.map(renderNavLink)}
            </div>

            {/* Section Divider & Label */}
            <div className="pt-4 pb-1 px-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                Библиотека
              </span>
            </div>

            {/* Albums Accordion Row */}
            <div className="space-y-1">
              <div
                className={cn(
                  'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer',
                  location.pathname.startsWith('/albums')
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
                onClick={() => setAlbumsExpanded(!albumsExpanded)}
              >
                <NavLink
                  to="/albums"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onClose) onClose();
                  }}
                  className="flex items-center gap-3.5 flex-1 min-w-0"
                >
                  <FolderHeart className="h-5 w-5 shrink-0" />
                  <span className="truncate">Альбомы</span>
                </NavLink>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAlbumsExpanded(!albumsExpanded);
                  }}
                  className="p-1 text-muted-foreground hover:text-foreground"
                  aria-label={albumsExpanded ? 'Свернуть альбомы' : 'Развернуть альбомы'}
                >
                  {albumsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              </div>

              {/* Nested Album Mini-List */}
              {albumsExpanded && (
                <div className="ml-5 pl-3 border-l border-border/60 space-y-1 py-1">
                  {sampleAlbums.map((album) => (
                    <NavLink
                      key={album.name}
                      to={album.path}
                      onClick={onClose}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <span className="truncate">{album.name}</span>
                      <span className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded-full">
                        {album.count}
                      </span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>

            {/* Library Secondary Routes */}
            <div className="space-y-1">
              {libraryRoutes.map(renderNavLink)}
            </div>

            {/* Admin Route (Role Protected) */}
            {isAdmin && (
              <div className="pt-2">
                {renderNavLink({
                  label: 'Админ панель',
                  path: '/admin',
                  icon: ShieldAlert,
                })}
              </div>
            )}
          </nav>
        </div>

        {/* Footer Area: Storage Quota & Server Health Pill */}
        <div className="p-3 border-t border-border/60 bg-muted/20 shrink-0 space-y-3">
          {/* Storage Usage Widget */}
          <div className="bg-card/70 border border-border/50 rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <HardDrive size={13} className="text-primary" />
                Хранилище
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                25.5 / 100 GiB
              </span>
            </div>

            {/* Storage Meter Bar */}
            <div
              role="meter"
              aria-label="Использование дискового хранилища"
              aria-valuenow={25.5}
              aria-valuemin={0}
              aria-valuemax={100}
              className="w-full h-2 bg-muted/60 rounded-full overflow-hidden flex"
            >
              {/* Photos slice (blue) */}
              <div
                className="h-full bg-[#23a6f0]"
                style={{ width: '20%' }}
                title="Фотографии: 20 GiB"
              />
              {/* Videos slice (accent/yellow) */}
              <div
                className="h-full bg-[#f3cd03]"
                style={{ width: '5.5%' }}
                title="Видео: 5.5 GiB"
              />
            </div>
          </div>

          {/* Server Status Pill */}
          <div className="flex items-center justify-between px-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2dc071] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2dc071]" />
              </span>
              <span className="text-muted-foreground text-[11px]">Сервер в сети</span>
            </div>
            <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded">
              v3.3.1
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default LeftNavSidebar;
