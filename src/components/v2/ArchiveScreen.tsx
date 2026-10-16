import React from 'react';
import { Archive, Undo2, Image as ImageIcon } from 'lucide-react';

export const ArchiveScreen: React.FC = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <Archive className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-extrabold text-foreground">Архив</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Архивированные медиафайлы скрыты из главной ленты, но сохраняются в альбомах и поиске.
          </p>
        </div>
      </div>

      {/* Sample Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="group relative aspect-square rounded-2xl overflow-hidden bg-card border border-border/70 shadow-xs hover:border-primary transition-all cursor-pointer"
          >
            <div className="w-full h-full bg-gradient-to-tr from-slate-600 to-slate-800 flex items-center justify-center text-white/40">
              <ImageIcon size={32} />
            </div>

            <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-between">
              <span className="truncate">ARCHIVE_{i + 1}.JPG</span>
              <button
                type="button"
                className="p-1 rounded bg-white/20 hover:bg-white/40 text-white"
                title="Разархивировать"
              >
                <Undo2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArchiveScreen;
