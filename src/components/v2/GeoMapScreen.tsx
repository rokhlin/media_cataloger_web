import React, { useState } from 'react';
import { MapPin, Layers, ChevronRight, X, Image as ImageIcon, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/utils';

export const GeoMapScreen: React.FC = () => {
  const [selectedPin, setSelectedPin] = useState<string | null>('almaty');
  const [drawerOpen, setDrawerOpen] = useState(true);

  const pins = [
    { id: 'almaty', name: 'Алматы', x: '68%', y: '38%', count: 142, coords: '43.238942, 76.889709' },
    { id: 'rome', name: 'Рим', x: '49%', y: '42%', count: 88, coords: '41.902782, 12.496366' },
    { id: 'paris', name: 'Париж', x: '45%', y: '36%', count: 64, coords: '48.856613, 2.352222' },
    { id: 'tokyo', name: 'Токио', x: '85%', y: '44%', count: 53, coords: '35.689487, 139.691711' },
    { id: 'spb', name: 'Санкт-Петербург', x: '55%', y: '26%', count: 37, coords: '59.934280, 30.335099' },
  ];

  const currentPinData = pins.find((p) => p.id === selectedPin);

  return (
    <div className="h-[calc(100vh-64px-36px)] w-full flex relative overflow-hidden select-none">
      {/* Map Canvas Background */}
      <div className="flex-1 h-full bg-[#1e293b] relative overflow-hidden flex items-center justify-center">
        {/* World Map SVG Abstract Outline */}
        <svg
          viewBox="0 0 1000 500"
          className="w-full h-full object-cover opacity-25 pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M150,150 Q180,100 250,120 T350,180 T250,280 T150,200 Z M450,100 Q550,80 600,140 T700,200 T600,300 T500,250 Z M700,120 Q800,150 850,220 T800,320 T720,220 Z M200,320 Q260,330 280,400 T220,480 T180,400 Z"
            fill="currentColor"
            className="text-primary/40"
          />
          {/* Subtle Grid Lines */}
          <line x1="0" y1="250" x2="1000" y2="250" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
          <line x1="500" y1="0" x2="500" y2="500" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
        </svg>

        {/* Map Cluster Pins */}
        {pins.map((pin) => {
          const isSelected = selectedPin === pin.id;
          return (
            <div
              key={pin.id}
              style={{ left: pin.x, top: pin.y }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedPin(pin.id);
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
                <span>{pin.name}</span>
                <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded-full font-mono">
                  {pin.count}
                </span>
              </button>
            </div>
          );
        })}

        {/* Floating Map Controls Top-Left */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-card/85 backdrop-blur-md border border-border/80 p-2 rounded-2xl shadow-md">
          <button
            type="button"
            className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold shadow-xs"
          >
            Все локации ({pins.reduce((a, b) => a + b.count, 0)})
          </button>
          <div className="h-4 w-px bg-border mx-1" />
          <span className="text-xs text-muted-foreground px-2">
            Спутниковые метки GPS
          </span>
        </div>

        {/* Floating Zoom Controls Bottom-Left */}
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
          <button
            type="button"
            className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Слои"
            aria-label="Переключить слои"
          >
            <Layers size={18} />
          </button>
        </div>
      </div>

      {/* Synchronized Right-Hand Photo Slide-Over Drawer */}
      <div
        className={cn(
          'w-80 sm:w-96 border-l border-border/80 bg-card/95 backdrop-blur-md flex flex-col z-30 transition-all duration-300 shadow-xl',
          drawerOpen ? 'translate-x-0' : 'translate-x-full absolute right-0 inset-y-0'
        )}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-border/60 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-primary" />
              <h3 className="font-bold text-base text-foreground">
                {currentPinData?.name || 'Выбранная локация'}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {currentPinData?.coords}
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

        {/* Media Grid in Drawer */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Фотографии в этой области ({currentPinData?.count || 0})
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="group relative aspect-square rounded-xl overflow-hidden bg-muted border border-border/50 hover:border-primary transition-all cursor-pointer shadow-xs"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-end p-2">
                  <span className="text-[11px] text-white font-medium">IMG_{1000 + i}.JPG</span>
                </div>
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/50">
                  <ImageIcon size={24} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Toggle Button when Drawer is Closed */}
      {!drawerOpen && (
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
