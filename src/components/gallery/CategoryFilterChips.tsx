import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { cn } from '../../utils';

export type CategoryFilterKey =
  | 'all'
  | 'family_memories'
  | 'food'
  | 'nature'
  | 'animals'
  | 'documents'
  | 'business_card'
  | 'dashcam'
  | 'other';

export interface CategoryChipItem {
  id: CategoryFilterKey;
  labelRu: string;
  labelEn: string;
  icon: string;
}

export const CATEGORY_CHIPS: CategoryChipItem[] = [
  { id: 'all', labelRu: 'Все', labelEn: 'All', icon: '✨' },
  { id: 'family_memories', labelRu: 'Семейное', labelEn: 'Family', icon: '👨‍👩‍👧‍👦' },
  { id: 'food', labelRu: 'Еда', labelEn: 'Food', icon: '🍲' },
  { id: 'nature', labelRu: 'Природа', labelEn: 'Nature', icon: '🌲' },
  { id: 'animals', labelRu: 'Животные', labelEn: 'Animals', icon: '🐾' },
  { id: 'documents', labelRu: 'Документы', labelEn: 'Documents', icon: '📄' },
  { id: 'business_card', labelRu: 'Визитки / Вывески', labelEn: 'Cards & Signs', icon: '🏷️' },
  { id: 'dashcam', labelRu: 'Видеорегистратор', labelEn: 'Dashcam', icon: '🚗' },
  { id: 'other', labelRu: 'Разное', labelEn: 'Other', icon: '📁' },
];

export interface CategoryFilterChipsProps {
  selectedCategory: CategoryFilterKey;
  onSelectCategory: (category: CategoryFilterKey) => void;
  categoryCounts?: Record<string, number>;
  className?: string;
}

export const CategoryFilterChips: React.FC<CategoryFilterChipsProps> = ({
  selectedCategory,
  onSelectCategory,
  categoryCounts = {},
  className = '',
}) => {
  const { language } = useLanguage();
  const isRu = language === 'ru';

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 overflow-x-auto py-1 px-1 scrollbar-none no-scrollbar',
        className
      )}
    >
      {CATEGORY_CHIPS.map((chip) => {
        const isSelected = selectedCategory === chip.id;
        const count = categoryCounts[chip.id];

        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onSelectCategory(chip.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer transition-all select-none border',
              isSelected
                ? 'bg-primary text-primary-foreground border-primary shadow-xs scale-102 font-bold'
                : 'bg-card/70 hover:bg-muted/80 text-muted-foreground hover:text-foreground border-border/70 hover:border-border'
            )}
            title={isRu ? chip.labelRu : chip.labelEn}
          >
            <span className="text-sm leading-none">{chip.icon}</span>
            <span>{isRu ? chip.labelRu : chip.labelEn}</span>
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  'ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono leading-none',
                  isSelected
                    ? 'bg-white/25 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default CategoryFilterChips;
