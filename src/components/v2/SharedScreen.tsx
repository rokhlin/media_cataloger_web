import React, { useState, useEffect } from 'react';
import { Share2, Plus, Copy, Check, ExternalLink, Calendar, Tag, Trash2, X, Image as ImageIcon, Globe } from 'lucide-react';
import { virtualAlbumService, type VirtualAlbum } from '../../services/virtualAlbumService';
import { mediaCacheService } from '../../services/mediaCacheService';
import { useAuth } from '../../services/authContext';
import type { GalleryMediaFile } from '../../models';

export const SharedScreen: React.FC = () => {
  const { currentUser } = useAuth();
  const [albums, setAlbums] = useState<VirtualAlbum[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [availableMedia, setAvailableMedia] = useState<GalleryMediaFile[]>([]);
  
  // Create Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTags, setNewTags] = useState('');
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    virtualAlbumService.setUserId(currentUser?.username);
    loadAlbums();
    const media = mediaCacheService.getAll();
    if (media.length > 0) {
      setAvailableMedia(media.slice(0, 50));
    } else {
      mediaCacheService.fetchChunk({ offset: 0, limit: 50 }).then((res) => {
        setAvailableMedia(res.files || []);
      });
    }
  }, [currentUser]);

  const loadAlbums = async () => {
    const list = await virtualAlbumService.getAlbums();
    setAlbums(list);
  };

  const handleCopy = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleShare = async (album: VirtualAlbum) => {
    if (album.isPublic && album.shareToken) {
      await virtualAlbumService.revokeShareLink(album.id);
    } else {
      await virtualAlbumService.generateShareLink(album.id);
    }
    loadAlbums();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Удалить этот альбом?')) {
      await virtualAlbumService.deleteAlbum(id);
      loadAlbums();
    }
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsSubmitting(true);

    try {
      const tagsArray = newTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const created = await virtualAlbumService.createAlbum({
        title: newTitle.trim(),
        description: newDescription.trim(),
        tags: tagsArray,
        filePaths: selectedPaths.length > 0 ? selectedPaths : availableMedia.slice(0, 12).map((m) => m.file_path || m.filename),
      });

      // Automatically generate public link for it
      await virtualAlbumService.generateShareLink(created.id);
      
      setNewTitle('');
      setNewDescription('');
      setNewTags('');
      setSelectedPaths([]);
      setCreateModalOpen(false);
      loadAlbums();
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelectPhoto = (pathStr: string) => {
    if (selectedPaths.includes(pathStr)) {
      setSelectedPaths(selectedPaths.filter((p) => p !== pathStr));
    } else {
      setSelectedPaths([...selectedPaths, pathStr]);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <Share2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-extrabold text-foreground">Общие ссылки и альбомы</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Создавайте виртуальные альбомы и делитесь защищёнными публичными ссылками без регистрации.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-white shadow-xs transition-colors"
        >
          <Plus size={16} />
          <span>Создать альбом</span>
        </button>
      </div>

      {/* Albums List */}
      {albums.length === 0 ? (
        <div className="p-12 text-center bg-card/60 border border-border/80 rounded-3xl space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
            <Share2 size={28} />
          </div>
          <h3 className="font-bold text-base text-foreground">Нет общих альбомов</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            Создайте виртуальный альбом из выбранных фотографий, укажите название и теги, и сгенерируйте публичную ссылку для просмотра без пароля.
          </p>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs"
          >
            <Plus size={14} />
            <span>Создать первый альбом</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {albums.map((album) => {
            const shareUrl = album.shareToken
              ? `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/shared/${album.shareToken}`
              : '';

            return (
              <div
                key={album.id}
                className="bg-card border border-border/70 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs hover:border-primary/40 transition-colors"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-base text-foreground truncate">{album.title}</h3>
                    {album.isPublic ? (
                      <span className="text-[10px] font-semibold bg-[#2dc071]/15 text-[#2dc071] px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                        <Globe size={11} />
                        <span>Публичный доступ</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">
                        Личный
                      </span>
                    )}
                  </div>

                  {album.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{album.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon size={14} className="text-primary" />
                      {album.filePaths.length} фото
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      {new Date(album.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {album.tags && album.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {album.tags.map((t, i) => (
                        <span key={i} className="text-[10px] bg-muted/70 text-muted-foreground px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Tag size={9} />
                          <span>{t}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {album.isPublic && shareUrl && (
                    <div className="pt-2">
                      <p className="text-[11px] text-muted-foreground font-mono truncate bg-muted/50 p-1.5 rounded-lg border border-border/50 select-all">
                        {shareUrl}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
                  {album.isPublic && shareUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleCopy(album.id, shareUrl)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
                      >
                        {copiedId === album.id ? (
                          <>
                            <Check size={14} className="text-[#2dc071]" />
                            <span>Скопировано</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Скопировать</span>
                          </>
                        )}
                      </button>

                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-border/80 hover:bg-muted text-foreground transition-colors"
                      >
                        <ExternalLink size={14} />
                        <span>Открыть</span>
                      </a>
                    </>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => handleToggleShare(album)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {album.isPublic ? 'Отозвать ссылку' : 'Сделать публичным'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(album.id)}
                    className="p-1.5 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Удалить альбом"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Virtual Album Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-border/60 shrink-0">
              <div className="flex items-center gap-2">
                <Share2 size={18} className="text-primary" />
                <h3 className="font-bold text-base text-foreground">Создание виртуального альбома</h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAlbum} className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Название альбома *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Отпуск на море 2026"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Описание альбома
                </label>
                <textarea
                  rows={2}
                  placeholder="Краткое описание для получателей публичной ссылки..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none focus:border-primary resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Теги (через запятую)
                </label>
                <input
                  type="text"
                  placeholder="Семья, Путешествия, Природа"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none focus:border-primary"
                />
              </div>

              {availableMedia.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Выберите фотографии для альбома ({selectedPaths.length} выбрано)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedPaths.length === availableMedia.length) {
                          setSelectedPaths([]);
                        } else {
                          setSelectedPaths(availableMedia.map((m) => m.file_path || m.filename));
                        }
                      }}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      {selectedPaths.length === availableMedia.length ? 'Снять выделение' : 'Выбрать все'}
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1.5 bg-muted/30 border border-border/50 rounded-xl">
                    {availableMedia.map((file) => {
                      const pathStr = file.file_path || file.filename;
                      const isSel = selectedPaths.includes(pathStr);
                      return (
                        <div
                          key={pathStr}
                          onClick={() => toggleSelectPhoto(pathStr)}
                          className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                            isSel ? 'border-primary ring-2 ring-primary/30' : 'border-transparent opacity-80 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={`/api/media/thumbnail/${encodeURIComponent(pathStr)}`}
                            alt={file.filename}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          {isSel && (
                            <div className="absolute top-1 right-1 bg-primary text-white p-0.5 rounded-full shadow-xs">
                              <Check size={10} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newTitle.trim()}
                  className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Создание...' : 'Создать и получить ссылку'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedScreen;
