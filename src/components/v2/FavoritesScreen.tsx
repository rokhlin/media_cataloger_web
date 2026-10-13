import React, { useState } from 'react';
import { Heart, Play, Share2, Image as ImageIcon } from 'lucide-react';

export const FavoritesScreen: React.FC = () => {
  const [favoriteItems] = useState(
    Array.from({ length: 12 }).map((_, i) => ({
      id: i + 1,
      title: `Favorite_IMG_${2000 + i}.JPG`,
      date: '14 февраля 2025',
      color: ['from-rose-500 to-pink-700', 'from-amber-500 to-orange-700', 'from-cyan-500 to-blue-700', 'from-purple-500 to-indigo-700'][i % 4],
    }))
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <Heart className="h-6 w-6 text-[#e74040] fill-[#e74040]" />
            <h1 className="text-2xl font-extrabold text-foreground">Избранное</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Все фотографии и видеозаписи, отмеченные значком избранного ({favoriteItems.length} файлов).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-border/80 bg-card hover:bg-muted text-foreground transition-colors"
          >
            <Play size={14} className="text-primary fill-primary" />
            <span>Слайд-шоу</span>
          </button>

          <button
            type="button"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-white shadow-xs transition-colors"
          >
            <Share2 size={14} />
            <span>Поделиться избранным</span>
          </button>
        </div>
      </div>

      {/* Favorites Media Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {favoriteItems.map((item) => (
          <div
            key={item.id}
            className="group relative aspect-square rounded-2xl overflow-hidden bg-card border border-border/70 shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <div className={`absolute inset-0 bg-gradient-to-tr ${item.color} opacity-85 group-hover:scale-105 transition-transform duration-300 flex items-center justify-center text-white/40`}>
              <ImageIcon size={32} />
            </div>

            {/* Top-Right Heart Badge */}
            <div className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-[#e74040] fill-[#e74040]">
              <Heart size={14} className="fill-[#e74040]" />
            </div>

            {/* Bottom Metadata Banner on Hover */}
            <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <p className="font-semibold truncate">{item.title}</p>
              <p className="text-[10px] text-white/80">{item.date}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FavoritesScreen;
