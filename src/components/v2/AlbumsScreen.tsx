import React, { useState, useEffect } from 'react';
import {
  FolderHeart,
  Plus,
  MoreVertical,
  Image as ImageIcon,
  Folder,
  RefreshCw,
  BookOpen,
  Check,
  X,
  Trash2,
  Edit2,
  ExternalLink,
  Search,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getRealAlbums, type CatalogAlbum } from '../../services/albumService';
import { virtualAlbumService, type VirtualAlbum } from '../../services/virtualAlbumService';
import { mediaCacheService } from '../../services/mediaCacheService';
import type { GalleryMediaFile } from '../../models';
import FolderConfigModal from '../common/FolderConfigModal';

export const AlbumsScreen: React.FC = () => {
  const [folderAlbums, setFolderAlbums] = useState<CatalogAlbum[]>([]);
  const [virtualAlbums, setVirtualAlbums] = useState<VirtualAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [folderModalOpen, setFolderModalOpen] = useState(false);

  // New Album Creation Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [createSearch, setCreateSearch] = useState('');
  const [availablePhotos, setAvailablePhotos] = useState<GalleryMediaFile[]>([]);
  const [selectedPhotoPaths, setSelectedPhotoPaths] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Edit Album Modal State
  const [editingAlbum, setEditingAlbum] = useState<VirtualAlbum | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPhotoPaths, setEditPhotoPaths] = useState<string[]>([]);
  const [showAddSection, setShowAddSection] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [photosToAdd, setPhotosToAdd] = useState<string[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  const loadAllAlbums = async () => {
    setLoading(true);
    try {
      const [real, virtual] = await Promise.all([
        getRealAlbums().catch(() => []),
        virtualAlbumService.getAlbums().catch(() => []),
      ]);
      setFolderAlbums(real);
      setVirtualAlbums(virtual);
    } catch (e) {
      console.warn('Failed to load albums:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAlbums();
    ensureAvailablePhotosLoaded();
  }, []);

  const ensureAvailablePhotosLoaded = async (): Promise<GalleryMediaFile[]> => {
    let all = mediaCacheService.getAll();
    if (all.length === 0) {
      setLoadingPhotos(true);
      try {
        await mediaCacheService.init();
        all = mediaCacheService.getAll();
        if (all.length === 0) {
          const chunk = await mediaCacheService.fetchChunk({ offset: 0, limit: 1000 });
          all = chunk.files || [];
        }
      } catch (err) {
        console.warn('Failed to prefetch media for albums:', err);
      } finally {
        setLoadingPhotos(false);
      }
    }
    setAvailablePhotos(all);
    return all;
  };

  const handleOpenCreateModal = async () => {
    setNewTitle('');
    setNewDescription('');
    setCreateSearch('');
    setSelectedPhotoPaths([]);
    await ensureAvailablePhotosLoaded();
    setCreateModalOpen(true);
  };

  const toggleSelectPhoto = (filePath: string) => {
    setSelectedPhotoPaths((prev) =>
      prev.includes(filePath) ? prev.filter((p) => p !== filePath) : [...prev, filePath]
    );
  };

  const handleCreateAlbum = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await virtualAlbumService.createAlbum({
        title: newTitle.trim(),
        description: newDescription.trim(),
        filePaths: selectedPhotoPaths,
      });
      setCreateModalOpen(false);
      await loadAllAlbums();
    } catch (err) {
      console.error('Failed to create virtual album:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEditAlbum = async (album: VirtualAlbum, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setEditingAlbum(album);
    setEditTitle(album.title);
    setEditDescription(album.description || '');
    setEditPhotoPaths([...album.filePaths]);
    setPhotosToAdd([]);
    setShowAddSection(false);
    setAddSearch('');
    await ensureAvailablePhotosLoaded();
  };

  const handleRemovePhotoFromEditAlbum = (pathToRemove: string) => {
    setEditPhotoPaths((prev) => prev.filter((p) => p !== pathToRemove));
  };

  const togglePhotoToAdd = (filePath: string) => {
    setPhotosToAdd((prev) =>
      prev.includes(filePath) ? prev.filter((p) => p !== filePath) : [...prev, filePath]
    );
  };

  const handleConfirmAddPhotos = () => {
    const existing = new Set(editPhotoPaths);
    photosToAdd.forEach((p) => existing.add(p));
    setEditPhotoPaths(Array.from(existing));
    setPhotosToAdd([]);
    setShowAddSection(false);
  };

  const handleSaveAlbumEdit = async () => {
    if (!editingAlbum || !editTitle.trim()) return;
    setIsSavingEdit(true);
    try {
      await virtualAlbumService.updateAlbum(editingAlbum.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        filePaths: editPhotoPaths,
      });
      setEditingAlbum(null);
      await loadAllAlbums();
    } catch (err) {
      console.error('Failed to update virtual album:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteVirtualAlbum = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Удалить этот альбом?')) {
      await virtualAlbumService.deleteAlbum(id);
      loadAllAlbums();
    }
  };

  const hasAnyAlbums = folderAlbums.length > 0 || virtualAlbums.length > 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header & New Album Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <FolderHeart className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-extrabold text-foreground">Альбомы и коллекции</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Пользовательские альбомы и папки медиатеки.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadAllAlbums}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Обновить альбомы"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Обновить</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-white shadow-xs transition-colors"
            title="Создать новый пользовательский альбом"
          >
            <Plus size={16} />
            <span>Создать альбом</span>
          </button>

          <button
            type="button"
            onClick={() => setFolderModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-border/80 bg-card hover:bg-muted text-foreground transition-colors"
          >
            <Folder size={14} />
            <span>Папки медиа</span>
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin mb-3 text-primary" />
          <p className="text-sm">Загрузка альбомов...</p>
        </div>
      ) : !hasAnyAlbums ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-card/40 border border-dashed border-border/80 rounded-3xl">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <BookOpen className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Нет альбомов или каталогов</h2>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-6">
            Вы можете создать свой персональный альбом, выбрав фотографии из галереи, либо подключить папки с диска.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs flex items-center gap-2"
            >
              <Plus size={14} />
              <span>Создать альбом</span>
            </button>
            <button
              type="button"
              onClick={() => setFolderModalOpen(true)}
              className="px-4 py-2 border border-border bg-card text-foreground text-xs font-semibold rounded-xl hover:bg-muted transition-colors shadow-xs flex items-center gap-2"
            >
              <Folder size={14} />
              <span>Подключить папку</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* User Virtual Albums Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <BookOpen size={18} className="text-primary" />
                <span>Мои альбомы ({virtualAlbums.length})</span>
              </h2>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
              >
                <Plus size={13} />
                <span>Новый альбом</span>
              </button>
            </div>

            {virtualAlbums.length === 0 ? (
              <div className="p-6 border border-dashed border-border/70 rounded-2xl text-center text-xs text-muted-foreground">
                У вас пока нет созданных альбомов.{' '}
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="text-primary font-semibold hover:underline"
                >
                  Создать альбом
                </button>
                , чтобы сгруппировать избранные фотографии.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {virtualAlbums.map((album) => {
                  const cover = album.filePaths[0];
                  const coverUrl = cover ? `/api/media/thumbnail?path=${encodeURIComponent(cover)}&size=400` : null;

                  return (
                    <div
                      key={album.id}
                      className="group bg-card border border-border/70 hover:border-primary/50 rounded-2xl overflow-hidden flex flex-col transition-all duration-200 shadow-xs hover:shadow-md relative"
                    >
                      {/* Album Cover Thumbnail */}
                      <div
                        onClick={() => handleOpenEditAlbum(album)}
                        className="aspect-4/3 w-full bg-muted/60 relative overflow-hidden flex items-center justify-center cursor-pointer"
                      >
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={album.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <BookOpen size={40} className="text-muted-foreground/40 group-hover:scale-110 transition-transform duration-300" />
                        )}
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />

                        {/* Actions overlay on hover */}
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditAlbum(album, e)}
                            className="p-1.5 rounded-lg bg-black/60 text-white hover:text-primary hover:bg-black/80 transition-colors"
                            title="Редактировать альбом"
                          >
                            <Edit2 size={13} />
                          </button>
                          <Link
                            to={`/photos?album=${album.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg bg-black/60 text-white hover:text-primary hover:bg-black/80 transition-colors"
                            title="Открыть в галерее"
                          >
                            <ExternalLink size={13} />
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteVirtualAlbum(album.id, e)}
                            className="p-1.5 rounded-lg bg-black/60 text-white/80 hover:text-red-400 hover:bg-black/80 transition-colors"
                            title="Удалить альбом"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Album Metadata */}
                      <div className="p-4 flex flex-col flex-1 justify-between">
                        <div
                          onClick={() => handleOpenEditAlbum(album)}
                          className="cursor-pointer"
                        >
                          <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors truncate">
                            {album.title}
                          </h3>
                          {album.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {album.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {album.filePaths.length} фото
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                          <Link
                            to={`/photos?album=${album.id}`}
                            className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                          >
                            <span>В галерее</span>
                            <ExternalLink size={11} />
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditAlbum(album, e)}
                            className="hover:text-foreground font-semibold flex items-center gap-1 text-muted-foreground hover:underline"
                          >
                            <Edit2 size={11} />
                            <span>Изменить</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Physical Folders Section */}
          {folderAlbums.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2 mb-4">
                <Folder size={18} className="text-primary" />
                <span>Папки медиатеки ({folderAlbums.length})</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {folderAlbums.map((album) => (
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
            </div>
          )}
        </div>
      )}

      {/* Create Virtual Album Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card border border-border/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Создать новый альбом</h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Название альбома *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Отпуск на море 2026, Семейный праздник..."
                  autoFocus
                  className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Описание (необязательно)
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Краткое описание коллекции..."
                  className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Photo Picker */}
            <div className="flex-1 min-h-0 flex flex-col space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  Выберите фотографии ({selectedPhotoPaths.length} выбрано)
                </span>
                <span className="text-muted-foreground text-[11px]">
                  Всего в галерее: {availablePhotos.length}
                </span>
              </div>

              {/* Photo Search Filter */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={createSearch}
                  onChange={(e) => setCreateSearch(e.target.value)}
                  placeholder="Поиск по имени файла или пути..."
                  className="w-full pl-8 pr-3 py-1.5 bg-muted/30 border border-border/60 rounded-lg text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="flex-1 overflow-y-auto border border-border/60 rounded-xl p-2.5 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 bg-muted/20 min-h-[160px] max-h-[280px]">
                {loadingPhotos ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mb-2 text-primary" />
                    <span className="text-xs">Загрузка фотографий из медиатеки...</span>
                  </div>
                ) : availablePhotos.filter((p) => {
                    if (!createSearch) return true;
                    const q = createSearch.toLowerCase();
                    return (p.filename || '').toLowerCase().includes(q) || (p.file_path || '').toLowerCase().includes(q);
                  }).length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <ImageIcon size={28} className="opacity-30 mb-1" />
                    <span className="text-xs">
                      {createSearch ? `Ничего не найдено по запросу «${createSearch}»` : 'В медиатеке нет фотографий'}
                    </span>
                  </div>
                ) : (
                  availablePhotos
                    .filter((p) => {
                      if (!createSearch) return true;
                      const q = createSearch.toLowerCase();
                      return (p.filename || '').toLowerCase().includes(q) || (p.file_path || '').toLowerCase().includes(q);
                    })
                    .map((photo) => {
                      const path = photo.file_path || photo.filename;
                      const isSelected = selectedPhotoPaths.includes(path);
                      const thumb = photo.thumbnail_url || `/api/media/thumbnail?path=${encodeURIComponent(path)}&size=300`;
                      const name = photo.filename || path.split(/[\\/]/).pop() || 'photo';

                      return (
                        <div
                          key={path}
                          onClick={() => toggleSelectPhoto(path)}
                          title={`${name}\n${path}`}
                          className={`group/picker relative flex flex-col rounded-xl overflow-hidden cursor-pointer border-2 transition-all bg-card ${
                            isSelected ? 'border-primary ring-2 ring-primary/40' : 'border-border/70 hover:border-primary/50'
                          }`}
                        >
                          <div className="relative aspect-square w-full bg-muted/50 overflow-hidden flex items-center justify-center">
                            <img
                              src={thumb}
                              alt={name}
                              className="w-full h-full object-cover transition-transform duration-200 group-hover/picker:scale-105"
                              loading="lazy"
                              onError={(e) => {
                                const target = e.target as HTMLElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  const fallback = parent.querySelector('.photo-fallback');
                                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                }
                              }}
                            />
                            <div className="photo-fallback hidden w-full h-full items-center justify-center bg-muted/60 text-muted-foreground">
                              <ImageIcon size={20} className="opacity-40" />
                            </div>

                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 bg-primary text-white p-1 rounded-full shadow-md z-10 animate-in zoom-in-50">
                                <Check size={12} strokeWidth={3} />
                              </div>
                            )}
                          </div>

                          <div className="px-1.5 py-1 bg-card/95 border-t border-border/50 text-[10px] font-medium text-foreground/90 truncate text-center select-none" title={name}>
                            {name}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleCreateAlbum}
                disabled={creating || !newTitle.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-xs"
              >
                {creating ? 'Создание...' : 'Создать альбом'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Virtual Album Modal */}
      {editingAlbum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card border border-border/80 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Редактирование альбома</h3>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/photos?album=${editingAlbum.id}`}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-border/80 hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink size={13} />
                  <span>Открыть в галерее</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setEditingAlbum(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Название альбома *
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Описание
                </label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Краткое описание альбома..."
                  className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Photos in Album */}
            <div className="flex-1 min-h-0 flex flex-col space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  Фотографии в альбоме ({editPhotoPaths.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddSection(!showAddSection)}
                  className="text-primary font-semibold hover:underline flex items-center gap-1"
                >
                  <Plus size={13} />
                  <span>{showAddSection ? 'Скрыть выбор фото' : 'Добавить фото в альбом'}</span>
                </button>
              </div>

              {editPhotoPaths.length === 0 ? (
                <div className="p-6 border border-dashed border-border/60 rounded-xl text-center text-xs text-muted-foreground">
                  В этом альбоме пока нет фотографий. Нажмите «Добавить фото в альбом», чтобы внести файлы.
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto border border-border/60 rounded-xl p-2.5 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 bg-muted/20 min-h-[120px] max-h-[220px]">
                  {editPhotoPaths.map((path) => {
                    const thumb = `/api/media/thumbnail?path=${encodeURIComponent(path)}&size=300`;
                    const filename = path.split(/[\\/]/).pop() || path;

                    return (
                      <div
                        key={path}
                        title={`${filename}\n${path}`}
                        className="group/item relative flex flex-col rounded-xl overflow-hidden border border-border/70 bg-card"
                      >
                        <div className="relative aspect-square w-full bg-muted/50 overflow-hidden flex items-center justify-center">
                          <img
                            src={thumb}
                            alt={filename}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              const target = e.target as HTMLElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                const fallback = parent.querySelector('.photo-fallback');
                                if (fallback) (fallback as HTMLElement).style.display = 'flex';
                              }
                            }}
                          />
                          <div className="photo-fallback hidden w-full h-full items-center justify-center bg-muted/60 text-muted-foreground">
                            <ImageIcon size={20} className="opacity-40" />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePhotoFromEditAlbum(path)}
                            className="absolute top-1.5 right-1.5 bg-red-600/90 text-white p-1 rounded-full shadow-xs hover:bg-red-700 transition-colors opacity-80 group-hover/item:opacity-100 z-10"
                            title="Удалить из альбома"
                          >
                            <X size={11} />
                          </button>
                        </div>
                        <div className="px-1.5 py-1 bg-card/95 border-t border-border/50 text-[10px] font-medium text-foreground/90 truncate text-center select-none" title={filename}>
                          {filename}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Photos Section */}
              {showAddSection && (
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      Выберите фотографии из медиатеки ({photosToAdd.length} выбрано)
                    </span>
                    {photosToAdd.length > 0 && (
                      <button
                        type="button"
                        onClick={handleConfirmAddPhotos}
                        className="px-3 py-1 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        Добавить выбранные ({photosToAdd.length})
                      </button>
                    )}
                  </div>

                  {/* Add Search Filter */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={addSearch}
                      onChange={(e) => setAddSearch(e.target.value)}
                      placeholder="Поиск по имени файла или пути..."
                      className="w-full pl-8 pr-3 py-1.5 bg-muted/30 border border-border/60 rounded-lg text-xs outline-none focus:border-primary"
                    />
                  </div>

                  <div className="overflow-y-auto border border-border/60 rounded-xl p-2.5 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 bg-muted/30 max-h-[180px]">
                    {loadingPhotos ? (
                      <div className="col-span-full flex flex-col items-center justify-center py-6 text-muted-foreground">
                        <RefreshCw className="h-5 w-5 animate-spin mb-1 text-primary" />
                        <span className="text-xs">Загрузка фотографий...</span>
                      </div>
                    ) : availablePhotos
                        .filter((photo) => !editPhotoPaths.includes(photo.file_path || photo.filename))
                        .filter((photo) => {
                          if (!addSearch) return true;
                          const q = addSearch.toLowerCase();
                          return (photo.filename || '').toLowerCase().includes(q) || (photo.file_path || '').toLowerCase().includes(q);
                        }).length === 0 ? (
                      <div className="col-span-full flex flex-col items-center justify-center py-6 text-muted-foreground">
                        <ImageIcon size={24} className="opacity-30 mb-1" />
                        <span className="text-xs">
                          {addSearch ? `Ничего не найдено по запросу «${addSearch}»` : 'Все доступные фотографии уже добавлены в альбом'}
                        </span>
                      </div>
                    ) : (
                      availablePhotos
                        .filter((photo) => !editPhotoPaths.includes(photo.file_path || photo.filename))
                        .filter((photo) => {
                          if (!addSearch) return true;
                          const q = addSearch.toLowerCase();
                          return (photo.filename || '').toLowerCase().includes(q) || (photo.file_path || '').toLowerCase().includes(q);
                        })
                        .map((photo) => {
                          const path = photo.file_path || photo.filename;
                          const isSelected = photosToAdd.includes(path);
                          const thumb = photo.thumbnail_url || `/api/media/thumbnail?path=${encodeURIComponent(path)}&size=300`;
                          const name = photo.filename || path.split(/[\\/]/).pop() || 'photo';

                          return (
                            <div
                              key={path}
                              onClick={() => togglePhotoToAdd(path)}
                              title={`${name}\n${path}`}
                              className={`group/picker relative flex flex-col rounded-xl overflow-hidden cursor-pointer border-2 transition-all bg-card ${
                                isSelected ? 'border-primary ring-2 ring-primary/40' : 'border-border/70 hover:border-primary/50'
                              }`}
                            >
                              <div className="relative aspect-square w-full bg-muted/50 overflow-hidden flex items-center justify-center">
                                <img
                                  src={thumb}
                                  alt={name}
                                  className="w-full h-full object-cover transition-transform duration-200 group-hover/picker:scale-105"
                                  loading="lazy"
                                  onError={(e) => {
                                    const target = e.target as HTMLElement;
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent) {
                                      const fallback = parent.querySelector('.photo-fallback');
                                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                    }
                                  }}
                                />
                                <div className="photo-fallback hidden w-full h-full items-center justify-center bg-muted/60 text-muted-foreground">
                                  <ImageIcon size={20} className="opacity-40" />
                                </div>

                                {isSelected && (
                                  <div className="absolute top-1.5 right-1.5 bg-primary text-white p-1 rounded-full shadow-md z-10 animate-in zoom-in-50">
                                    <Check size={12} strokeWidth={3} />
                                  </div>
                                )}
                              </div>

                              <div className="px-1.5 py-1 bg-card/95 border-t border-border/50 text-[10px] font-medium text-foreground/90 truncate text-center select-none" title={name}>
                                {name}
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setEditingAlbum(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveAlbumEdit}
                disabled={isSavingEdit || !editTitle.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-xs"
              >
                {isSavingEdit ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </div>
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
