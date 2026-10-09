import { useState, useEffect, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { mediaCacheService } from '../../services/mediaCacheService';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Search, Image as ImageIcon, Video, FilterX } from 'lucide-react';
import type { GalleryMediaFile } from '../../models';

export default function GalleryPage() {
  const [mediaFiles, setMediaFiles] = useState<GalleryMediaFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const parentRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      // Try fetching a large chunk to test virtualization
      await mediaCacheService.fetchChunk({ offset: 0, limit: 2000 });
      setMediaFiles(mediaCacheService.getAll());
    };
    loadData();
  }, []);

  // Filtered files
  const filteredFiles = useMemo(() => {
    return mediaFiles.filter((file) => {
      // Type filter
      if (typeFilter === 'image' && !file.is_image && file.type !== 'image') return false;
      if (typeFilter === 'video' && !file.is_video && file.type !== 'video') return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = file.filename?.toLowerCase().includes(query);
        const pathMatch = file.file_path?.toLowerCase().includes(query);
        if (!nameMatch && !pathMatch) return false;
      }
      
      return true;
    });
  }, [mediaFiles, searchQuery, typeFilter]);

  // Responsive columns calculation (simple approach for now)
  const columns = 5; // e.g. 5 columns grid
  const rowCount = Math.ceil(filteredFiles.length / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // estimated row height
    overscan: 2,
  });

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-card p-3 rounded-md shadow-sm border">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Поиск по имени или пути..." 
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
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

        <Button 
          variant="outline" 
          size="icon"
          className="h-10 w-10 shrink-0"
          title="Сбросить фильтры"
          onClick={() => {
            setSearchQuery('');
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
                gap: '8px',
                padding: '4px 8px',
              }}
            >
              {Array.from({ length: columns }).map((_, colIndex) => {
                const itemIndex = virtualRow.index * columns + colIndex;
                const file = filteredFiles[itemIndex];
                
                if (!file) return <div key={colIndex} />;

                const thumbnailUrl = `/api/thumbnail/${encodeURIComponent(file.file_path || file.filename || '')}`;

                return (
                  <div 
                    key={colIndex}
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
                      <div className="absolute top-2 left-2 bg-black/60 text-white p-1 rounded-sm backdrop-blur-sm">
                        <Video size={14} />
                      </div>
                    )}
                    
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
    </div>
  );
}
