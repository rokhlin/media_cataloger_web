import React, { useState, useEffect, useMemo } from 'react';
import { Heart, Play, Share2, Video, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useFavorites } from '../../services/favoritesService';
import { mediaCacheService } from '../../services/mediaCacheService';
import type { GalleryMediaFile } from '../../models';
import MediaViewerModal from '../gallery/MediaViewerModal';

export const FavoritesScreen: React.FC = () => {
  const navigate = useNavigate();
  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const [allFiles, setAllFiles] = useState<GalleryMediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<GalleryMediaFile | null>(null);

  const loadMedia = async () => {
    setLoading(true);
    try {
      let files = mediaCacheService.getAll();
      if (files.length === 0) {
        await mediaCacheService.fetchChunk({ offset: 0, limit: 1000 });
        files = mediaCacheService.getAll();
      }
      setAllFiles(files);
    } catch (e) {
      console.warn('Failed to load media for favorites:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, []);

  const favoriteFiles = useMemo(() => {
    return allFiles.filter((file) => {
      const key = file.file_path || file.filename;
      return isFavorite(key);
    });
  }, [allFiles, favorites, isFavorite]);

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
            Все фотографии и видеозаписи, отмеченные значком избранного ({favoriteFiles.length} файлов).
          </p>
        </div>

        {favoriteFiles.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedFile(favoriteFiles[0])}
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
              <span>Поделиться</span>
            </button>
          </div>
        )}
      </div>

      {/* Empty State */}
      {!loading && favoriteFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-card/40 border border-dashed border-border/80 rounded-3xl">
          <div className="w-16 h-16 rounded-2xl bg-[#e74040]/10 text-[#e74040] flex items-center justify-center mb-4">
            <Heart className="h-8 w-8 fill-[#e74040]/20" />
          </div>
          <h2 className="text-lg font-bold text-foreground">В избранном пока ничего нет</h2>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-6">
            Нажимайте на значок сердечка в ленте фотографий или в просмотрщике, чтобы быстро находить любимые моменты.
          </p>
          <Link
            to="/photos"
            className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs inline-flex items-center gap-2"
          >
            <span>Перейти в галерею</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        /* Favorites Media Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {favoriteFiles.map((file) => {
            const filePathOrName = file.file_path || file.filename || '';
            const thumbnailUrl = file.thumbnail_url || `/api/media/thumbnail?path=${encodeURIComponent(filePathOrName)}&size=360`;

            return (
              <div
                key={filePathOrName}
                onClick={() => setSelectedFile(file)}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-card border border-border/70 shadow-xs hover:shadow-md transition-all cursor-pointer"
              >
                <img
                  src={thumbnailUrl}
                  alt={file.filename}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlMGUwZTAiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iIzk5OSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTRweCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFRodW1iPC90ZXh0Pjwvc3ZnPg==';
                  }}
                />

                {file.is_video && (
                  <div className="absolute top-2 left-2 bg-black/60 text-white p-1 rounded-sm backdrop-blur-sm z-10">
                    <Video size={14} />
                  </div>
                )}

                {/* Top-Right Heart Badge / Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(filePathOrName);
                  }}
                  className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-[#e74040] hover:scale-110 transition-transform"
                  title="Удалить из избранного"
                  aria-label="Удалить из избранного"
                >
                  <Heart size={14} className="fill-[#e74040]" />
                </button>

                {/* Bottom Metadata Banner on Hover */}
                <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <p className="font-semibold truncate">{file.filename}</p>
                  <p className="text-[10px] text-white/80">
                    {file.media_date || file.capture_date || ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedFile && (
        <MediaViewerModal
          isOpen={true}
          mediaFile={selectedFile}
          onClose={() => setSelectedFile(null)}
          currentIndex={favoriteFiles.indexOf(selectedFile)}
          totalFiles={favoriteFiles.length}
          onPrev={() => {
            const idx = favoriteFiles.indexOf(selectedFile);
            if (idx > 0) setSelectedFile(favoriteFiles[idx - 1]);
          }}
          onNext={() => {
            const idx = favoriteFiles.indexOf(selectedFile);
            if (idx < favoriteFiles.length - 1) setSelectedFile(favoriteFiles[idx + 1]);
          }}
          hasPrev={favoriteFiles.indexOf(selectedFile) > 0}
          hasNext={favoriteFiles.indexOf(selectedFile) < favoriteFiles.length - 1}
          onRefresh={loadMedia}
          onMediaUpdated={(updated) => {
            setSelectedFile(updated);
            mediaCacheService.upsert(updated);
            loadMedia();
          }}
          onNavigateToDuplicates={() => navigate('/duplicates')}
        />
      )}
    </div>
  );
};

export default FavoritesScreen;
