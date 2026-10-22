import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Tag, AlertTriangle, X, Check, Search } from 'lucide-react';

export interface TagCatalogItem {
  tag: string;
  category?: string;
  media_count?: number;
  person_count?: number;
  count?: number;
}

export interface UniversalTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'viewer_add' | 'person_add' | 'admin_create' | 'admin_edit';
  targetName?: string;
  initialTag?: string;
  initialCategory?: string;
  existingTags?: Array<TagCatalogItem | string>;
  onSave?: (data: { tag: string; category: string; targetTag?: string; isMerge?: boolean }) => Promise<void> | void;
  onSubmit?: (tag: string) => Promise<void> | void;
}

export const TAG_CATEGORIES = [
  { id: 'general', label: 'Общее', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { id: 'people', label: 'Люди', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { id: 'relationship', label: 'Семья / Родство', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  { id: 'friends', label: 'Друзья', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { id: 'event', label: 'Событие', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { id: 'place', label: 'Место', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
  { id: 'holiday', label: 'Праздник', color: 'bg-pink-500/10 text-pink-400 border-pink-500/30' },
  { id: 'nature', label: 'Природа', color: 'bg-teal-500/10 text-teal-400 border-teal-500/30' },
  { id: 'food', label: 'Еда / Кулинария', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  { id: 'work', label: 'Работа / Проекты', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
  { id: 'sport', label: 'Спорт / Активность', color: 'bg-green-500/10 text-green-400 border-green-500/30' },
  { id: 'custom', label: 'Другое', color: 'bg-gray-500/10 text-gray-400 border-gray-500/30' },
];

export const UniversalTagModal: React.FC<UniversalTagModalProps> = ({
  isOpen,
  onClose,
  mode,
  initialTag = '',
  initialCategory = 'general',
  existingTags = [],
  onSave,
  onSubmit,
}) => {
  const [tagName, setTagName] = useState('');
  const [category, setCategory] = useState('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTagName(initialTag ? initialTag.replace(/^#/, '') : '');
      setCategory(initialCategory || 'general');
      setError(null);
      setShowSuggestions(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialTag, initialCategory]);

  const cleanCurrentTag = useMemo(() => {
    return tagName.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '_');
  }, [tagName]);

  const cleanInitialTag = useMemo(() => {
    return (initialTag || '').trim().toLowerCase().replace(/^#+/, '');
  }, [initialTag]);

  const normalizedExistingTags: TagCatalogItem[] = useMemo(() => {
    return existingTags.map((t) => (typeof t === 'string' ? { tag: t, category: 'general' } : t));
  }, [existingTags]);

  // Check if renaming target matches an existing tag (Merge scenario)
  const mergeTarget = useMemo(() => {
    if (mode !== 'admin_edit' || !cleanCurrentTag || cleanCurrentTag === cleanInitialTag) {
      return null;
    }
    return normalizedExistingTags.find(
      (t) => t.tag.toLowerCase().replace(/^#+/, '') === cleanCurrentTag
    ) || null;
  }, [mode, cleanCurrentTag, cleanInitialTag, normalizedExistingTags]);

  // Autocomplete suggestions in add modes
  const suggestions = useMemo(() => {
    if (!cleanCurrentTag || mode === 'admin_edit') return [];
    return normalizedExistingTags
      .filter((t) => {
        const norm = t.tag.toLowerCase().replace(/^#+/, '');
        return norm.includes(cleanCurrentTag) && norm !== cleanCurrentTag;
      })
      .slice(0, 6);
  }, [cleanCurrentTag, normalizedExistingTags, mode]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!cleanCurrentTag) {
      setError('Имя тега не может быть пустым');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (onSave) {
        await onSave({
          tag: cleanCurrentTag,
          category,
          targetTag: cleanCurrentTag,
          isMerge: Boolean(mergeTarget),
        });
      }
      if (onSubmit) {
        await onSubmit(cleanCurrentTag);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Не удалось сохранить тег');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getModalTitle = () => {
    switch (mode) {
      case 'viewer_add':
        return 'Добавить тег к медиафайлу';
      case 'person_add':
        return 'Добавить персональный тег';
      case 'admin_create':
        return 'Создать глобальный тег';
      case 'admin_edit':
        return `Редактирование тега #${cleanInitialTag}`;
    }
  };

  const getSubmitButtonText = () => {
    if (isSubmitting) return 'Сохранение...';
    if (mode === 'admin_edit') {
      if (mergeTarget) {
        return `⚡ Объединить в «#${cleanCurrentTag}»`;
      }
      return 'Сохранить изменения';
    }
    return 'Добавить тег';
  };

  return (
    <div
      id="universal-tag-modal"
      data-testid="universal-tag-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#111827] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#162032]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-wide">{getModalTitle()}</h3>
              <p className="text-xs text-gray-400">
                {mode === 'person_add'
                  ? 'Тег автоматически унаследуется всеми фото с этой персоной'
                  : 'Используйте теги для мгновенной фильтрации в галерее'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 text-xs bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Merge Warning Notification */}
          {mergeTarget && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Объединение тегов (Deduplicating Merge)</span>
              </div>
              <p className="text-gray-300 leading-relaxed">
                Тег <span className="font-mono font-bold text-white">#{cleanCurrentTag}</span> уже существует
                ({(mergeTarget.media_count || mergeTarget.count || 0)} медиафайлов).
                Переименование объединит все файлы тега <span className="font-mono text-amber-300">#{cleanInitialTag}</span> в него.
              </p>
            </div>
          )}

          {/* Tag Name Input */}
          <div className="space-y-1.5 relative">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Имя тега
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">#</span>
              <input
                ref={inputRef}
                type="text"
                value={tagName}
                onChange={(e) => {
                  setTagName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="отпуск_2026, семья, пляж..."
                className="w-full pl-8 pr-4 py-2.5 bg-[#1F2937] border border-white/10 rounded-xl text-white font-medium placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 z-20 bg-[#1F2937] border border-white/15 rounded-xl shadow-xl overflow-hidden py-1">
                <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1 border-b border-white/5">
                  <Search className="w-3 h-3" />
                  Существующие похожие теги
                </div>
                {suggestions.map((s) => (
                  <button
                    key={s.tag}
                    type="button"
                    onClick={() => {
                      setTagName(s.tag.replace(/^#/, ''));
                      if (s.category) setCategory(s.category);
                      setShowSuggestions(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-white/5 flex items-center justify-between transition-colors text-xs"
                  >
                    <span className="font-mono font-medium text-blue-400">#{s.tag.replace(/^#/, '')}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400">
                        {s.category || 'general'}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {s.media_count || s.count || 0} фото
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Category Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Категория
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {TAG_CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium text-left border flex items-center justify-between transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/20 text-white shadow-sm'
                        : 'border-white/5 bg-[#1F2937]/50 text-gray-400 hover:border-white/10 hover:text-gray-200'
                    }`}
                  >
                    <span>{cat.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !cleanCurrentTag}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-lg flex items-center gap-1.5 transition-all ${
                mergeTarget
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/30'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {getSubmitButtonText()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
