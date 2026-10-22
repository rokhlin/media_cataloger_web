import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ChevronRight, X, ZoomIn, ZoomOut, Compass, Layers, Search, Image as ImageIcon } from 'lucide-react';
import type L from 'leaflet';
import { cn } from '@/utils';
import { mediaCacheService } from '../../services/mediaCacheService';
import type { GalleryMediaFile } from '../../models';

export interface GeoCluster {
  id: string;
  name: string;
  coords: string;
  lat: number;
  lon: number;
  files: GalleryMediaFile[];
}

export type MapTileLayerType = 'voyager' | 'dark' | 'osm';

const TILE_LAYERS: Record<MapTileLayerType, { url: string; attribution: string; name: string }> = {
  voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
    name: 'Стандартная (CARTO)',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
    name: 'Темная тема',
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    name: 'OpenStreetMap',
  },
};

let cachedLeaflet: typeof L | null = null;
async function getLeaflet(): Promise<typeof L | null> {
  if (cachedLeaflet) return cachedLeaflet;
  if (typeof window === 'undefined') return null;
  const mod = await import('leaflet');
  cachedLeaflet = (mod.default || mod) as unknown as typeof L;
  return cachedLeaflet;
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
  // Reject null-island (0,0)
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
  const [tileLayerType, setTileLayerType] = useState<MapTileLayerType>('voyager');
  const [searchQuery, setSearchQuery] = useState('');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const leafletRef = useRef<typeof L | null>(null);

  // Load media with fresh sync
  useEffect(() => {
    let isMounted = true;
    const loadMedia = async () => {
      try {
        let files = mediaCacheService.getAll();
        const hasGeotagsInCache = files.some((f) => extractMediaCoordinates(f) !== null);

        if (files.length === 0 || !hasGeotagsInCache) {
          const res = await mediaCacheService.fetchChunk({ offset: 0, limit: 2000, refresh: true });
          files = res.files || mediaCacheService.getAll();
        }

        if (isMounted) {
          setAllFiles(files);
        }
      } catch (err) {
        console.warn('Failed to load geotagged media:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadMedia();
    window.addEventListener('media_uploaded', loadMedia);
    window.addEventListener('media_updated', loadMedia);
    return () => {
      isMounted = false;
      window.removeEventListener('media_uploaded', loadMedia);
      window.removeEventListener('media_updated', loadMedia);
    };
  }, []);

  // Filter media files that contain valid GPS coordinates
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
      // Round coordinates to ~0.05 deg for natural geographic proximity clustering
      const roundedLat = (Math.round(coords.lat * 20) / 20).toFixed(2);
      const roundedLon = (Math.round(coords.lon * 20) / 20).toFixed(2);
      const clusterKey = `${roundedLat},${roundedLon}`;
      if (!map.has(clusterKey)) {
        map.set(clusterKey, []);
      }
      map.get(clusterKey)!.push(file);
    }

    return Array.from(map.entries()).map(([key, files], index) => {
      const [latStr, lonStr] = key.split(',');
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      const firstCoords = extractMediaCoordinates(files[0]);
      const cityName = (files[0] as any).location_name || firstCoords?.locationName || (files[0] as any).city || `Координаты ${key}`;

      return {
        id: `cluster-${index}`,
        name: cityName,
        coords: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        lat,
        lon,
        files,
      };
    });
  }, [geotaggedFiles]);

  // Filter clusters by search query if user types in search box
  const filteredClusters = useMemo(() => {
    if (!searchQuery.trim()) return clusters;
    const q = searchQuery.toLowerCase().trim();
    return clusters.filter(
      (c) => c.name.toLowerCase().includes(q) || c.coords.includes(q)
    );
  }, [clusters, searchQuery]);

  const currentCluster = useMemo(() => {
    return clusters.find((c) => c.id === selectedPin) || clusters[0] || null;
  }, [clusters, selectedPin]);

  // Initialize Leaflet Map safely
  useEffect(() => {
    let isCancelled = false;

    const initMap = async () => {
      const L = await getLeaflet();
      if (!L || isCancelled || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      leafletRef.current = L;

      const initialLat = 48.0;
      const initialLon = 45.0;
      const initialZoom = 3;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLon],
        zoom: initialZoom,
        zoomControl: false,
        attributionControl: true,
        maxZoom: 19,
        minZoom: 2,
      });

      const activeTileConfig = TILE_LAYERS[tileLayerType];
      const tileLayer = L.tileLayer(activeTileConfig.url, {
        attribution: activeTileConfig.attribution,
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      tileLayerRef.current = tileLayer;
      markersGroupRef.current = markersGroup;
    };

    initMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        markersGroupRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer when layer type changes
  useEffect(() => {
    const L = leafletRef.current;
    if (!mapInstanceRef.current || !tileLayerRef.current || !L) return;
    const map = mapInstanceRef.current;
    map.removeLayer(tileLayerRef.current);

    const activeTileConfig = TILE_LAYERS[tileLayerType];
    const newTileLayer = L.tileLayer(activeTileConfig.url, {
      attribution: activeTileConfig.attribution,
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = newTileLayer;
  }, [tileLayerType]);

  // Handle Map Resizing on Drawer Toggle
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 320);
    return () => clearTimeout(timer);
  }, [drawerOpen]);

  // Fit bounds to all markers helper
  const fitAllMarkers = useCallback(() => {
    const L = leafletRef.current;
    if (!mapInstanceRef.current || filteredClusters.length === 0 || !L) return;
    const map = mapInstanceRef.current;
    if (filteredClusters.length === 1) {
      map.flyTo([filteredClusters[0].lat, filteredClusters[0].lon], 12, { duration: 0.8 });
    } else {
      const bounds = L.latLngBounds(filteredClusters.map((c) => [c.lat, c.lon]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }
  }, [filteredClusters]);

  // Initial Auto-Fit Bounds when clusters first load
  const hasFitInitialBoundsRef = useRef(false);
  useEffect(() => {
    if (clusters.length > 0 && !hasFitInitialBoundsRef.current && mapInstanceRef.current) {
      hasFitInitialBoundsRef.current = true;
      fitAllMarkers();
    }
  }, [clusters, fitAllMarkers]);

  // Render Leaflet Markers for Clusters
  useEffect(() => {
    const L = leafletRef.current;
    if (!mapInstanceRef.current || !markersGroupRef.current || !L) return;
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    group.clearLayers();

    filteredClusters.forEach((cluster) => {
      const isSelected = (selectedPin || clusters[0]?.id) === cluster.id;

      const markerHtml = `
        <div class="cursor-pointer group flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg border transition-all duration-200 transform hover:scale-110 ${
          isSelected
            ? 'bg-[#23a6f0] text-white scale-110 ring-4 ring-[#23a6f0]/30 font-bold border-white/40'
            : 'bg-[#1e293b]/95 text-white hover:bg-[#0f172a] border-slate-700/80 text-xs font-medium'
        }">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="${isSelected ? 'text-white' : 'text-[#23a6f0]'}">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <span class="max-w-[130px] truncate text-xs font-semibold leading-tight">${cluster.name}</span>
          <span class="text-[10px] bg-black/35 px-1.5 py-0.5 rounded-full font-mono font-bold">${cluster.files.length}</span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-geo-marker-container',
        html: markerHtml,
        iconSize: [140, 34],
        iconAnchor: [70, 17],
      });

      const marker = L.marker([cluster.lat, cluster.lon], { icon: customIcon });

      marker.on('click', () => {
        setSelectedPin(cluster.id);
        setDrawerOpen(true);
        map.flyTo([cluster.lat, cluster.lon], Math.max(map.getZoom(), 11), { duration: 0.6 });
      });

      marker.addTo(group);
    });
  }, [filteredClusters, selectedPin, clusters]);

  // Zoom controls handlers
  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const cycleTileLayer = () => {
    setTileLayerType((prev) => {
      if (prev === 'voyager') return 'dark';
      if (prev === 'dark') return 'osm';
      return 'voyager';
    });
  };

  return (
    <div className="h-[calc(100vh-64px-36px)] w-full flex relative overflow-hidden select-none">
      {/* Interactive Leaflet Map Viewport */}
      <div className="flex-1 h-full relative overflow-hidden bg-slate-900">
        <div
          ref={mapContainerRef}
          id="leaflet-geomap-container"
          className="w-full h-full z-0"
        />

        {/* Clean Empty State when no real geotags are present */}
        {!isLoading && clusters.length === 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-background/80 backdrop-blur-sm">
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

        {/* Floating Top-Left Controls & Stats */}
        {clusters.length > 0 && (
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-card/90 backdrop-blur-md border border-border/80 p-1.5 rounded-2xl shadow-lg">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold shadow-xs">
              <MapPin size={13} />
              <span>Геоточек: {clusters.length}</span>
            </div>
            <div className="h-4 w-px bg-border mx-0.5" />
            <span className="text-xs text-muted-foreground px-2 font-medium">
              Снимков с GPS: {geotaggedFiles.length}
            </span>

            {/* Location Search Input */}
            <div className="relative flex items-center ml-1">
              <Search size={14} className="absolute left-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Поиск по локации..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 bg-muted/60 border border-border/60 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary w-36 sm:w-48 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Floating Bottom-Left Map Navigation Controls */}
        <div className="absolute bottom-5 left-5 z-20 flex flex-col gap-1.5 bg-card/90 backdrop-blur-md border border-border/80 p-1.5 rounded-2xl shadow-lg">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2.5 rounded-xl text-foreground/80 hover:bg-muted hover:text-foreground transition-colors cursor-pointer shadow-xs active:scale-95"
            title="Приблизить карту"
            aria-label="Приблизить карту"
          >
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2.5 rounded-xl text-foreground/80 hover:bg-muted hover:text-foreground transition-colors cursor-pointer shadow-xs active:scale-95"
            title="Отдалить карту"
            aria-label="Отдалить карту"
          >
            <ZoomOut size={18} />
          </button>
          <div className="h-px w-full bg-border/60 my-0.5" />
          <button
            type="button"
            onClick={fitAllMarkers}
            className="p-2.5 rounded-xl text-foreground/80 hover:bg-muted hover:text-primary transition-colors cursor-pointer shadow-xs active:scale-95"
            title="Показать все геоточки"
            aria-label="Показать все геоточки"
          >
            <Compass size={18} />
          </button>
          <button
            type="button"
            onClick={cycleTileLayer}
            className="p-2.5 rounded-xl text-foreground/80 hover:bg-muted hover:text-primary transition-colors cursor-pointer shadow-xs active:scale-95"
            title={`Слой карты: ${TILE_LAYERS[tileLayerType].name}`}
            aria-label="Переключить слой карты"
          >
            <Layers size={18} />
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
          {/* Drawer Header */}
          <div className="p-4 border-b border-border/60 flex items-center justify-between shrink-0 bg-muted/20">
            <div>
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-primary shrink-0" />
                <h3 className="font-bold text-base text-foreground truncate max-w-[220px]">
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
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
              aria-label="Закрыть панель"
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer Photos List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Снимки в этой локации ({currentCluster.files.length})
              </p>
              <button
                type="button"
                onClick={() => navigate(`/photos?q=${encodeURIComponent(currentCluster.name)}`)}
                className="text-[11px] text-primary hover:underline font-semibold"
              >
                Все в галерее
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {currentCluster.files.map((file, i) => {
                const targetFilePath = file.file_path || file.filename;
                const thumbUrl = file.thumbnail_url || `/api/media/thumbnail?path=${encodeURIComponent(targetFilePath)}&size=300`;

                return (
                  <div
                    key={targetFilePath || i}
                    onClick={() => navigate(`/photos?q=${encodeURIComponent(file.filename || pathBasename(targetFilePath))}`)}
                    className="group relative aspect-square rounded-xl overflow-hidden bg-muted border border-border/60 hover:border-primary transition-all cursor-pointer shadow-xs"
                    title={file.filename}
                  >
                    <img
                      src={thumbUrl}
                      alt={file.filename}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.parentElement?.querySelector('.fallback-icon') as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="fallback-icon hidden w-full h-full items-center justify-center bg-muted text-muted-foreground">
                      <ImageIcon size={24} />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 flex flex-col justify-end p-2 pointer-events-none">
                      <span className="text-[11px] text-white font-medium truncate">{file.filename}</span>
                      {file.capture_date && (
                        <span className="text-[9px] text-white/80 font-mono">
                          {file.capture_date.slice(0, 10)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toggle Button when Drawer is Closed */}
      {!drawerOpen && clusters.length > 0 && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="absolute right-4 top-4 z-20 flex items-center gap-2 px-4 py-2 bg-card/90 backdrop-blur-md border border-border rounded-xl text-xs font-semibold text-foreground shadow-md hover:bg-card cursor-pointer transition-colors"
        >
          <span>Показать фото ({currentCluster?.files.length || 0})</span>
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
};

function pathBasename(p: string): string {
  if (!p) return '';
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
}

export default GeoMapScreen;
