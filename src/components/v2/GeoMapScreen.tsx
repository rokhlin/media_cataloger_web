import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ChevronRight, X, ZoomIn, ZoomOut, Compass } from 'lucide-react';
import { cn } from '@/utils';
import { mediaCacheService } from '../../services/mediaCacheService';
import type { GalleryMediaFile } from '../../models';

interface GeoCluster {
  id: string;
  name: string;
  coords: string;
  x: string;
  y: string;
  files: GalleryMediaFile[];
}

export function extractMediaCoordinates(file: any): { lat: number; lon: number; locationName?: string } | null {
  if (!file) return null;

  // 1. Direct properties
  let rawLat = file.latitude ?? file.gps_latitude ?? file.gps?.latitude;
  let rawLon = file.longitude ?? file.gps_longitude ?? file.gps?.longitude;

  // 2. EXIF object properties
  if (rawLat == null || rawLon == null) {
    rawLat = file.exif?.gps?.latitude ?? file.exif?.latitude;
    rawLon = file.exif?.gps?.longitude ?? file.exif?.longitude;
  }

  // 3. Sidecar properties
  if (rawLat == null || rawLon == null) {
    rawLat = file.sidecar?.exif?.gps?.latitude ?? file.sidecar?.gps?.latitude ?? file.sidecar?.latitude;
    rawLon = file.sidecar?.exif?.gps?.longitude ?? file.sidecar?.gps?.longitude ?? file.sidecar?.longitude;
  }

  if (rawLat == null || rawLon == null) return null;

  const lat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat));
  const lon = typeof rawLon === 'number' ? rawLon : parseFloat(String(rawLon));

  if (isNaN(lat) || isNaN(lon)) return null;
  // Valid coordinates range check
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  if (Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001) return null;

  const locationName = file.location_name || file.city || file.exif?.location?.city || file.sidecar?.location_name || file.sidecar?.location?.city;
  return { lat, lon, locationName };
}

export const GeoMapScreen: React.FC = () => {
  const navigate = useNavigate();
  const [allFiles, setAllFiles] = useState<GalleryMediaFile[]>([]);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMedia = async () => {
      try {
        let files = mediaCacheService.getAll();
        if (files.length === 0 || files.length < 200) {
          const res = await mediaCacheService.fetchChunk({ offset: 0, limit: 2000, refresh: true });
          files = res.files || mediaCacheService.getAll();
        }
        setAllFiles(files);
      } catch (err) {
        console.warn('Failed to load geotagged media:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadMedia();
    window.addEventListener('media_uploaded', loadMedia);
    window.addEventListener('media_updated', loadMedia);
    return () => {
      window.removeEventListener('media_uploaded', loadMedia);
      window.removeEventListener('media_updated', loadMedia);
    };
  }, []);

  // Filter media files that contain real GPS coordinates
  const geotaggedFiles = useMemo(() => {
    return allFiles.filter((f) => extractMediaCoordinates(f) !== null);
  }, [allFiles]);

  // Derive geographical clusters from real files
  const clusters: GeoCluster[] = useMemo(() => {
    if (geotaggedFiles.length === 0) return [];
    const map = new Map<string, GalleryMediaFile[]>();

    for (const file of geotaggedFiles) {
      const coords = extractMediaCoordinates(file);
      if (!coords) continue;
      const clusterKey = `${coords.lat.toFixed(1)},${coords.lon.toFixed(1)}`;
      if (!map.has(clusterKey)) {
        map.set(clusterKey, []);
      }
      map.get(clusterKey)!.push(file);
    }

    return Array.from(map.entries()).map(([key, files], index) => {
      const [latStr, lonStr] = key.split(',');
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      // Normalized projection percentage for abstract map
      const x = Math.min(95, Math.max(5, ((lon + 180) / 360) * 100)).toFixed(1) + '%';
      const y = Math.min(95, Math.max(5, ((90 - lat) / 180) * 100)).toFixed(1) + '%';
      const firstCoords = extractMediaCoordinates(files[0]);
      const cityName = (files[0] as any).location_name || firstCoords?.locationName || (files[0] as any).city || `Координаты ${key}`;

      return {
        id: `cluster-${index}`,
        name: cityName,
        coords: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        x,
        y,
        files,
      };
    });
  }, [geotaggedFiles]);

  const currentCluster = clusters.find((c) => c.id === selectedPin) || clusters[0];

  return (
    <div className="h-[calc(100vh-64px-36px)] w-full flex relative overflow-hidden select-none">
      {/* Map Canvas Background */}
      <div className="flex-1 h-full bg-[#1e293b] relative overflow-hidden flex items-center justify-center">
        {/* World Map SVG Abstract Outline */}
        <svg
          viewBox="0 0 1000 500"
          className="w-full h-full object-cover opacity-20 pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M150,150 Q180,100 250,120 T350,180 T250,280 T150,200 Z M450,100 Q550,80 600,140 T700,200 T600,300 T500,250 Z M700,120 Q800,150 850,220 T800,320 T720,220 Z M200,320 Q260,330 280,400 T220,480 T180,400 Z"
            fill="currentColor"
            className="text-primary/40"
          />
          <line x1="0" y1="250" x2="1000" y2="250" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
          <line x1="500" y1="0" x2="500" y2="500" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
        </svg>

        {/* Clean Empty State when no real geotags are present */}
        {!isLoading && clusters.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-background/60 backdrop-blur-xs">
            <div className="w-16 h-16 rounded-3xl bg-muted/80 border border-border flex items-center justify-center text-muted-foreground mb-4 shadow-sm">
              <Compass size={32} className="text-primary/70 animate-pulse" />
            </div>
            <h3 className="text-base font-bold text-foreground">Нет фотографий с геометками</h3>
            <p className="text-xs text-muted-foreground max-w-md mt-1.5 leading-relaxed">
              В вашей медиатеке пока нет снимков с координатами GPS. При сканировании фотографий с геоданными они автоматически появятся на этой интерактивной карте.
            </p>
            <button
              type="button"
              onClick={() => navigate('/photos')}
              className="mt-4 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs"
            >
              Перейти к галерее
            </button>
          </div>
        )}

        {/* Real Geotagged Cluster Pins */}
        {clusters.map((cluster) => {
          const isSelected = (selectedPin || clusters[0]?.id) === cluster.id;
          return (
            <div
              key={cluster.id}
              style={{ left: cluster.x, top: cluster.y }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedPin(cluster.id);
                  setDrawerOpen(true);
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg transition-all duration-200 transform',
                  isSelected
                    ? 'bg-[#23a6f0] text-white scale-110 ring-4 ring-[#23a6f0]/30 font-bold'
                    : 'bg-card/90 text-foreground hover:bg-card hover:scale-105 border border-border/70 text-xs font-medium'
                )}
              >
                <MapPin size={14} className={isSelected ? 'text-white' : 'text-primary'} />
                <span>{cluster.name}</span>
                <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded-full font-mono">
                  {cluster.files.length}
                </span>
              </button>
            </div>
          );
        })}

        {/* Floating Controls */}
        {clusters.length > 0 && (
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-card/85 backdrop-blur-md border border-border/80 p-2 rounded-2xl shadow-md">
            <span className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold shadow-xs">
              Геоточек: {clusters.length}
            </span>
            <div className="h-4 w-px bg-border mx-1" />
            <span className="text-xs text-muted-foreground px-2">
              GPS координаты из EXIF
            </span>
          </div>
        )}

        <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-1.5 bg-card/85 backdrop-blur-md border border-border/80 p-1.5 rounded-2xl shadow-md">
          <button
            type="button"
            className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Приблизить"
            aria-label="Приблизить карту"
          >
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Отдалить"
            aria-label="Отдалить карту"
          >
            <ZoomOut size={18} />
          </button>
        </div>
      </div>

      {/* Synchronized Right-Hand Photo Slide-Over Drawer */}
      {currentCluster && (
        <div
          className={cn(
            'w-80 sm:w-96 border-l border-border/80 bg-card/95 backdrop-blur-md flex flex-col z-30 transition-all duration-300 shadow-xl',
            drawerOpen ? 'translate-x-0' : 'translate-x-full absolute right-0 inset-y-0'
          )}
        >
          <div className="p-4 border-b border-border/60 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-primary" />
                <h3 className="font-bold text-base text-foreground">
                  {currentCluster.name}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                {currentCluster.coords}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Закрыть панель"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Фотографии в этой локации ({currentCluster.files.length})
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {currentCluster.files.map((file, i) => (
                <div
                  key={file.file_path || file.filename || i}
                  onClick={() => navigate(`/photos?q=${encodeURIComponent(file.filename)}`)}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-muted border border-border/50 hover:border-primary transition-all cursor-pointer shadow-xs"
                >
                  <img
                    src={`/api/media/thumbnail/${encodeURIComponent(file.file_path || file.filename)}`}
                    alt={file.filename}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-end p-2">
                    <span className="text-[11px] text-white font-medium truncate">{file.filename}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toggle Button when Drawer is Closed */}
      {!drawerOpen && clusters.length > 0 && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="absolute right-4 top-4 z-20 flex items-center gap-2 px-4 py-2 bg-card/90 backdrop-blur-md border border-border rounded-xl text-xs font-semibold text-foreground shadow-md hover:bg-card"
        >
          <span>Показать фото</span>
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
};

export default GeoMapScreen;
