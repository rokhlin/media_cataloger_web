import React, { useState, useEffect } from 'react';
import { FolderHeart, Plus, MoreVertical, Image as ImageIcon, Folder, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getRealAlbums, type CatalogAlbum } from '../../services/albumService';
import FolderConfigModal from '../common/FolderConfigModal';

export const AlbumsScreen: React.FC = () => {
  const [albums, setAlbums] = useState<CatalogAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [folderModalOpen, setFolderModalOpen] = useState(false);

  const loadAlbums = async () => {
    setLoading(true);
    try {
      const real = await getRealAlbums();
      setAlbums(real);
    } catch (e) {
      console.warn('Failed to load albums:', e);
      setAlbums([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlbums();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header & New Album Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <FolderHeart className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-extrabold text-foreground">Альбомы и каталоги</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Коллекции и каталоги медиафайлов вашей медиатеки.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadAlbums}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Обновить каталоги"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Обновить</span>
          </button>

          <button
            type="button"
            onClick={() => setFolderModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-white shadow-xs transition-colors"
          >
            <Plus size={16} />
            <span>Папки медиа</span>
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin mb-3 text-primary" />
          <p className="text-sm">Загрузка каталогов...</p>
        </div>
      ) : albums.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-card/40 border border-dashed border-border/80 rounded-3xl">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Folder className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Нет альбомов или каталогов</h2>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-6">
            Каталоги формируются автоматически из подключенных папок вашей медиатеки. Настройте исходные папки, чтобы структурировать файлы.
          </p>
          <button
            type="button"
            onClick={() => setFolderModalOpen(true)}
            className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs flex items-center gap-2"
          >
            <Plus size={14} />
            <span>Подключить папку</span>
          </button>
        </div>
      ) : (
        /* Albums Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {albums.map((album) => (
            <Link
              key={album.id}
              to={album.path}
              className="group bg-card border border-border/70 hover:border-primary/50 rounded-2xl overflow-hidden flex flex-col transition-all duration-200 shadow-xs hover:shadow-md"
            >
              {/* Album Cover Thumbnail */}
              <div className="aspect-4/3 w-full bg-muted/60 relative overflow-hidden flex items-center justify-center">
                {album.coverUrl ? (
                  <img
                    src={album.coverUrl}
                    alt={album.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <ImageIcon size={40} className="text-muted-foreground/40 group-hover:scale-110 transition-transform duration-300" />
                )}
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
              </div>

              {/* Album Metadata */}
              <div className="p-4 flex flex-col flex-1 justify-between">
                <div>
                  <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors truncate">
                    {album.name}
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
      )}

      <FolderConfigModal
        isOpen={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
      />
    </div>
  );
};

export default AlbumsScreen;
