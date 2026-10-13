import React, { useState } from 'react';
import { Smile, Merge, Eye, EyeOff, Search, Edit2, Check } from 'lucide-react';
import { cn } from '@/utils';

export const PeopleFacesScreen: React.FC = () => {
  const [searchFilter, setSearchFilter] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const [people, setPeople] = useState([
    { id: 1, name: 'Анна', count: 184, isHidden: false, avatarColor: 'from-pink-500 to-rose-600', emoji: '👩' },
    { id: 2, name: 'Михаил', count: 142, isHidden: false, avatarColor: 'from-blue-500 to-cyan-600', emoji: '👨' },
    { id: 3, name: 'Елена', count: 96, isHidden: false, avatarColor: 'from-purple-500 to-indigo-600', emoji: '👱‍♀️' },
    { id: 4, name: 'Дмитрий', count: 78, isHidden: false, avatarColor: 'from-emerald-500 to-teal-600', emoji: '🧔' },
    { id: 5, name: 'София', count: 65, isHidden: false, avatarColor: 'from-amber-500 to-orange-600', emoji: '👧' },
    { id: 6, name: 'Артём', count: 42, isHidden: false, avatarColor: 'from-violet-500 to-purple-600', emoji: '👦' },
    { id: 7, name: 'Неизвестный #1', count: 24, isHidden: false, avatarColor: 'from-slate-500 to-gray-600', emoji: '👤' },
    { id: 8, name: 'Неизвестный #2', count: 18, isHidden: true, avatarColor: 'from-slate-500 to-gray-600', emoji: '👤' },
  ]);

  const handleStartEdit = (index: number, currentName: string) => {
    setEditingIndex(index);
    setEditName(currentName);
  };

  const handleSaveEdit = (id: number) => {
    setPeople((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: editName.trim() || p.name } : p))
    );
    setEditingIndex(null);
  };

  const toggleVisibility = (id: number) => {
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
        </div>
      </div>

      {/* Filter Bar */}
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

      {/* Faces Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
        {filteredPeople.map((person, index) => {
          const isEditing = editingIndex === index;

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
                className={`w-20 h-20 rounded-full bg-gradient-to-tr ${person.avatarColor} text-white flex items-center justify-center text-3xl shadow-sm mb-3 group-hover:scale-105 transition-transform`}
              >
                {person.emoji}
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
                      if (e.key === 'Escape') setEditingIndex(null);
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
                    onClick={() => handleStartEdit(index, person.name)}
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
    </div>
  );
};

export default PeopleFacesScreen;
