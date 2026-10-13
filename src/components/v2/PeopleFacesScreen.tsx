import React, { useState, useEffect } from 'react';
import { Smile, Merge, Eye, EyeOff, Search, Edit2, Check, UserCheck, RefreshCw } from 'lucide-react';
import { cn } from '@/utils';
import { Link } from 'react-router-dom';

interface PersonDisplay {
  id: string | number;
  name: string;
  count: number;
  isHidden: boolean;
  avatarUrl?: string | null;
  avatarColor?: string;
  initials?: string;
}

export const PeopleFacesScreen: React.FC = () => {
  const [people, setPeople] = useState<PersonDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editName, setEditName] = useState('');

  const loadFaces = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/faces/persons');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const colors = [
            'from-pink-500 to-rose-600',
            'from-blue-500 to-cyan-600',
            'from-purple-500 to-indigo-600',
            'from-emerald-500 to-teal-600',
            'from-amber-500 to-orange-600',
            'from-violet-500 to-purple-600',
          ];

          const formatted: PersonDisplay[] = data.map((item: any, i: number) => {
            const name = item.name || `Лицо #${i + 1}`;
            const count = item.media_count || item.count || (item.face_ids ? item.face_ids.length : 1);
            const repFace = item.representative_face_id || (item.face_ids && item.face_ids[0]);
            const avatarUrl = repFace ? `/api/faces/image/${repFace}` : null;
            const initials = name.slice(0, 2).toUpperCase();

            return {
              id: item.person_id || item.id || name,
              name,
              count,
              isHidden: Boolean(item.is_hidden),
              avatarUrl,
              avatarColor: colors[i % colors.length],
              initials,
            };
          });

          setPeople(formatted);
        } else {
          setPeople([]);
        }
      } else {
        setPeople([]);
      }
    } catch (e) {
      console.warn('Failed to fetch recognized persons:', e);
      setPeople([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFaces();
  }, []);

  const handleStartEdit = (id: string | number, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const handleSaveEdit = async (id: string | number) => {
    const trimmed = editName.trim();
    if (trimmed) {
      setPeople((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p))
      );
      // Attempt backend rename if supported
      try {
        await fetch('/api/faces/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldName: String(id), newName: trimmed }),
        });
      } catch {}
    }
    setEditingId(null);
  };

  const toggleVisibility = (id: string | number) => {
    setPeople((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isHidden: !p.isHidden } : p))
    );
  };

  const filteredPeople = people.filter((p) => {
    if (!showHidden && p.isHidden) return false;
    if (searchFilter && !p.name.toLowerCase().includes(searchFilter.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <Smile className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-extrabold text-foreground">Люди и распознанные лица</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Управляйте кластерами распознанных лиц, объединяйте дубликаты и задавайте имена.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadFaces}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Обновить список лиц"
          >
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
            <span>Обновить</span>
          </button>

          {people.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowHidden(!showHidden)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                {showHidden ? <EyeOff size={15} /> : <Eye size={15} />}
                <span>{showHidden ? 'Скрыть скрытые' : 'Показать скрытые'}</span>
              </button>

              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-white shadow-xs transition-colors"
              >
                <Merge size={15} />
                <span>Объединить лица</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Bar (visible when there are people) */}
      {people.length > 0 && (
        <div className="max-w-md relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Фильтр по имени..."
            className="w-full h-10 pl-10 pr-4 bg-card border border-border/70 rounded-xl text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin mb-3 text-primary" />
          <p className="text-sm">Загрузка распознанных лиц...</p>
        </div>
      ) : people.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-card/40 border border-dashed border-border/80 rounded-3xl">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <UserCheck className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Нет распознанных лиц</h2>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-6">
            Распознанные лица появятся здесь после обработки медиафайлов нейросетью или ручной разметки в просмотрщике фото.
          </p>
          <Link
            to="/photos"
            className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs"
          >
            Перейти к медиатеке
          </Link>
        </div>
      ) : (
        /* Faces Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {filteredPeople.map((person) => {
            const isEditing = editingId === person.id;

            return (
              <div
                key={person.id}
                className={cn(
                  'group bg-card border rounded-2xl p-4 flex flex-col items-center text-center transition-all duration-200 relative shadow-xs hover:shadow-md hover:border-primary/50',
                  person.isHidden ? 'opacity-60 border-dashed border-border' : 'border-border/70'
                )}
              >
                {/* Hide / Show Hover Button */}
                <button
                  type="button"
                  onClick={() => toggleVisibility(person.id)}
                  className="absolute top-2.5 right-2.5 p-1 rounded-md text-muted-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                  title={person.isHidden ? 'Восстановить видимость' : 'Скрыть лицо'}
                >
                  {person.isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>

                {/* Circular Avatar Crop */}
                <div
                  className={cn(
                    'w-20 h-20 rounded-full flex items-center justify-center text-xl font-bold shadow-sm mb-3 group-hover:scale-105 transition-transform overflow-hidden',
                    !person.avatarUrl && `bg-gradient-to-tr ${person.avatarColor} text-white`
                  )}
                >
                  {person.avatarUrl ? (
                    <img
                      src={person.avatarUrl}
                      alt={person.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    person.initials || '👤'
                  )}
                </div>

                {/* Editable Name Tag */}
                {isEditing ? (
                  <div className="flex items-center gap-1 w-full mt-1">
                    <input
                      type="text"
                      value={editName}
                      autoFocus
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(person.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full text-xs font-semibold px-2 py-1 bg-muted border border-primary rounded outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(person.id)}
                      className="p-1 text-primary hover:bg-primary/10 rounded"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="w-full flex items-center justify-center gap-1.5 group/name">
                    <span className="font-bold text-sm text-foreground truncate max-w-[110px]">
                      {person.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(person.id, person.name)}
                      className="p-0.5 text-muted-foreground hover:text-primary opacity-0 group-hover/name:opacity-100 transition-opacity"
                      title="Изменить имя"
                    >
                      <Edit2 size={12} />
                    </button>
                  </div>
                )}

                {/* Photo Count Badge */}
                <span className="text-xs text-muted-foreground mt-1">
                  {person.count} фото
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PeopleFacesScreen;
