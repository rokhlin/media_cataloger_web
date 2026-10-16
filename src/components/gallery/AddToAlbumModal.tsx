import React, { useState, useEffect } from 'react';
import {
  FolderHeart,
  Plus,
  Check,
  X,
  BookOpen,
  Image as ImageIcon,
  Loader2,
  FolderPlus,
} from 'lucide-react';
import { virtualAlbumService, type VirtualAlbum } from '../../services/virtualAlbumService';
import type { GalleryMediaFile } from '../../models';

export interface AddToAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaFile: GalleryMediaFile | null;
  onAdded?: (album: VirtualAlbum) => void;
}

export const AddToAlbumModal: React.FC<AddToAlbumModalProps> = ({
  isOpen,
  onClose,
  mediaFile,
  onAdded,
}) => {
  const [albums, setAlbums] = useState<VirtualAlbum[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const filePath = mediaFile ? (mediaFile.file_path || mediaFile.filename) : '';
  const filename = mediaFile ? (mediaFile.filename || filePath.split(/[\\/]/).pop() || 'photo') : '';
  const thumbnailSrc = filePath
    ? (mediaFile?.thumbnail_url || `/api/media/thumbnail?path=${encodeURIComponent(filePath)}&size=200`)
    : '';

  const loadAlbums = async () => {
    setLoading(true);
    try {
      const data = await virtualAlbumService.getAlbums();
      setAlbums(data);
    } catch (err) {
      console.warn('Failed to load virtual albums:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAlbums();
      setIsCreatingNew(false);
      setNewTitle('');
      setNewDescription('');
      setStatusMessage(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mediaFile) return null;

  const isFileInAlbum = (album: VirtualAlbum): boolean => {
    if (!filePath) return false;
    const targetNorm = filePath.replace(/\\/g, '/').toLowerCase();
    const targetName = filename.toLowerCase();
    return album.filePaths.some((p) => {
      const norm = p.replace(/\\/g, '/').toLowerCase();
      return norm === targetNorm || norm.endsWith('/' + targetName) || targetNorm.endsWith('/' + norm);
    });
  };

  const handleToggleAlbum = async (album: VirtualAlbum) => {
    if (!filePath) return;
    setProcessingId(album.id);
    setStatusMessage(null);

    const alreadyIn = isFileInAlbum(album);
    try {
      let updated: VirtualAlbum | null = null;
      if (alreadyIn) {
        // Remove from album
        updated = await virtualAlbumService.removeFilesFromAlbum(album.id, [filePath]);
        setStatusMessage({
          text: `Фотография удалена из альбома «${album.title}»`,
          type: 'success',
        });
      } else {
        // Add to album
        updated = await virtualAlbumService.addFilesToAlbum(album.id, [filePath]);
        setStatusMessage({
          text: `Фотография добавлена в альбом «${album.title}»`,
          type: 'success',
        });
        if (updated && onAdded) onAdded(updated);
      }

      if (updated) {
        setAlbums((prev) => prev.map((a) => (a.id === updated!.id ? updated! : a)));
        window.dispatchEvent(new CustomEvent('album_updated', { detail: { albumId: album.id } }));
      }
    } catch (err) {
      console.error('Failed to toggle album file:', err);
      setStatusMessage({
        text: 'Ошибка при обновлении альбома',
        type: 'error',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newTitle.trim() || !filePath) return;
    setProcessingId('new');
    setStatusMessage(null);
    try {
      const created = await virtualAlbumService.createAlbum({
        title: newTitle.trim(),
        description: newDescription.trim(),
        filePaths: [filePath],
      });
      setAlbums((prev) => [created, ...prev]);
      setStatusMessage({
        text: `Альбом «${created.title}» создан и фото добавлено!`,
        type: 'success',
      });
      setIsCreatingNew(false);
      setNewTitle('');
      setNewDescription('');
      if (onAdded) onAdded(created);
      window.dispatchEvent(new CustomEvent('album_updated', { detail: { albumId: created.id } }));
    } catch (err) {
      console.error('Failed to create album:', err);
      setStatusMessage({
        text: 'Не удалось создать альбом',
        type: 'error',
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FolderHeart size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Добавить в альбом</h3>
              <p className="text-xs text-muted-foreground">
                Выберите альбом или создайте новый для этого файла
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Selected Media Preview Bar */}
        <div className="flex items-center gap-3 p-2.5 bg-muted/30 border border-border/60 rounded-xl">
          <div className="w-12 h-12 rounded-lg bg-muted/60 overflow-hidden shrink-0 flex items-center justify-center border border-border/40">
            {thumbnailSrc ? (
              <img
                src={thumbnailSrc}
                alt={filename}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <ImageIcon size={20} className="text-muted-foreground/50" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate" title={filename}>
              {filename}
            </p>
            <p className="text-[11px] text-muted-foreground truncate" title={filePath}>
              {filePath}
            </p>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`p-2.5 rounded-xl text-xs font-medium flex items-center justify-between ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/15 border border-red-500/30 text-red-400'
            }`}
          >
            <span>{statusMessage.text}</span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-muted-foreground hover:text-foreground ml-2"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Albums List */}
        <div className="flex-1 min-h-0 flex flex-col space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">
              Доступные альбомы ({albums.length})
            </span>
            <button
              type="button"
              onClick={() => setIsCreatingNew(!isCreatingNew)}
              className="text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <Plus size={13} />
              <span>{isCreatingNew ? 'Скрыть создание' : 'Создать новый альбом'}</span>
            </button>
          </div>

          {/* Quick Create New Album Box */}
          {isCreatingNew && (
            <div className="p-3.5 bg-muted/40 border border-primary/30 rounded-xl space-y-2.5 animate-in slide-in-from-top-2 duration-150">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <FolderPlus size={14} />
                <span>Новый альбом с этой фотографией</span>
              </div>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Название нового альбома..."
                autoFocus
                className="w-full px-3 py-1.5 bg-card border border-border/70 rounded-lg text-xs outline-none focus:border-primary"
              />
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Описание (необязательно)..."
                className="w-full px-3 py-1.5 bg-card border border-border/70 rounded-lg text-xs outline-none focus:border-primary"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleCreateAndAdd}
                  disabled={!newTitle.trim() || processingId === 'new'}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  {processingId === 'new' && <Loader2 size={12} className="animate-spin" />}
                  <span>Создать и добавить</span>
                </button>
              </div>
            </div>
          )}

          {/* Albums Scroll Area */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 max-h-[280px]">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 size={24} className="animate-spin text-primary mb-2" />
                <span className="text-xs">Загрузка альбомов...</span>
              </div>
            ) : albums.length === 0 ? (
              <div className="p-8 border border-dashed border-border/70 rounded-xl text-center space-y-2">
                <BookOpen size={32} className="mx-auto text-muted-foreground/40" />
                <p className="text-xs font-semibold text-foreground">Пользовательских альбомов пока нет</p>
                <p className="text-[11px] text-muted-foreground">
                  Нажмите «Создать новый альбом» выше, чтобы создать ваш первый альбом.
                </p>
              </div>
            ) : (
              albums.map((album) => {
                const inAlbum = isFileInAlbum(album);
                const isProcessing = processingId === album.id;
                const coverPath = album.filePaths[0];
                const coverThumb = coverPath
                  ? `/api/media/thumbnail?path=${encodeURIComponent(coverPath)}&size=120`
                  : null;

                return (
                  <div
                    key={album.id}
                    onClick={() => !isProcessing && handleToggleAlbum(album)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                      inAlbum
                        ? 'bg-primary/10 border-primary/40 hover:bg-primary/15'
                        : 'bg-muted/20 border-border/60 hover:bg-muted/40 hover:border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-muted/60 overflow-hidden shrink-0 flex items-center justify-center border border-border/40">
                        {coverThumb ? (
                          <img
                            src={coverThumb}
                            alt={album.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <BookOpen size={16} className="text-muted-foreground/60" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">
                          {album.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {album.filePaths.length} фото
                          {album.description && ` • ${album.description}`}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 ml-3">
                      {isProcessing ? (
                        <Loader2 size={16} className="animate-spin text-primary" />
                      ) : inAlbum ? (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-semibold shadow-xs">
                          <Check size={12} strokeWidth={3} />
                          <span>В альбоме</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/80 hover:bg-card text-muted-foreground hover:text-foreground text-[11px] font-semibold transition-colors">
                          <Plus size={12} />
                          <span>Добавить</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end pt-3 border-t border-border/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-card border border-border/80 hover:bg-muted text-foreground transition-colors"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddToAlbumModal;
