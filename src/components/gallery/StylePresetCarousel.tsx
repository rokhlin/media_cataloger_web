import { useLanguage } from '../../i18n/LanguageContext';
import { Eye, Sparkles } from 'lucide-react';

export interface StylePreset {
  id: string;
  nameRu: string;
  nameEn: string;
  tagRu: string;
  tagEn: string;
  cssFilter: string;
  thumbBg: string;
  prompt: string;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'original',
    nameRu: 'Оригинал',
    nameEn: 'Original',
    tagRu: 'Без изменений',
    tagEn: 'No style',
    cssFilter: 'none',
    thumbBg: 'linear-gradient(135deg, #1e293b, #334155)',
    prompt: '',
  },
  {
    id: 'hollywood_warm',
    nameRu: 'Hollywood Warm',
    nameEn: 'Hollywood Warm',
    tagRu: 'Кинематограф',
    tagEn: 'Cinematic',
    cssFilter: 'sepia(0.3) saturate(1.4) contrast(1.1)',
    thumbBg: 'linear-gradient(135deg, #78350f, #d97706)',
    prompt: 'Сохрани черты лица человека на фото без изменений. Apply cinematic colour grading — warm golden tones. Lift shadows to warm amber, rich deep midtones, slightly muted highlights. Film grain. Christopher Nolan or Denis Villeneuve aesthetic.',
  },
  {
    id: 'sci_fi_teal',
    nameRu: 'Sci-Fi Teal & Blue',
    nameEn: 'Sci-Fi Teal & Blue',
    tagRu: 'Blade Runner',
    tagEn: 'Futuristic',
    cssFilter: 'hue-rotate(180deg) saturate(1.2) contrast(1.2)',
    thumbBg: 'linear-gradient(135deg, #0c4a6e, #0284c7)',
    prompt: 'Сохрани черты лица человека на фото без изменений. Apply cool cinematic colour grading. Deep teal shadows, muted cool midtones, slightly blue highlights. Blade Runner or Arrival aesthetic.',
  },
  {
    id: 'orange_teal',
    nameRu: 'Orange & Teal',
    nameEn: 'Orange & Teal',
    tagRu: 'Блокбастер',
    tagEn: 'Blockbuster',
    cssFilter: 'saturate(1.5) contrast(1.3) hue-rotate(-20deg)',
    thumbBg: 'linear-gradient(135deg, #0f766e, #ea580c)',
    prompt: 'Сохрани черты лица человека на фото без изменений. Apply Hollywood orange and teal colour grade. Skin tones shift to warm orange-amber. Shadows shift to teal-cyan. Blockbuster movie aesthetic.',
  },
  {
    id: 'kodak_gold',
    nameRu: 'Kodak Gold 200',
    nameEn: 'Kodak Gold 200',
    tagRu: '35мм плёнка',
    tagEn: 'Vintage Film',
    cssFilter: 'sepia(0.4) saturate(1.3) contrast(1.15)',
    thumbBg: 'linear-gradient(135deg, #854d0e, #ca8a04)',
    prompt: 'Сохрани черты лица человека на фото без изменений. Apply Kodak Gold 200 film emulation. Warm golden yellows and orange skin tones. Authentic 35mm film grain, gentle bloom in highlights.',
  },
  {
    id: 'fujifilm_400h',
    nameRu: 'Fujifilm Pro 400H',
    nameEn: 'Fujifilm Pro 400H',
    tagRu: 'Пастельная',
    tagEn: 'Soft Pastel',
    cssFilter: 'brightness(1.08) saturate(0.92) contrast(0.96)',
    thumbBg: 'linear-gradient(135deg, #065f46, #34d399)',
    prompt: 'Сохрани черты лица человека на фото без изменений. Apply Fujifilm Pro 400H film emulation. Soft pastel skin tones, cool shadows with green tint, romantic soft aesthetic.',
  },
  {
    id: 'disposable_90s',
    nameRu: '1990s Мыльница',
    nameEn: '1990s Disposable',
    tagRu: 'Ретро-вспышка',
    tagEn: 'Flash Snapshot',
    cssFilter: 'brightness(1.15) contrast(1.22) sepia(0.25)',
    thumbBg: 'linear-gradient(135deg, #4c1d95, #c084fc)',
    prompt: 'Сохрани черты лица человека на фото без изменений. Apply authentic 1990s disposable camera aesthetic. Flash highlights, warm highlights, cool green shadows, vintage grain.',
  },
  {
    id: 'kodak_tri_x',
    nameRu: 'Kodak Tri-X B&W',
    nameEn: 'Kodak Tri-X B&W',
    tagRu: 'Контрастный ч/б',
    tagEn: 'Fine Art B&W',
    cssFilter: 'grayscale(1) contrast(1.4) brightness(0.95)',
    thumbBg: 'linear-gradient(135deg, #18181b, #71717a)',
    prompt: 'Сохрани черты лица человека на фото без изменений. Convert to black and white — high contrast fine art photography. Deep rich blacks, bright whites, Henri Cartier-Bresson aesthetic.',
  },
  {
    id: 'rembrandt',
    nameRu: 'Свет Рембрандта',
    nameEn: 'Rembrandt Light',
    tagRu: 'Кьяроскуро',
    tagEn: 'Chiaroscuro',
    cssFilter: 'contrast(1.35) brightness(0.88) sepia(0.2)',
    thumbBg: 'linear-gradient(135deg, #451a03, #b45309)',
    prompt: 'Сохрани черты лица человека на фото без изменений. Apply dramatic Rembrandt studio lighting. Single key light creating a luminous triangle under the eye on shadow side. Deep atmospheric shadows.',
  },
  {
    id: 'oil_painting',
    nameRu: 'Масляная живопись',
    nameEn: 'Classic Oil Painting',
    tagRu: 'Холст и масло',
    tagEn: 'Masterpiece Canvas',
    cssFilter: 'saturate(1.35) contrast(1.25) sepia(0.35)',
    thumbBg: 'linear-gradient(135deg, #713f12, #ca8a04)',
    prompt: 'Сохрани черты лица человека на фото без изменений. Transform into a classic oil painting masterpiece. Rich visible brushstrokes, textured canvas, warm oil-paint color palette.',
  },
  {
    id: 'cyberpunk_neon',
    nameRu: 'Cyberpunk Neon',
    nameEn: 'Cyberpunk Neon',
    tagRu: 'Неоновые огни',
    tagEn: 'Neon Night Glow',
    cssFilter: 'hue-rotate(280deg) saturate(1.8) contrast(1.3)',
    thumbBg: 'linear-gradient(135deg, #831843, #ec4899)',
    prompt: 'Сохрани черты лица человека на фото без изменений. Add vibrant neon light accents and colored rim lighting (magenta and cyan). Subtle futuristic reflections, dark moody contrast.',
  },
];

export interface StylePresetCarouselProps {
  selectedPresetId: string;
  onSelectPreset: (preset: StylePreset) => void;
  isComparingBefore: boolean;
  onStartCompare: () => void;
  onEndCompare: () => void;
}

export default function StylePresetCarousel({
  selectedPresetId,
  onSelectPreset,
  isComparingBefore,
  onStartCompare,
  onEndCompare,
}: StylePresetCarouselProps) {
  const { language } = useLanguage();

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Before/After Indicator Pill when a style is active */}
      {selectedPresetId !== 'original' && (
        <div className="flex items-center justify-between pb-1">
          <span className="text-xs text-primary font-semibold flex items-center gap-1.5">
            <Sparkles size={13} />
            <span>
              {language === 'ru'
                ? 'Стиль активен (предпросмотр)'
                : 'Style active (preview)'}
            </span>
          </span>
          <button
            type="button"
            onMouseDown={onStartCompare}
            onMouseUp={onEndCompare}
            onTouchStart={onStartCompare}
            onTouchEnd={onEndCompare}
            className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer select-none ${
              isComparingBefore
                ? 'bg-amber-500 text-black scale-95 ring-2 ring-amber-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'
            }`}
            title={language === 'ru' ? 'Зажмите для просмотра оригинала' : 'Hold to view original'}
          >
            <Eye size={12} />
            <span>
              {isComparingBefore
                ? (language === 'ru' ? 'ДО (Оригинал)' : 'BEFORE (Original)')
                : (language === 'ru' ? 'Удерживайте для «ДО»' : 'Hold for Before')}
            </span>
          </button>
        </div>
      )}

      {/* Preset Cards Track */}
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
        {STYLE_PRESETS.map((preset) => {
          const isSelected = selectedPresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset)}
              className={`flex flex-col text-left w-28 shrink-0 rounded-xl overflow-hidden border-2 transition-all cursor-pointer group ${
                isSelected
                  ? 'border-primary ring-2 ring-primary/40 bg-primary/10 scale-102'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              {/* Thumbnail Gradient Preview */}
              <div
                className="h-14 w-full relative flex items-center justify-center transition-transform group-hover:scale-105"
                style={{ background: preset.thumbBg }}
              >
                {isSelected && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_#3b82f6]" />
                )}
                <span className="text-[10px] font-bold text-white/90 drop-shadow-md px-1.5 py-0.5 rounded bg-black/40 backdrop-blur-xs">
                  {language === 'ru' ? preset.tagRu : preset.tagEn}
                </span>
              </div>

              {/* Title & Info */}
              <div className="p-2">
                <div className="text-[11px] font-bold text-foreground truncate">
                  {language === 'ru' ? preset.nameRu : preset.nameEn}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
