import { useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Square, Circle, Maximize } from 'lucide-react';

export type CropShape = 'rect' | 'circle';
export type AspectRatioType = '1:1' | '3:4' | '4:3' | '16:9' | '9:16' | 'original' | 'free';

export interface ResolutionOption {
  label: string;
  width: number;
  height: number;
}

export interface CropFrameOverlayProps {
  shape?: CropShape;
  onSelectShape?: (shape: CropShape) => void;
  aspectRatio: AspectRatioType;
  onSelectAspectRatio: (ratio: AspectRatioType) => void;
  selectedResolution: ResolutionOption | null;
  onSelectResolution: (res: ResolutionOption) => void;
  naturalWidth: number;
  naturalHeight: number;
  currentCropDimensions?: { width: number; height: number };
  onResetToFull?: () => void;
}

export default function CropFrameOverlay({
  shape = 'rect',
  onSelectShape,
  aspectRatio,
  onSelectAspectRatio,
  selectedResolution,
  onSelectResolution,
  naturalWidth,
  naturalHeight,
  currentCropDimensions,
  onResetToFull,
}: CropFrameOverlayProps) {
  const { language } = useLanguage();

  const aspectRatios: { key: AspectRatioType; label: string; ratioW: number; ratioH: number }[] = [
    { key: 'original', label: language === 'ru' ? 'Оригинал' : 'Original', ratioW: naturalWidth || 16, ratioH: naturalHeight || 9 },
    { key: '1:1', label: '1:1', ratioW: 1, ratioH: 1 },
    { key: '3:4', label: '3:4', ratioW: 3, ratioH: 4 },
    { key: '4:3', label: '4:3', ratioW: 4, ratioH: 3 },
    { key: '16:9', label: '16:9', ratioW: 16, ratioH: 9 },
    { key: '9:16', label: '9:16', ratioW: 9, ratioH: 16 },
    { key: 'free', label: language === 'ru' ? 'Свободно' : 'Free', ratioW: currentCropDimensions?.width || naturalWidth || 1, ratioH: currentCropDimensions?.height || naturalHeight || 1 },
  ];

  // Dynamically calculate available resolutions strictly for downscaling (max = natural dimensions or current crop)
  const availableResolutions: ResolutionOption[] = useMemo(() => {
    const nw = currentCropDimensions?.width || naturalWidth || 1920;
    const nh = currentCropDimensions?.height || naturalHeight || 1080;
    const isPortrait = nh > nw;

    if (shape === 'circle') {
      const diameter = Math.min(nw, nh);
      const options: ResolutionOption[] = [
        {
          label: `${language === 'ru' ? 'Оригинал' : 'Original'} (⌀ ${diameter} px)`,
          width: diameter,
          height: diameter,
        },
      ];
      const circleTiers = [
        { name: '2K', size: 2048 },
        { name: 'Full HD', size: 1080 },
        { name: 'HD', size: 720 },
        { name: 'SD', size: 480 },
        { name: 'Avatar', size: 256 },
      ];
      for (const tier of circleTiers) {
        if (tier.size < diameter && tier.size >= 120) {
          options.push({
            label: `${tier.name} (⌀ ${tier.size} px)`,
            width: tier.size,
            height: tier.size,
          });
        }
      }
      return options;
    }

    // Get current ratio multiplier
    const current = aspectRatios.find((r) => r.key === aspectRatio) || aspectRatios[0];
    const rW = aspectRatio === 'free' ? nw : current.ratioW;
    const rH = aspectRatio === 'free' ? nh : current.ratioH;

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
  }, [shape, aspectRatio, currentCropDimensions, naturalWidth, naturalHeight, language]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 w-full">
      {/* Shape Selector & Aspect Ratios */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        {/* Shape Switcher (Rectangle vs Circle) */}
        {onSelectShape && (
          <div className="flex items-center bg-slate-900/90 rounded-xl p-0.5 border border-slate-700/80 mr-1.5 shrink-0 shadow-xs">
            <button
              type="button"
              onClick={() => onSelectShape('rect')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                shape === 'rect'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={language === 'ru' ? 'Прямоугольная рамка' : 'Rectangular frame'}
            >
              <Square size={13} />
              <span>{language === 'ru' ? 'Прямоугольник' : 'Rectangle'}</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectShape('circle')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                shape === 'circle'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={language === 'ru' ? 'Круглая рамка с вырезом по кругу' : 'Circular frame with round cutout'}
            >
              <Circle size={13} />
              <span>{language === 'ru' ? 'Круг' : 'Circle'}</span>
            </button>
          </div>
        )}

        {/* Aspect Ratio Chips (when rectangular) */}
        {shape === 'rect' ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-semibold mr-0.5">
              {language === 'ru' ? 'Пропорции:' : 'Aspect:'}
            </span>
            {aspectRatios.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectAspectRatio(item.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  aspectRatio === item.key
                    ? 'bg-primary text-white shadow-sm ring-1 ring-primary/40'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/60 border border-slate-700/60 px-3 py-1 rounded-full">
            <span className="text-primary font-bold">⌀</span>
            <span>
              {language === 'ru' ? 'Круглый вырез (диаметр регулируется рамкой)' : 'Circular cutout (diameter adjusted by frame)'}
            </span>
          </div>
        )}

        {/* Fit Full Photo Button */}
        {onResetToFull && (
          <button
            type="button"
            onClick={onResetToFull}
            className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0 ml-1"
            title={language === 'ru' ? 'Охватить полностью всю фотографию' : 'Fit entire photo'}
          >
            <Maximize size={12} />
            <span>{language === 'ru' ? 'Вся фотография' : 'Full Photo'}</span>
          </button>
        )}
      </div>

      {/* Target Resolution Dropdown */}
      <div className="flex items-center gap-2 shrink-0">
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
