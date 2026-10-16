import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { mediaCacheService } from '../../services/mediaCacheService';
import { useFavorites } from '../../services/favoritesService';
import { Button } from '../ui/button';
import { Image as ImageIcon, Video, FilterX, Heart, ZoomIn, ZoomOut, Folder, BookOpen } from 'lucide-react';
import { cn } from '@/utils';
import type { GalleryMediaFile } from '../../models';
import { virtualAlbumService, type VirtualAlbum } from '../../services/virtualAlbumService';
import { extractMediaYear } from '../layout/TimelineScrubber';
import MediaViewerModal from './MediaViewerModal';

export default function GalleryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const folderParam = searchParams.get('folder');
  const queryParam = searchParams.get('q') || '';
  const personParam = searchParams.get('person') || searchParams.get('face') || '';
  const albumParam = searchParams.get('album');

  const [mediaFiles, setMediaFiles] = useState<GalleryMediaFile[]>([]);
  const [activeAlbum, setActiveAlbum] = useState<VirtualAlbum | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const [selectedFile, setSelectedFile] = useState<GalleryMediaFile | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1200);
  const [zoomLevel, setZoomLevel] = useState<number>(3); // 1 (large) to 5 (compact)
  
  const parentRef = useRef<HTMLDivElement>(null);
  const { isFavorite, toggleFavorite } = useFavorites();

  const refreshData = async () => {
    await mediaCacheService.fetchChunk({ offset: 0, limit: 2000, refresh: true });
    setMediaFiles(mediaCacheService.getAll());
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      await mediaCacheService.fetchChunk({ offset: 0, limit: 2000 });
      setMediaFiles(mediaCacheService.getAll());
    };
    loadData();
  }, []);

  // Listen to media/album updates
  useEffect(() => {
    const onUpdate = () => {
      setMediaFiles(mediaCacheService.getAll());
    };
    window.addEventListener('media_updated', onUpdate);
    window.addEventListener('media_uploaded', onUpdate);
    window.addEventListener('album_updated', onUpdate);
    return () => {
      window.removeEventListener('media_updated', onUpdate);
      window.removeEventListener('media_uploaded', onUpdate);
      window.removeEventListener('album_updated', onUpdate);
    };
  }, []);

  const handleStartSingleAnalysis = async (
    filePath: string,
    onSuccess?: () => void,
    onError?: (err: string) => void
  ) => {
    try {
      const res = await fetch(`/api/analyze-file?file=${encodeURIComponent(filePath)}`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (onSuccess) onSuccess();
        setTimeout(refreshData, 3000);
      } else {
        if (onError) onError(data.message || data.detail || 'Не удалось запустить анализ');
      }
    } catch (e: any) {
      if (onError) onError(e.message || 'Ошибка сети при запуске анализа');
    }
  };

  // Sync album metadata if album param is set
  useEffect(() => {
    if (albumParam) {
      virtualAlbumService.getAlbums().then((albums) => {
        const found = albums.find((a) => a.id === albumParam);
        setActiveAlbum(found || null);
      });
    } else {
      setActiveAlbum(null);
    }
  }, [albumParam]);

  // Responsive container width measurement via ResizeObserver
  useEffect(() => {
    if (!parentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(parentRef.current);
    return () => observer.disconnect();
  }, []);

  // Filtered files
  const filteredFiles = useMemo(() => {
    return mediaFiles.filter((file) => {
      // Album filter
      if (albumParam && activeAlbum) {
        const normPath = (file.file_path || '').replace(/\\/g, '/').toLowerCase();
        const normName = (file.filename || '').toLowerCase();
        const isInAlbum = activeAlbum.filePaths.some((p) => {
          const np = p.replace(/\\/g, '/').toLowerCase();
          return np === normPath || np.endsWith('/' + normName) || normPath.endsWith('/' + np);
        });
        if (!isInAlbum) return false;
      }

      // Folder filter
      if (folderParam) {
        const normPath = (file.file_path || '').replace(/\\/g, '/').toLowerCase();
        const normFolder = (file.folder || '').replace(/\\/g, '/').toLowerCase();
        const target = folderParam.toLowerCase();
        const match = normPath.includes(`/${target}/`) || normFolder.endsWith(`/${target}`) || normFolder === target;
        if (!match) return false;
      }

      // Person / Face filter
      if (personParam) {
        const target = personParam.toLowerCase();
        const faceNamesMatch = file.face_names?.some((n) => n.toLowerCase() === target || n.toLowerCase().includes(target));
        const facesMatch = file.faces?.some((f) => (f.name || '').toLowerCase() === target || (f.name || '').toLowerCase().includes(target));
        if (!faceNamesMatch && !facesMatch) return false;
      }

      // Type filter
      if (typeFilter === 'image' && !file.is_image && file.type !== 'image') return false;
      if (typeFilter === 'video' && !file.is_video && file.type !== 'video') return false;
      
      // Global Search query filter (bilingual: Cyrillic queries match Russian metadata, Latin queries match English metadata, numbers/other match both)
      if (queryParam) {
        const query = queryParam.toLowerCase();
        const hasCyrillic = /[а-яё]/i.test(query);
        const hasLatin = /[a-z]/i.test(query);

        const nameMatch = file.filename?.toLowerCase().includes(query);
        const pathMatch = file.file_path?.toLowerCase().includes(query);
        const folderMatch = file.folder?.toLowerCase().includes(query);

        let descMatch = false;
        let summMatch = false;
        let exifMatch = false;
        let transMatch = false;

        if (hasCyrillic && !hasLatin) {
          // Cyrillic search targets Russian fields
          descMatch = Boolean((file as any).description_ru?.toLowerCase().includes(query));
          summMatch = Boolean((file as any).summary_ru?.toLowerCase().includes(query));
          exifMatch = Boolean((file as any).exif_analysis_ru?.toLowerCase().includes(query));
          transMatch = Boolean((file as any).transcription_ru?.toLowerCase().includes(query));
        } else if (hasLatin && !hasCyrillic) {
          // Latin search targets English fields
          descMatch = Boolean((file as any).description?.toLowerCase().includes(query));
          summMatch = Boolean((file as any).summary?.toLowerCase().includes(query));
          exifMatch = Boolean((file as any).exif_analysis?.toLowerCase().includes(query));
          transMatch = Boolean((file as any).transcription?.toLowerCase().includes(query));
        } else {
          // Mixed or other languages/numbers: search both English and Russian
          descMatch = Boolean(
            (file as any).description?.toLowerCase().includes(query) ||
            (file as any).description_ru?.toLowerCase().includes(query)
          );
          summMatch = Boolean(
            (file as any).summary?.toLowerCase().includes(query) ||
            (file as any).summary_ru?.toLowerCase().includes(query)
          );
          exifMatch = Boolean(
            (file as any).exif_analysis?.toLowerCase().includes(query) ||
            (file as any).exif_analysis_ru?.toLowerCase().includes(query)
          );
          transMatch = Boolean(
            (file as any).transcription?.toLowerCase().includes(query) ||
            (file as any).transcription_ru?.toLowerCase().includes(query)
          );
        }

        const ocrMatch = (file as any).ocr_text?.toLowerCase().includes(query);
        const locationMatch = (file as any).location_name?.toLowerCase().includes(query);
        const facesMatch = file.face_names?.some((fn) => fn.toLowerCase().includes(query)) ||
          file.faces?.some((f) => (f.name || '').toLowerCase().includes(query));
        const tags = (file as any).tags;
        const tagsMatch = Array.isArray(tags)
          ? tags.some((t: any) => String(t).toLowerCase().includes(query))
          : typeof tags === 'string' && tags.toLowerCase().includes(query);

        const queryYear = /^\d{4}$/.test(query) ? parseInt(query, 10) : null;
        const yearMatch = queryYear !== null && extractMediaYear(file) === queryYear;

        if (
          !nameMatch &&
          !pathMatch &&
          !folderMatch &&
          !descMatch &&
          !summMatch &&
          !ocrMatch &&
          !exifMatch &&
          !transMatch &&
          !locationMatch &&
          !facesMatch &&
          !tagsMatch &&
          !yearMatch
        ) {
          return false;
        }
      }
      
      return true;
    });
  }, [mediaFiles, queryParam, typeFilter, folderParam, personParam, albumParam, activeAlbum]);

  // Derived column count based on container width and zoom level
  const columns = useMemo(() => {
    // Zoom 1: large (~340px) ... Zoom 5: compact (~180px)
    const baseTargetWidth = Math.max(160, 360 - (zoomLevel - 1) * 45);
    const cols = Math.max(2, Math.floor(containerWidth / baseTargetWidth));
    return Math.min(12, cols);
  }, [containerWidth, zoomLevel]);

  // Exact row height calculation to ensure cards never overlap regardless of scaling/fullscreen
  const gap = 8;
  const horizontalPadding = 16;
  const cardWidth = Math.max(100, Math.floor((containerWidth - horizontalPadding - (columns - 1) * gap) / columns));
  const rowHeight = cardWidth + gap;
  const rowCount = Math.ceil(filteredFiles.length / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 2,
  });

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Filters & Actions Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-card p-3 rounded-md shadow-sm border">
        {folderParam && (
          <div className="flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-lg text-xs font-semibold">
            <Folder size={14} />
            <span>Каталог: {folderParam}</span>
            <button
              type="button"
              onClick={() => {
                searchParams.delete('folder');
                setSearchParams(searchParams);
              }}
              className="ml-1 hover:text-primary/70 font-bold"
              title="Сбросить фильтр каталога"
            >
              ×
            </button>
          </div>
        )}

        {albumParam && activeAlbum && (
          <div className="flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-lg text-xs font-semibold">
            <BookOpen size={14} />
            <span>Альбом: «{activeAlbum.title}»</span>
            <button
              type="button"
              onClick={() => {
                searchParams.delete('album');
                setSearchParams(searchParams);
              }}
              className="ml-1 hover:text-primary/70 font-bold"
              title="Сбросить фильтр альбома"
            >
              ×
            </button>
          </div>
        )}

        {personParam && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/25 text-primary text-xs font-medium rounded-lg">
            <span>Лицо: {personParam}</span>
            <button
              type="button"
              onClick={() => {
                searchParams.delete('person');
                searchParams.delete('face');
                setSearchParams(searchParams);
              }}
              className="ml-1 hover:opacity-75 font-bold"
              title="Сбросить фильтр по лицу"
            >
              ×
            </button>
          </div>
        )}

        {queryParam && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/25 text-primary text-xs font-medium rounded-lg">
            <span>Поиск: "{queryParam}"</span>
            <button
              type="button"
              onClick={() => {
                searchParams.delete('q');
                setSearchParams(searchParams);
              }}
              className="ml-1 hover:opacity-75 font-bold"
              title="Сбросить поиск"
            >
              ×
            </button>
          </div>
        )}
        
        <div className="flex items-center gap-2 border rounded-md p-1 bg-background">
          <Button 
            variant={typeFilter === 'all' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => setTypeFilter('all')}
            className="h-8 px-3"
          >
            Все
          </Button>
          <Button 
            variant={typeFilter === 'image' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => setTypeFilter('image')}
            className="h-8 px-3 gap-1.5"
          >
            <ImageIcon size={14} /> Фото
          </Button>
          <Button 
            variant={typeFilter === 'video' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => setTypeFilter('video')}
            className="h-8 px-3 gap-1.5"
          >
            <Video size={14} /> Видео
          </Button>
        </div>

        {/* Zoom Scale Slider Controls */}
        <div className="flex items-center gap-2 px-3 py-1 border rounded-md bg-background text-xs text-muted-foreground">
          <ZoomOut size={14} className="cursor-pointer" onClick={() => setZoomLevel((z) => Math.max(1, z - 1))} />
          <input
            type="range"
            min="1"
            max="5"
            value={zoomLevel}
            onChange={(e) => setZoomLevel(Number(e.target.value))}
            className="w-16 sm:w-20 h-1.5 accent-primary cursor-pointer"
            title="Масштаб карточек файлов"
            aria-label="Масштаб карточек файлов"
          />
          <ZoomIn size={14} className="cursor-pointer" onClick={() => setZoomLevel((z) => Math.min(5, z + 1))} />
        </div>

        <Button 
          variant="outline" 
          size="icon"
          className="h-10 w-10 shrink-0"
          title="Сбросить фильтры"
          onClick={() => {
            if (queryParam) {
              searchParams.delete('q');
            }
            if (folderParam) {
              searchParams.delete('folder');
            }
            if (personParam) {
              searchParams.delete('person');
              searchParams.delete('face');
            }
            setSearchParams(searchParams);
            setTypeFilter('all');
          }}
        >
          <FilterX size={16} />
        </Button>
        
        <div className="ml-auto text-sm text-muted-foreground">
          Найдено: {filteredFiles.length}
        </div>
      </div>

      {/* Virtualized Grid Area */}
      <div 
        ref={parentRef} 
        className="flex-1 overflow-auto rounded-md border bg-card/50"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.index}
              className="absolute top-0 left-0 w-full"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap: `${gap}px`,
                padding: '4px 8px',
              }}
            >
              {Array.from({ length: columns }).map((_, colIndex) => {
                const itemIndex = virtualRow.index * columns + colIndex;
                const file = filteredFiles[itemIndex];
                
                if (!file) return <div key={colIndex} />;

                const filePathOrName = file.file_path || file.filename || '';
                const thumbnailUrl = file.thumbnail_url || `/api/media/thumbnail?path=${encodeURIComponent(filePathOrName)}&size=360`;
                const isFav = isFavorite(filePathOrName);

                return (
                  <div 
                    key={colIndex}
                    onClick={() => setSelectedFile(file)}
                    className="relative group bg-muted rounded-md overflow-hidden border cursor-pointer hover:border-primary transition-colors flex items-center justify-center aspect-square"
                  >
                    <img 
                      src={thumbnailUrl} 
                      alt={file.filename}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlMGUwZTAiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iIzk5OSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTRweCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFRodW1iPC90ZXh0Pjwvc3ZnPg==';
                      }}
                    />
                    
                    {file.is_video && (
                      <div className="absolute top-2 left-2 bg-black/60 text-white p-1 rounded-sm backdrop-blur-sm z-10">
                        <Video size={14} />
                      </div>
                    )}

                    {/* Favorite Heart Action Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(filePathOrName);
                      }}
                      className={cn(
                        'absolute top-2 right-2 z-20 p-1.5 rounded-full backdrop-blur-md transition-all duration-200',
                        isFav
                          ? 'bg-black/60 text-[#e74040] opacity-100'
                          : 'bg-black/40 text-white/80 opacity-0 group-hover:opacity-100 hover:text-white hover:scale-110'
                      )}
                      title={isFav ? 'Удалить из избранного' : 'Добавить в избранное'}
                      aria-label="Избранное"
                    >
                      <Heart size={15} className={cn(isFav && 'fill-[#e74040]')} />
                    </button>
                    
                    {/* Tooltip or overlay info */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs text-white truncate" title={file.filename}>
                        {file.filename}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          
          {filteredFiles.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-10">
              <ImageIcon size={48} className="mb-4 opacity-20" />
              <p>Медиафайлы не найдены</p>
            </div>
          )}
        </div>
      </div>
      
      {selectedFile && (
        <MediaViewerModal
          isOpen={true}
          mediaFile={selectedFile}
          onClose={() => setSelectedFile(null)}
          currentIndex={filteredFiles.indexOf(selectedFile)}
          totalFiles={filteredFiles.length}
          onPrev={() => {
            const idx = filteredFiles.indexOf(selectedFile);
            if (idx > 0) setSelectedFile(filteredFiles[idx - 1]);
          }}
          onNext={() => {
            const idx = filteredFiles.indexOf(selectedFile);
            if (idx < filteredFiles.length - 1) setSelectedFile(filteredFiles[idx + 1]);
          }}
          hasPrev={filteredFiles.indexOf(selectedFile) > 0}
          hasNext={filteredFiles.indexOf(selectedFile) < filteredFiles.length - 1}
          onRefresh={refreshData}
          onStartSingleAnalysis={handleStartSingleAnalysis}
          onMediaUpdated={(updated) => {
            setSelectedFile(updated);
            mediaCacheService.upsert(updated);
            setMediaFiles(mediaCacheService.getAll());
          }}
        />
      )}
    </div>
  );
}
