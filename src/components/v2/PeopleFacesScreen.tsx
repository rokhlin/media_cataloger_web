import React, { useState, useEffect } from 'react';
import { Smile, Merge, Eye, EyeOff, Search, Edit2, Check, UserCheck, RefreshCw, ExternalLink, Camera, X, TreePine, Crop } from 'lucide-react';
import { cn } from '@/utils';
import { Link, useNavigate } from 'react-router-dom';
import { PersonProfileModal, type PersonDisplay } from './modals/PersonProfileModal';
import { ManualFaceCropModal } from '../faces/ManualFaceCropModal';

export const PeopleFacesScreen: React.FC = () => {
  const navigate = useNavigate();
  const [people, setPeople] = useState<PersonDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editName, setEditName] = useState('');
  const [choosingCoverPerson, setChoosingCoverPerson] = useState<PersonDisplay | null>(null);
  const [selectedPersonForProfile, setSelectedPersonForProfile] = useState<PersonDisplay | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

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

            // Collect available faces for cover photo selection
            const facesList: Array<{ face_id: string; image_path?: string }> = [];
            if (Array.isArray(item.reference_faces) && item.reference_faces.length > 0) {
              for (const rf of item.reference_faces) {
                if (rf.face_id && !facesList.some((f) => f.face_id === rf.face_id)) {
                  facesList.push({ face_id: rf.face_id, image_path: rf.image_path });
                }
              }
            }
            if (Array.isArray(item.face_ids)) {
              for (const fid of item.face_ids) {
                if (fid && !facesList.some((f) => f.face_id === fid)) {
                  facesList.push({ face_id: fid });
                }
              }
            }
            if (repFace && !facesList.some((f) => f.face_id === repFace)) {
              facesList.unshift({ face_id: repFace });
            }

            return {
              id: item.person_id || item.id || name,
              name,
              display_name: item.display_name || (item.last_name && item.first_name ? `${item.last_name} ${item.first_name}` : name),
              first_name: item.first_name,
              middle_name: item.middle_name,
              last_name: item.last_name,
              maiden_name: item.maiden_name,
              nickname: item.nickname,
              gender: item.gender,
              is_living: item.is_living,
              birth_date: item.birth_date,
              birth_place: item.birth_place,
              death_date: item.death_date,
              death_place: item.death_place,
              category: item.category,
              profession: item.profession,
              notes: item.notes,
              bio: item.bio,
              family_tree: item.family_tree,
              count,
              isHidden: Boolean(item.is_hidden),
              avatarUrl,
              avatarColor: colors[i % colors.length],
              initials,
              availableFaces: facesList,
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

  const handleSetPrimaryFace = async (person: PersonDisplay, faceId: string) => {
    const newAvatarUrl = `/api/faces/image/${faceId}`;
    setPeople((prev) =>
      prev.map((p) => (p.id === person.id ? { ...p, avatarUrl: newAvatarUrl } : p))
    );
    try {
      await fetch('/api/faces/set-primary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('auth_token') ? { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } : {}),
        },
        body: JSON.stringify({ name: person.name, person_id: String(person.id), face_id: faceId }),
      });
    } catch (e) {
      console.warn('Failed to set primary face on backend:', e);
    }
    setChoosingCoverPerson(null);
  };

  const handleResetPrimaryFace = async (person: PersonDisplay) => {
    setPeople((prev) =>
      prev.map((p) => (p.id === person.id ? { ...p, avatarUrl: null } : p))
    );
    try {
      await fetch('/api/faces/reset-primary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('auth_token') ? { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } : {}),
        },
        body: JSON.stringify({ name: person.name, person_id: String(person.id) }),
      });
    } catch (e) {
      console.warn('Failed to reset primary face on backend:', e);
    }
    setChoosingCoverPerson(null);
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

          <button
            type="button"
            onClick={() => setIsCropModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
            title="Вырезать новое лицо из фотографии вручную"
          >
            <Crop size={14} />
            <span>Вырезать лицо из фото</span>
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
            const photoLabel = person.count === 1 ? '1 фото' : `${person.count} фото`;

            return (
              <div
                key={person.id}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button, input, a, .photo-count-badge')) return;
                  setSelectedPersonForProfile(person);
                }}
                className={cn(
                  'group bg-card border rounded-2xl p-4 flex flex-col items-center text-center transition-all duration-200 relative shadow-xs hover:shadow-md hover:border-primary/50 cursor-pointer',
                  person.isHidden ? 'opacity-60 border-dashed border-border' : 'border-border/70'
                )}
                title={`Нажмите для просмотра и редактирования профиля ${person.display_name || person.name}`}
              >
                {/* Hide / Show Hover Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVisibility(person.id);
                  }}
                  className="absolute top-2.5 right-2.5 p-1 rounded-md text-muted-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  title={person.isHidden ? 'Восстановить видимость' : 'Скрыть лицо'}
                >
                  {person.isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>

                {/* Circular Avatar Crop with Primary Photo Selector */}
                <div className="relative mb-3 group/avatar">
                  <div
                    className={cn(
                      'w-20 h-20 rounded-full flex items-center justify-center text-xl font-bold shadow-sm group-hover:scale-105 transition-transform overflow-hidden relative',
                      `bg-gradient-to-tr ${person.avatarColor || 'from-blue-500 to-indigo-600'} text-white`
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
                      <span>{person.initials || '👤'}</span>
                    )}
                  </div>

                  {/* Change primary cover photo button */}
                  {person.availableFaces && person.availableFaces.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setChoosingCoverPerson(person);
                      }}
                      className="absolute -bottom-1 -right-1 p-1 rounded-full bg-card border border-border/80 shadow text-muted-foreground hover:text-primary transition-all opacity-0 group-hover:opacity-100 z-10"
                      title="Выбрать базовое фото для этого человека"
                    >
                      <Camera size={12} />
                    </button>
                  )}
                </div>

                {/* Editable Name Tag */}
                {isEditing ? (
                  <div className="flex items-center gap-1 w-full mt-1 z-10" onClick={(e) => e.stopPropagation()}>
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
                    {person.family_tree?.is_in_tree && (
                      <span title="В Семейном Древе" className="shrink-0 inline-flex items-center">
                        <TreePine size={13} className="text-emerald-500" />
                      </span>
                    )}
                    <span className="font-bold text-sm text-foreground truncate max-w-[110px]" title={person.display_name || person.name}>
                      {person.display_name || person.name}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(person.id, person.name);
                      }}
                      className="p-0.5 text-muted-foreground hover:text-primary opacity-0 group-hover/name:opacity-100 transition-opacity"
                      title="Быстро переименовать"
                    >
                      <Edit2 size={12} />
                    </button>
                  </div>
                )}

                {/* Photo Count Badge & Link - Retains filtering navigation */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/photos?person=${encodeURIComponent(person.name)}`);
                  }}
                  className="photo-count-badge flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer px-2 py-0.5 rounded-lg hover:bg-primary/10"
                  title={`Просмотреть все фото с ${person.name}`}
                >
                  <span>{photoLabel}</span>
                  <ExternalLink size={11} className="opacity-70 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Choose Primary Base Photo Modal */}
      {choosingCoverPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card border border-border/80 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Выбрать базовое фото
                </h3>
                <p className="text-xs text-muted-foreground">
                  {choosingCoverPerson.name}: выберите снимок для основного аватара
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChoosingCoverPerson(null)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[140px] max-h-[300px] grid grid-cols-4 sm:grid-cols-5 gap-3 p-1">
              {choosingCoverPerson.availableFaces && choosingCoverPerson.availableFaces.length > 0 ? (
                choosingCoverPerson.availableFaces.map((f) => {
                  const thumb = `/api/faces/image/${f.face_id}`;
                  const isCurrent = choosingCoverPerson.avatarUrl?.includes(f.face_id);

                  return (
                    <div
                      key={f.face_id}
                      onClick={() => handleSetPrimaryFace(choosingCoverPerson, f.face_id)}
                      className={cn(
                        'relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all hover:scale-105',
                        isCurrent
                          ? 'border-primary ring-2 ring-primary/40'
                          : 'border-transparent hover:border-primary/50'
                      )}
                      title="Нажмите, чтобы сделать это фото базовым"
                    >
                      <img
                        src={thumb}
                        alt="Лицо"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      {isCurrent && (
                        <div className="absolute top-1 right-1 bg-primary text-white p-0.5 rounded-full shadow-xs">
                          <Check size={11} />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
                  Нет сохранённых снимков лица для выбора
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => handleResetPrimaryFace(choosingCoverPerson)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors"
                title="Сбросить фото профиля к базовому аватару по умолчанию"
              >
                <span>👤 Сбросить по умолчанию</span>
              </button>
              <button
                type="button"
                onClick={() => setChoosingCoverPerson(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Face Crop Modal */}
      {isCropModalOpen && (
        <ManualFaceCropModal
          isOpen={isCropModalOpen}
          onClose={() => setIsCropModalOpen(false)}
          knownPersons={people}
          onSuccess={() => {
            loadFaces();
          }}
        />
      )}

      {/* Person Profile Modal */}
      {selectedPersonForProfile && (
        <PersonProfileModal
          isOpen={Boolean(selectedPersonForProfile)}
          onClose={() => setSelectedPersonForProfile(null)}
          person={selectedPersonForProfile}
          onSaveSuccess={(updated) => {
            setPeople((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setSelectedPersonForProfile(null);
          }}
        />
      )}
    </div>
  );
};

export default PeopleFacesScreen;
