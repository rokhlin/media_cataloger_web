import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Share2, Image as ImageIcon, Calendar, Tag, Shield, X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { virtualAlbumService, type VirtualAlbum } from '../../services/virtualAlbumService';
import type { GalleryMediaFile } from '../../models';

export const PublicSharedAlbumView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [album, setAlbum] = useState<VirtualAlbum | null>(null);
  const [files, setFiles] = useState<GalleryMediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Не указан ключ общего альбома');
      setIsLoading(false);
      return;
    }

    virtualAlbumService.getSharedAlbumMedia(token)
      .then((res) => {
        if (!res) {
          setError('Альбом не найден или ссылка была отозвана автором.');
        } else {
          setAlbum(res.album);
          setFiles(res.files);
        }
      })
      .catch((err) => {
        setError('Ошибка при загрузке альбома: ' + err.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs text-muted-foreground">Загрузка общего альбома...</p>
        </div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-foreground font-sans">
        <div className="max-w-md w-full bg-card border border-border/80 rounded-3xl p-8 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center mx-auto">
            <Shield size={24} />
          </div>
          <h2 className="text-lg font-bold">Доступ ограничен</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {error || 'Альбом не найден или был удалён.'}
          </p>
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-block px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs"
            >
              Войти в Media Cataloger
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activePhoto = viewerIndex !== null && files[viewerIndex] ? files[viewerIndex] : null;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      {/* Public View Header */}
      <header className="border-b border-border/80 bg-card/95 backdrop-blur-md sticky top-0 z-20 px-4 sm:px-8 py-4 shadow-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                <Share2 size={11} />
                <span>Общий альбом</span>
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {files.length} {files.length === 1 ? 'фото' : 'фотографий'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mt-1 tracking-tight">
              {album.title}
            </h1>
            {album.description && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                {album.description}
              </p>
            )}
            {album.tags && album.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {album.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-lg flex items-center gap-1 border border-border/60"
                  >
                    <Tag size={10} className="text-primary" />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 mr-2">
              <Calendar size={13} />
              <span>{new Date(album.createdAt).toLocaleDateString()}</span>
            </span>
            <Link
              to="/login"
              className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground border border-border/70 text-xs font-semibold rounded-xl transition-colors"
            >
              Войти
            </Link>
          </div>
        </div>
      </header>

      {/* Album Photo Grid */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8">
        {files.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground bg-card/50 border border-border/60 rounded-3xl">
            <ImageIcon size={36} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-semibold">В этом альбоме пока нет фотографий</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {files.map((file, idx) => (
              <div
                key={file.file_path || file.filename || idx}
                onClick={() => setViewerIndex(idx)}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-muted border border-border/60 hover:border-primary transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md"
              >
                <img
                  src={`/api/media/thumbnail/${encodeURIComponent(file.file_path || file.filename)}`}
                  alt={file.filename}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                  onError={(e) => {
                    // Fallback to placeholder icon
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                  <p className="text-xs text-white truncate font-medium">{file.filename}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Lightbox Viewer for Public Visitors */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between select-none">
          {/* Top Bar */}
          <div className="p-4 flex items-center justify-between text-white bg-gradient-to-b from-black/80 to-transparent">
            <div>
              <p className="font-semibold text-sm truncate max-w-md">{activePhoto.filename}</p>
              <p className="text-[11px] text-white/60">
                {viewerIndex! + 1} из {files.length}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={`/api/media/thumbnail/${encodeURIComponent(activePhoto.file_path || activePhoto.filename)}`}
                download={activePhoto.filename}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Скачать фото"
              >
                <Download size={18} />
              </a>
              <button
                type="button"
                onClick={() => setViewerIndex(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Закрыть"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Main Photo Image */}
          <div className="flex-1 flex items-center justify-center p-4 relative">
            {viewerIndex! > 0 && (
              <button
                type="button"
                onClick={() => setViewerIndex(viewerIndex! - 1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <img
              src={`/api/media/thumbnail/${encodeURIComponent(activePhoto.file_path || activePhoto.filename)}`}
              alt={activePhoto.filename}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            />

            {viewerIndex! < files.length - 1 && (
              <button
                type="button"
                onClick={() => setViewerIndex(viewerIndex! + 1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicSharedAlbumView;
