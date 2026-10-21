import { useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

export type AspectRatioType = '1:1' | '3:4' | '4:3' | '16:9' | '9:16' | 'original';

export interface ResolutionOption {
  label: string;
  width: number;
  height: number;
}

export interface CropFrameOverlayProps {
  aspectRatio: AspectRatioType;
  onSelectAspectRatio: (ratio: AspectRatioType) => void;
  selectedResolution: ResolutionOption | null;
  onSelectResolution: (res: ResolutionOption) => void;
  naturalWidth: number;
  naturalHeight: number;
}

export default function CropFrameOverlay({
  aspectRatio,
  onSelectAspectRatio,
  selectedResolution,
  onSelectResolution,
  naturalWidth,
  naturalHeight,
}: CropFrameOverlayProps) {
  const { language } = useLanguage();

  const aspectRatios: { key: AspectRatioType; label: string; ratioW: number; ratioH: number }[] = [
    { key: 'original', label: language === 'ru' ? 'Оригинал' : 'Original', ratioW: naturalWidth || 16, ratioH: naturalHeight || 9 },
    { key: '1:1', label: '1:1', ratioW: 1, ratioH: 1 },
    { key: '3:4', label: '3:4', ratioW: 3, ratioH: 4 },
    { key: '4:3', label: '4:3', ratioW: 4, ratioH: 3 },
    { key: '16:9', label: '16:9', ratioW: 16, ratioH: 9 },
    { key: '9:16', label: '9:16', ratioW: 9, ratioH: 16 },
  ];

  // Dynamically calculate available resolutions strictly for downscaling (max = natural dimensions)
  const availableResolutions: ResolutionOption[] = useMemo(() => {
    const nw = naturalWidth || 1920;
    const nh = naturalHeight || 1080;
    const isPortrait = nh > nw;

    // Get current ratio multiplier
    const current = aspectRatios.find((r) => r.key === aspectRatio) || aspectRatios[0];
    const rW = current.ratioW;
    const rH = current.ratioH;

    // Compute max bounding dimension based on aspect ratio fitting within natural image
    let maxW = nw;
    let maxH = Math.round((nw * rH) / rW);
    if (maxH > nh) {
      maxH = nh;
      maxW = Math.round((nh * rW) / rH);
    }

    const options: ResolutionOption[] = [
      {
        label: `${language === 'ru' ? 'Оригинал' : 'Original'} (${maxW} × ${maxH})`,
        width: maxW,
        height: maxH,
      },
    ];

    // Standard baseline tiers (e.g., 2K, FHD 1080p, HD 720p, SD 480p)
    const standardTiers = isPortrait || rH > rW
      ? [
          { name: '2K', targetH: 2560 },
          { name: 'Full HD', targetH: 1920 },
          { name: 'HD', targetH: 1280 },
          { name: 'SD', targetH: 854 },
        ]
      : [
          { name: '2K', targetW: 2560 },
          { name: 'Full HD', targetW: 1920 },
          { name: 'HD', targetW: 1280 },
          { name: 'SD', targetW: 854 },
        ];

    for (const tier of standardTiers) {
      let tW: number;
      let tH: number;
      if ('targetW' in tier && tier.targetW) {
        tW = tier.targetW;
        tH = Math.round((tW * rH) / rW);
      } else {
        tH = (tier as any).targetH;
        tW = Math.round((tH * rW) / rH);
      }

      // Only include downscaling options smaller than the crop maximum
      if (tW < maxW && tH < maxH && tW >= 240 && tH >= 240) {
        options.push({
          label: `${tier.name} (${tW} × ${tH})`,
          width: tW,
          height: tH,
        });
      }
    }

    return options;
  }, [aspectRatio, naturalWidth, naturalHeight, language]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 w-full">
      {/* Aspect Ratio Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        <span className="text-xs text-muted-foreground font-semibold mr-1">
          {language === 'ru' ? 'Пропорции:' : 'Aspect:'}
        </span>
        {aspectRatios.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelectAspectRatio(item.key)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              aspectRatio === item.key
                ? 'bg-primary text-white shadow-sm ring-1 ring-primary/40'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Target Resolution Dropdown */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-semibold whitespace-nowrap">
          {language === 'ru' ? 'Разрешение:' : 'Resolution:'}
        </span>
        <select
          value={selectedResolution ? `${selectedResolution.width}x${selectedResolution.height}` : ''}
          onChange={(e) => {
            const [w, h] = e.target.value.split('x').map(Number);
            const found = availableResolutions.find((r) => r.width === w && r.height === h);
            if (found) onSelectResolution(found);
          }}
          className="bg-slate-800 border border-slate-700 text-slate-100 text-xs font-mono font-medium rounded-lg px-2.5 py-1.5 outline-none focus:border-primary transition-colors cursor-pointer"
        >
          {availableResolutions.map((res) => (
            <option key={`${res.width}x${res.height}`} value={`${res.width}x${res.height}`}>
              {res.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
