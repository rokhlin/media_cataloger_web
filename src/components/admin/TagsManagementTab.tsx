import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Tag, Search, Plus, Trash2, Edit2, AlertCircle, RefreshCw, CheckCircle2, Filter, Layers } from 'lucide-react';
import { UniversalTagModal, TAG_CATEGORIES, TagCatalogItem } from '../common/UniversalTagModal';

export const TagsManagementTab: React.FC = () => {
  const [tags, setTags] = useState<TagCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'admin_create' | 'admin_edit'>('admin_create');
  const [activeTag, setActiveTag] = useState<TagCatalogItem | null>(null);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tags/catalog');
      if (!res.ok) throw new Error(`Ошибка загрузки каталога тегов: ${res.status}`);
      const data = await res.json();
      setTags(Array.isArray(data) ? data : (data.tags || []));
    } catch (err: any) {
      setError(err?.message || 'Не удалось загрузить теги');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Metrics
  const metrics = useMemo(() => {
    const totalTags = tags.length;
    const totalMedia = tags.reduce((acc, t) => acc + (t.media_count || 0), 0);
    const totalPersons = tags.reduce((acc, t) => acc + (t.person_count || 0), 0);
    const activeCategories = new Set(tags.map((t) => t.category || 'general')).size;
    return { totalTags, totalMedia, totalPersons, activeCategories };
  }, [tags]);

  // Filtered tags
  const filteredTags = useMemo(() => {
    return tags.filter((t) => {
      const matchesSearch = t.tag.toLowerCase().includes(search.toLowerCase().trim().replace(/^#/, ''));
      const matchesCategory = selectedCategory === 'all' || (t.category || 'general') === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [tags, search, selectedCategory]);

  // Handle Save from UniversalTagModal
  const handleSaveTag = async (data: { tag: string; category: string; targetTag?: string; isMerge?: boolean }) => {
    if (modalMode === 'admin_create') {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: data.tag, category: data.category }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Ошибка создания тега');
      }
      showToast(`Тег #${data.tag} успешно создан`);
    } else if (modalMode === 'admin_edit' && activeTag) {
      const res = await fetch('/api/tags/rename', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_tag: activeTag.tag,
          new_tag: data.targetTag || data.tag,
          category: data.category,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Ошибка обновления тега');
      }
      showToast(data.isMerge ? `Тег объединен с #${data.targetTag || data.tag}` : `Тег #${data.tag} обновлен`);
    }
    await fetchTags();
  };

  // Handle Delete Tag
  const handleDeleteTag = async (item: TagCatalogItem) => {
    if (!window.confirm(`Вы уверены, что хотите удалить тег #${item.tag}? Он будет снят со всех медиафайлов (${item.media_count || 0}) и персон.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/tags?tag=${encodeURIComponent(item.tag)}&category=${encodeURIComponent(item.category || '')}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Ошибка удаления тега: ${res.status}`);
      showToast(`Тег #${item.tag} удален`);
      await fetchTags();
    } catch (err: any) {
      setError(err?.message || 'Не удалось удалить тег');
    }
  };

  const getCategoryBadgeClass = (category?: string) => {
    const match = TAG_CATEGORIES.find((c) => c.id === category);
    return match ? match.color : 'bg-gray-500/10 text-gray-400 border-gray-500/30';
  };

  return (
    <div id="tags-management-tab" data-testid="tags-management-tab" className="space-y-6 animate-fade-in">
      {/* Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-xl flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Metrics Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#162032] border border-white/5 space-y-1">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Всего тегов</span>
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-400" />
            <span>{metrics.totalTags}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#162032] border border-white/5 space-y-1">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Медиафайлов с тегами</span>
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" />
            <span>{metrics.totalMedia}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#162032] border border-white/5 space-y-1">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Тегированных персон</span>
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-rose-400" />
            <span>{metrics.totalPersons}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#162032] border border-white/5 space-y-1">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Активных категорий</span>
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            <Filter className="w-5 h-5 text-amber-400" />
            <span>{metrics.activeCategories}</span>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="p-4 rounded-xl bg-[#162032] border border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск тегов по имени..."
              className="w-full pl-9 pr-4 py-2 bg-[#1F2937] border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-[#1F2937] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="all">Все категории ({tags.length})</option>
            {TAG_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            onClick={fetchTags}
            disabled={loading}
            className="p-2 rounded-xl bg-[#1F2937] border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Обновить"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setActiveTag(null);
              setModalMode('admin_create');
              setIsModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-900/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Создать тег</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tags Catalog Table */}
      <div className="rounded-xl border border-white/10 bg-[#162032] overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
            <span className="text-xs">Загрузка каталога тегов...</span>
          </div>
        ) : filteredTags.length === 0 ? (
          <div className="py-16 text-center text-gray-500 space-y-2">
            <Tag className="w-8 h-8 mx-auto opacity-30" />
            <p className="text-xs">Теги не найдены</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-[#1F2937]/50 text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Тег</th>
                <th className="py-3 px-4">Категория</th>
                <th className="py-3 px-4 text-center">Медиафайлов</th>
                <th className="py-3 px-4 text-center">Персон</th>
                <th className="py-3 px-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTags.map((item) => (
                <tr key={`${item.tag}-${item.category}`} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-white">
                    <span className="text-blue-400">#</span>
                    {item.tag.replace(/^#/, '')}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-md border text-[11px] font-medium ${getCategoryBadgeClass(item.category)}`}>
                      {TAG_CATEGORIES.find((c) => c.id === item.category)?.label || item.category || 'Общее'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-gray-300 font-mono">
                    {item.media_count || 0}
                  </td>
                  <td className="py-3 px-4 text-center text-gray-300 font-mono">
                    {item.person_count || 0}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setActiveTag(item);
                          setModalMode('admin_edit');
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        title="Редактировать или объединить тег"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTag(item)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Удалить тег"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Universal Tag Modal Instance */}
      <UniversalTagModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode={modalMode}
        initialTag={activeTag?.tag}
        initialCategory={activeTag?.category || 'general'}
        existingTags={tags}
        onSave={handleSaveTag}
      />
    </div>
  );
};
