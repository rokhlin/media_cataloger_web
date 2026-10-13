import React, { useState } from 'react';
import { FolderHeart, Plus, Share2, MoreVertical, Image } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AlbumsScreen: React.FC = () => {
  const [albums] = useState([
    {
      id: 1,
      title: 'Горы и походы',
      count: 142,
      coverGradient: 'from-sky-600 to-indigo-900',
      isShared: true,
      lastUpdated: '12 фев 2025',
    },
    {
      id: 2,
      title: 'Красные автомобили',
      count: 28,
      coverGradient: 'from-rose-600 to-red-900',
      isShared: false,
      lastUpdated: '28 янв 2025',
    },
    {
      id: 3,
      title: '2024\'12 — Декабрь',
      count: 85,
      coverGradient: 'from-teal-600 to-emerald-900',
      isShared: true,
      lastUpdated: '31 дек 2024',
    },
    {
      id: 4,
      title: 'Семейный архив',
      count: 310,
      coverGradient: 'from-amber-600 to-orange-900',
      isShared: false,
      lastUpdated: '15 окт 2024',
    },
    {
      id: 5,
      title: 'Летний отпуск 2024',
      count: 215,
      coverGradient: 'from-blue-500 to-cyan-800',
      isShared: true,
      lastUpdated: '20 авг 2024',
    },
  ]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header & New Album Button */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <FolderHeart className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-extrabold text-foreground">Альбомы</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Коллекции и тематические подборки фотографий вашей медиатеки.
          </p>
        </div>

        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-white shadow-xs transition-colors"
        >
          <Plus size={16} />
          <span>Создать альбом</span>
        </button>
      </div>

      {/* Albums Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {albums.map((album) => (
          <Link
            key={album.id}
            to={`/albums/${album.id}`}
            className="group bg-card border border-border/70 hover:border-primary/50 rounded-2xl overflow-hidden flex flex-col transition-all duration-200 shadow-xs hover:shadow-md"
          >
            {/* Album Cover Thumbnail */}
            <div className={`aspect-4/3 w-full bg-gradient-to-br ${album.coverGradient} relative overflow-hidden flex items-center justify-center text-white`}>
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
              <Image size={40} className="opacity-40 group-hover:scale-110 transition-transform duration-300" />

              {/* Shared Badge */}
              {album.isShared && (
                <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 text-white">
                  <Share2 size={12} />
                  <span>Общий</span>
                </div>
              )}
            </div>

            {/* Album Metadata */}
            <div className="p-4 flex flex-col flex-1 justify-between">
              <div>
                <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors truncate">
                  {album.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {album.count} элементов
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                <span>Обновлен {album.lastUpdated}</span>
                <MoreVertical size={14} className="hover:text-foreground" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AlbumsScreen;
