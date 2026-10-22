import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  GitFork,
  Image as ImageIcon,
  BookOpen,
  Camera,
  Check,
  ExternalLink,
  Search,
  Unlink,
  TreePine,
  Loader2,
  Calendar,
  MapPin,
  Briefcase,
  Heart,
  AlertCircle,
  Download,
  Tag,
  Plus,
} from 'lucide-react';
import { cn } from '@/utils';
import { useLanguage } from '@/i18n/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { UniversalTagModal } from '../../common/UniversalTagModal';

export interface PersonDisplay {
  id: string | number;
  name: string;
  display_name?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  maiden_name?: string;
  nickname?: string;
  gender?: string;
  is_living?: boolean;
  birth_date?: string;
  birth_place?: string;
  death_date?: string;
  death_place?: string;
  category?: string;
  profession?: string;
  notes?: string;
  bio?: string;
  count: number;
  isHidden: boolean;
  avatarUrl?: string | null;
  avatarColor?: string;
  initials?: string;
  availableFaces?: Array<{ face_id: string; image_path?: string }>;
  family_tree?: {
    is_in_tree: boolean;
    tree_person_id?: string;
    kinship_to_root?: string;
    category?: string;
    birth_year?: string | number | null;
    is_living?: boolean;
    recent_milestones?: Array<{
      type?: string;
      title: string;
      date?: string;
    }>;
  };
}

export interface PersonProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: PersonDisplay | null;
  onSaveSuccess: (updatedPerson: PersonDisplay) => void;
}

export const PersonProfileModal: React.FC<PersonProfileModalProps> = ({
  isOpen,
  onClose,
  person,
  onSaveSuccess,
}) => {
  const { language } = useLanguage();
  const isRu = language === 'ru';
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'main' | 'tree' | 'photos' | 'bio'>('main');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [maidenName, setMaidenName] = useState('');
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<string>('UNKNOWN');
  const [isLiving, setIsLiving] = useState<boolean>(true);
  const [birthDate, setBirthDate] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [deathDate, setDeathDate] = useState('');
  const [deathPlace, setDeathPlace] = useState('');
  const [category, setCategory] = useState<string>('FAMILY');
  const [profession, setProfession] = useState('');
  const [notes, setNotes] = useState('');
  const [bio, setBio] = useState('');
  const [selectedPrimaryFaceId, setSelectedPrimaryFaceId] = useState<string>('');

  // Family tree binding state
  const [treePersonId, setTreePersonId] = useState<string | null>(null);
  const [syncTree, setSyncTree] = useState<boolean>(true);
  const [treeSearchQuery, setTreeSearchQuery] = useState('');
  const [allTreePersons, setAllTreePersons] = useState<any[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [treeBindingInfo, setTreeBindingInfo] = useState<any | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Person tags state (FEAT-032)
  const [personTags, setPersonTags] = useState<string[]>([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);

  // Initialize form from person object
  useEffect(() => {
    if (!person || !isOpen) return;

    setActiveTab('main');
    setFirstName(person.first_name || person.name || '');
    setMiddleName(person.middle_name || '');
    setLastName(person.last_name || '');
    setMaidenName(person.maiden_name || '');
    setNickname(person.nickname || '');
    setGender(person.gender || 'UNKNOWN');
    setIsLiving(person.is_living !== undefined ? Boolean(person.is_living) : true);
    setBirthDate(person.birth_date || '');
    setBirthPlace(person.birth_place || '');
    setDeathDate(person.death_date || '');
    setDeathPlace(person.death_place || '');
    setCategory(person.category || 'FAMILY');
    setProfession(person.profession || '');
    setNotes(person.notes || '');
    setBio(person.bio || '');

    // Representative face
    const repFace = person.avatarUrl?.split('/').pop() || (person.availableFaces && person.availableFaces[0]?.face_id) || '';
    setSelectedPrimaryFaceId(repFace);

    // Family tree binding
    const tId = person.family_tree?.tree_person_id || null;
    setTreePersonId(tId);
    setTreeBindingInfo(person.family_tree || null);
    setSyncTree(true);
    setSaveError(null);

    // Fetch person tags (FEAT-032)
    fetch(`/api/persons/${encodeURIComponent(String(person.id || person.name))}/tags`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setPersonTags(data.map((item: any) => (typeof item === 'string' ? item : item.tag)).filter(Boolean));
        }
      })
      .catch((err) => console.warn('Failed to load person tags:', err));

    // Fetch tree persons list for linking
    setIsLoadingTree(true);
    fetch('/api/family-tree/persons')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setAllTreePersons(data);
          if (tId) {
            const matched = data.find((tp: any) => tp.id === tId);
            if (matched) {
              setTreeBindingInfo((prev: any) => ({
                ...prev,
                name: matched.full_name || `${matched.first_name} ${matched.last_name || ''}`.trim(),
                birth_date: matched.birth_date,
                death_date: matched.death_date,
              }));
            }
          }
        }
      })
      .catch((err) => console.warn('Failed to load tree persons for linking:', err))
      .finally(() => setIsLoadingTree(false));
  }, [person, isOpen]);

  const handleRemoveTag = async (tagToRemove: string) => {
    const nextTags = personTags.filter((t) => t !== tagToRemove);
    setPersonTags(nextTags);
    try {
      await fetch(`/api/persons/${encodeURIComponent(String(person?.id || person?.name))}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: nextTags }),
      });
    } catch (e) {
      console.warn('Failed to update person tags:', e);
    }
  };

  const handleAddTag = async (newTag: string) => {
    const clean = newTag.replace(/^#/, '').trim();
    if (!clean || personTags.includes(clean)) return;
    const nextTags = [...personTags, clean];
    setPersonTags(nextTags);
    setIsTagModalOpen(false);
    try {
      await fetch(`/api/persons/${encodeURIComponent(String(person?.id || person?.name))}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: nextTags }),
      });
    } catch (e) {
      console.warn('Failed to update person tags:', e);
    }
  };

  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // Apply / Populate data from Family Tree person into the profile form
  const handleApplyTreeData = (candidatePerson?: any) => {
    const target = candidatePerson || allTreePersons.find((tp: any) => tp.id === treePersonId);
    if (!target) return;

    if (target.first_name) setFirstName(target.first_name);
    if (target.last_name !== undefined) setLastName(target.last_name || '');
    if (target.middle_name !== undefined) setMiddleName(target.middle_name || '');
    if (target.maiden_name !== undefined) setMaidenName(target.maiden_name || '');
    if (target.gender) setGender(target.gender);
    if (target.is_living !== undefined) setIsLiving(Boolean(target.is_living));
    if (target.birth_date !== undefined) setBirthDate(target.birth_date || '');
    if (target.birth_place !== undefined) setBirthPlace(target.birth_place || '');
    if (target.death_date !== undefined) setDeathDate(target.death_date || '');
    if (target.death_place !== undefined) setDeathPlace(target.death_place || '');
    if (target.bio !== undefined && target.bio) setBio(target.bio);
    if (target.avatar_face_id) setSelectedPrimaryFaceId(target.avatar_face_id);

    if (target.custom_attributes) {
      try {
        const custom = typeof target.custom_attributes === 'string'
          ? JSON.parse(target.custom_attributes)
          : target.custom_attributes;
        if (custom.profession) setProfession(custom.profession);
        if (custom.notes) setNotes(custom.notes);
        if (custom.nickname) setNickname(custom.nickname);
      } catch {
        // ignore
      }
    }

    const nameStr = `${target.first_name || ''} ${target.last_name || ''}`.trim() || target.name || '';
    setImportSuccessMessage(
      isRu
        ? `Данные персоны "${nameStr}" успешно перенесены из Семейного Древа`
        : `Profile data for "${nameStr}" populated from Family Tree`
    );
    setTimeout(() => setImportSuccessMessage(null), 4500);
  };

  if (!isOpen || !person) return null;

  // Formatted full display name
  const composedDisplayName = lastName && firstName
    ? `${lastName.trim()} ${firstName.trim()}`
    : (firstName.trim() || person.name);

  const photoLabel = person.count === 1
    ? (isRu ? '1 фото' : '1 photo')
    : `${person.count} ${isRu ? 'фото' : 'photos'}`;

  // Handle Save
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveError(null);

    const payload = {
      person_id: String(person.id),
      name: person.name,
      first_name: firstName.trim(),
      middle_name: middleName.trim() || undefined,
      last_name: lastName.trim() || undefined,
      maiden_name: maidenName.trim() || undefined,
      nickname: nickname.trim() || undefined,
      gender,
      is_living: isLiving,
      birth_date: birthDate.trim() || undefined,
      birth_place: birthPlace.trim() || undefined,
      death_date: !isLiving ? (deathDate.trim() || undefined) : undefined,
      death_place: !isLiving ? (deathPlace.trim() || undefined) : undefined,
      category,
      profession: profession.trim() || undefined,
      notes: notes.trim() || undefined,
      bio: bio.trim() || undefined,
      primary_face_id: selectedPrimaryFaceId || undefined,
      tree_person_id: treePersonId,
      previous_tree_person_id: person.family_tree?.tree_person_id,
      sync_tree: syncTree,
    };

    try {
      const res = await fetch('/api/faces/person-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('auth_token') ? { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `HTTP ${res.status}`);
      }

      const resData = await res.json();
      const updatedBackend = resData.person || {};

      const updatedDisplay: PersonDisplay = {
        ...person,
        name: updatedBackend.name || composedDisplayName,
        display_name: updatedBackend.display_name || composedDisplayName,
        first_name: firstName.trim(),
        middle_name: middleName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        maiden_name: maidenName.trim() || undefined,
        nickname: nickname.trim() || undefined,
        gender,
        is_living: isLiving,
        birth_date: birthDate.trim() || undefined,
        birth_place: birthPlace.trim() || undefined,
        death_date: !isLiving ? (deathDate.trim() || undefined) : undefined,
        death_place: !isLiving ? (deathPlace.trim() || undefined) : undefined,
        category,
        profession: profession.trim() || undefined,
        notes: notes.trim() || undefined,
        bio: bio.trim() || undefined,
        avatarUrl: selectedPrimaryFaceId ? `/api/faces/image/${selectedPrimaryFaceId}` : person.avatarUrl,
        family_tree: treePersonId ? {
          is_in_tree: true,
          tree_person_id: treePersonId,
          kinship_to_root: treeBindingInfo?.kinship_to_root || person.family_tree?.kinship_to_root,
        } : { is_in_tree: false },
      };

      onSaveSuccess(updatedDisplay);
      onClose();
    } catch (err: any) {
      console.error('Failed to save person profile:', err);
      setSaveError(err.message || 'Ошибка сохранения данных');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredTreeCandidates = allTreePersons.filter((tp: any) => {
    if (!treeSearchQuery) return true;
    const q = treeSearchQuery.toLowerCase();
    const nameStr = `${tp.first_name || ''} ${tp.last_name || ''} ${tp.middle_name || ''}`.toLowerCase();
    return nameStr.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-card border border-border/80 rounded-3xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-4">
            {/* Avatar with Camera badge */}
            <div className="relative group">
              <div
                className={cn(
                  'w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shadow-md overflow-hidden relative border-2 border-border/70',
                  `bg-gradient-to-tr ${person.avatarColor || 'from-blue-500 to-indigo-600'} text-white`
                )}
              >
                {selectedPrimaryFaceId ? (
                  <img
                    src={`/api/faces/image/${selectedPrimaryFaceId}`}
                    alt={person.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : person.avatarUrl ? (
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
              <button
                type="button"
                onClick={() => setActiveTab('photos')}
                className="absolute -bottom-1 -right-1 p-1 rounded-full bg-card border border-border/80 shadow text-muted-foreground hover:text-primary transition-all cursor-pointer"
                title={isRu ? 'Выбрать главное фото' : 'Choose primary avatar'}
              >
                <Camera size={13} />
              </button>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">
                  {composedDisplayName}
                </h2>
                {treePersonId && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    <TreePine size={11} />
                    {isRu ? 'В Семейном Древе' : 'In Family Tree'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  {photoLabel}
                </span>
                {category && (
                  <span>
                    {isRu ? 'Категория: ' : 'Category: '}
                    <strong className="text-foreground">{category}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border/60 bg-card px-6 pt-1 gap-2 text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('main')}
            className={cn(
              'flex items-center gap-1.5 py-3 px-3 border-b-2 transition-all cursor-pointer',
              activeTab === 'main'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <User size={15} />
            <span>{isRu ? 'Основное' : 'General'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tree')}
            className={cn(
              'flex items-center gap-1.5 py-3 px-3 border-b-2 transition-all cursor-pointer',
              activeTab === 'tree'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <GitFork size={15} />
            <span>{isRu ? 'Семейное древо' : 'Family Tree'}</span>
            {treePersonId && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('photos')}
            className={cn(
              'flex items-center gap-1.5 py-3 px-3 border-b-2 transition-all cursor-pointer',
              activeTab === 'photos'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <ImageIcon size={15} />
            <span>
              {isRu ? 'Выбор фото' : 'Photos'} ({person.availableFaces?.length || 0})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bio')}
            className={cn(
              'flex items-center gap-1.5 py-3 px-3 border-b-2 transition-all cursor-pointer',
              activeTab === 'bio'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <BookOpen size={15} />
            <span>{isRu ? 'Биография и заметки' : 'Bio & Notes'}</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {saveError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              <AlertCircle size={15} />
              <span>{saveError}</span>
            </div>
          )}

          {/* TAB 1: ОСНОВНОЕ (General & Demographics) */}
          {activeTab === 'main' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Import Notification Banner */}
              {importSuccessMessage && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 font-medium animate-in fade-in duration-150">
                  <Check size={14} className="text-emerald-500 shrink-0" />
                  <span>{importSuccessMessage}</span>
                </div>
              )}

              {/* Family Tree Quick Sync Banner */}
              {treePersonId && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                  <div className="flex items-center gap-2 text-xs text-foreground">
                    <TreePine size={15} className="text-emerald-500 shrink-0" />
                    <span>
                      {isRu ? 'Связано с Древом: ' : 'Linked to Tree: '}
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        {treeBindingInfo?.name || composedDisplayName}
                      </strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyTreeData()}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
                    title={isRu ? 'Заполнить все поля анкеты из связанной персоны Древа' : 'Populate form fields from linked Tree member'}
                  >
                    <Download size={13} />
                    <span>{isRu ? 'Использовать данные из Древа' : 'Populate from Tree'}</span>
                  </button>
                </div>
              )}

              {/* Names Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    {isRu ? 'Фамилия' : 'Last Name'}
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder={isRu ? 'Иванов' : 'Doe'}
                    className="w-full h-9 px-3 bg-muted/30 border border-border/70 rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    {isRu ? 'Имя *' : 'First Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={isRu ? 'Иван' : 'John'}
                    className="w-full h-9 px-3 bg-muted/30 border border-border/70 rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    {isRu ? 'Отчество / Второе имя' : 'Middle Name / Patronymic'}
                  </label>
                  <input
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder={isRu ? 'Иванович' : 'William'}
                    className="w-full h-9 px-3 bg-muted/30 border border-border/70 rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              {/* Maiden Name, Nickname & Gender */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    {isRu ? 'Девичья / иная фамилия' : 'Maiden / Birth Name'}
                  </label>
                  <input
                    type="text"
                    value={maidenName}
                    onChange={(e) => setMaidenName(e.target.value)}
                    placeholder={isRu ? 'Урождённая...' : 'Maiden name...'}
                    className="w-full h-9 px-3 bg-muted/30 border border-border/70 rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    {isRu ? 'Псевдоним / Прозвище' : 'Nickname / Alias'}
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder={isRu ? 'Домашнее имя...' : 'Nickname...'}
                    className="w-full h-9 px-3 bg-muted/30 border border-border/70 rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    {isRu ? 'Пол' : 'Gender'}
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full h-9 px-3 bg-muted/30 border border-border/70 rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  >
                    <option value="MALE">{isRu ? 'Мужской' : 'Male'}</option>
                    <option value="FEMALE">{isRu ? 'Женский' : 'Female'}</option>
                    <option value="OTHER">{isRu ? 'Другой' : 'Other'}</option>
                    <option value="UNKNOWN">{isRu ? 'Не указан' : 'Unknown'}</option>
                  </select>
                </div>
              </div>

              {/* Life Status (Жив / Умер) Checkbox */}
              <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-foreground flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isLiving}
                      onChange={(e) => setIsLiving(e.target.checked)}
                      className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    />
                    <span>{isRu ? 'Жив (снять для ушедших)' : 'Living (uncheck for deceased)'}</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground mt-0.5 ml-6">
                    {isLiving
                      ? (isRu ? 'Поля даты смерти и захоронения скрыты' : 'Death fields are hidden')
                      : (isRu ? 'Укажите дату и место ухода из жизни' : 'Specify date and place of death')}
                  </p>
                </div>
                <Heart size={16} className={cn(isLiving ? 'text-rose-500' : 'text-muted-foreground')} />
              </div>

              {/* Birth Dates and Place */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Calendar size={13} />
                    <span>{isRu ? 'Дата рождения' : 'Birth Date'}</span>
                  </label>
                  <input
                    type="text"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    placeholder="ДД.ММ.ГГГГ или ГГГГ"
                    className="w-full h-9 px-3 bg-muted/30 border border-border/70 rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                    <MapPin size={13} />
                    <span>{isRu ? 'Место рождения' : 'Birth Place'}</span>
                  </label>
                  <input
                    type="text"
                    value={birthPlace}
                    onChange={(e) => setBirthPlace(e.target.value)}
                    placeholder={isRu ? 'Город, страна' : 'City, country'}
                    className="w-full h-9 px-3 bg-muted/30 border border-border/70 rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              {/* Conditional Death Date & Place: STRICTLY REVEALED ONLY IF !isLiving */}
              {!isLiving && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-destructive/5 border border-destructive/20 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                      <Calendar size={13} />
                      <span>{isRu ? 'Дата смерти' : 'Death Date'}</span>
                    </label>
                    <input
                      type="text"
                      value={deathDate}
                      onChange={(e) => setDeathDate(e.target.value)}
                      placeholder="ДД.ММ.ГГГГ или ГГГГ"
                      className="w-full h-9 px-3 bg-card border border-border/70 rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                      <MapPin size={13} />
                      <span>{isRu ? 'Место захоронения / смерти' : 'Death / Burial Place'}</span>
                    </label>
                    <input
                      type="text"
                      value={deathPlace}
                      onChange={(e) => setDeathPlace(e.target.value)}
                      placeholder={isRu ? 'Кладбище, город' : 'Cemetery, city'}
                      className="w-full h-9 px-3 bg-card border border-border/70 rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              )}

              {/* Category & Profession */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    {isRu ? 'Категория' : 'Category'}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-9 px-3 bg-muted/30 border border-border/70 rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  >
                    <option value="FAMILY">{isRu ? 'Семья / Родственники' : 'Family'}</option>
                    <option value="FRIENDS">{isRu ? 'Друзья' : 'Friends'}</option>
                    <option value="COLLEAGUES">{isRu ? 'Коллеги' : 'Colleagues'}</option>
                    <option value="ACQUAINTANCES">{isRu ? 'Знакомые' : 'Acquaintances'}</option>
                    <option value="PUBLIC_FIGURES">{isRu ? 'Публичные личности / Известные' : 'Public Figures'}</option>
                    <option value="OTHER">{isRu ? 'Другое' : 'Other'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Briefcase size={13} />
                    <span>{isRu ? 'Род занятий / Профессия' : 'Profession / Occupation'}</span>
                  </label>
                  <input
                    type="text"
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    placeholder={isRu ? 'Инженер, врач, музыкант...' : 'Engineer, doctor...'}
                    className="w-full h-9 px-3 bg-muted/30 border border-border/70 rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              {/* Notes / Arbitrary Information Field */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  {isRu ? 'Заметки и пояснения (произвольная информация)' : 'Notes & Context (arbitrary notes)'}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isRu ? 'Например: Двоюродный брат по линии матери; на фото носит очки' : 'e.g. Cousin on mother side, wears glasses...'}
                  className="w-full h-9 px-3 bg-muted/30 border border-border/70 rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Person Tags Cloud (FEAT-032) */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Tag size={13} className="text-primary" />
                    <span>{isRu ? 'Теги персоны' : 'Person Tags'}</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    {isRu
                      ? 'Автоматически наследуются фото с этой персоной'
                      : 'Automatically inherited by photos with this person'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-2xl bg-muted/20 border border-border/60 min-h-[46px]">
                  {personTags.length > 0 ? (
                    personTags.map((tag) => (
                      <span
                        key={tag}
                        className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:border-primary/40 transition-colors"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="p-0.5 rounded-full hover:bg-primary/20 text-primary/70 hover:text-primary transition-colors cursor-pointer"
                          title={isRu ? `Удалить тег #${tag}` : `Remove tag #${tag}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      {isRu ? 'Теги ещё не добавлены' : 'No tags added yet'}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsTagModalOpen(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-dashed border-border/80 transition-colors cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>{isRu ? 'Добавить тег' : 'Add Tag'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: СЕМЕЙНОЕ ДРЕВО (Family Tree Binding) */}
          {activeTab === 'tree' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {treePersonId ? (
                /* Currently Linked to Tree */
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm">
                      <TreePine size={18} />
                      <span>{isRu ? 'Привязан к Семейному Древу' : 'Linked to Family Tree'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTreePersonId(null);
                        setTreeBindingInfo(null);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 border border-destructive/20 transition-colors cursor-pointer"
                    >
                      <Unlink size={13} />
                      <span>{isRu ? 'Отвязать' : 'Unlink'}</span>
                    </button>
                  </div>

                  <div className="text-xs space-y-1 text-foreground/90 pl-6">
                    <p>
                      <strong>{isRu ? 'Персона в древе: ' : 'Tree Person: '}</strong>
                      {treeBindingInfo?.name || composedDisplayName}
                    </p>
                    {treeBindingInfo?.kinship_to_root && (
                      <p>
                        <strong>{isRu ? 'Степень родства: ' : 'Kinship: '}</strong>
                        <span className="text-emerald-500 font-medium">
                          {treeBindingInfo.kinship_to_root}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate(`/family-tree?person=${encodeURIComponent(treePersonId)}`);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border/60 shadow-xs transition-colors cursor-pointer"
                      >
                        <ExternalLink size={13} />
                        <span>{isRu ? 'Перейти к узлу в Древе' : 'Jump to node in Tree'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyTreeData()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        title={isRu ? 'Импортировать ФИО, даты и биографию из Древа в анкету' : 'Import name, dates, and bio from Tree into profile'}
                      >
                        <Download size={13} />
                        <span>{isRu ? 'Заполнить анкету из Древа' : 'Populate profile from Tree'}</span>
                      </button>
                    </div>

                    <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={syncTree}
                        onChange={(e) => setSyncTree(e.target.checked)}
                        className="rounded text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
                      />
                      <span>{isRu ? 'Синхронизировать при сохранении' : 'Two-way sync on save'}</span>
                    </label>
                  </div>
                </div>
              ) : (
                /* Unlinked: Search among existing tree persons */
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60">
                    <h4 className="text-xs font-bold text-foreground mb-1">
                      {isRu ? 'Связать с персоной из Семейного Древа' : 'Link with a Family Tree Member'}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      {isRu
                        ? 'Выберите существующего родственника из Семейного Древа. Новые родственники добавляются непосредственно на холсте Семейного Древа.'
                        : 'Select an existing member from your Family Tree. New tree members are added directly on the Tree canvas.'}
                    </p>
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="search"
                      value={treeSearchQuery}
                      onChange={(e) => setTreeSearchQuery(e.target.value)}
                      placeholder={isRu ? 'Поиск родственника в Древе...' : 'Search tree relative...'}
                      className="w-full h-9 pl-9 pr-3 bg-muted/30 border border-border/70 rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  {/* Candidates list */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-border/60 rounded-2xl p-2 bg-muted/10">
                    {isLoadingTree ? (
                      <div className="flex items-center justify-center p-4 text-xs text-muted-foreground gap-2">
                        <Loader2 size={13} className="animate-spin text-primary" />
                        <span>{isRu ? 'Загрузка Древа...' : 'Loading Tree...'}</span>
                      </div>
                    ) : filteredTreeCandidates.length === 0 ? (
                      <p className="text-center py-4 text-xs text-muted-foreground italic">
                        {isRu ? 'Родственники не найдены' : 'No matching tree members'}
                      </p>
                    ) : (
                      filteredTreeCandidates.map((tp: any) => {
                        const fullName = tp.full_name || `${tp.first_name || ''} ${tp.last_name || ''}`.trim();
                        const isCurrent = treePersonId === tp.id;

                        return (
                          <div
                            key={tp.id}
                            onClick={() => {
                              setTreePersonId(tp.id);
                              setTreeBindingInfo({
                                name: fullName,
                                kinship_to_root: tp.kinship_to_root,
                              });
                              handleApplyTreeData(tp);
                            }}
                            className={cn(
                              'flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors',
                              isCurrent
                                ? 'bg-primary text-white font-semibold'
                                : 'hover:bg-muted text-foreground'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <TreePine size={14} className={isCurrent ? 'text-white' : 'text-emerald-500'} />
                              <span>{fullName}</span>
                              {tp.birth_date && (
                                <span className={cn('text-[10px]', isCurrent ? 'text-white/80' : 'text-muted-foreground')}>
                                  ({tp.birth_date})
                                </span>
                              )}
                            </div>
                            {isCurrent && <Check size={14} />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ВЫБОР ФОТО (Photos & Avatar Selection) */}
          {activeTab === 'photos' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <p className="text-xs text-muted-foreground">
                {isRu
                  ? 'Нажмите на фото, чтобы выбрать его в качестве основного эталонного аватара персоны:'
                  : 'Click on a photo to make it the primary avatar for this person:'}
              </p>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-64 overflow-y-auto p-1">
                {person.availableFaces && person.availableFaces.length > 0 ? (
                  person.availableFaces.map((f) => {
                    const isSelected = selectedPrimaryFaceId === f.face_id;

                    return (
                      <div
                        key={f.face_id}
                        onClick={() => setSelectedPrimaryFaceId(f.face_id)}
                        className={cn(
                          'relative aspect-square rounded-2xl overflow-hidden cursor-pointer border-2 transition-all hover:scale-105 shadow-xs',
                          isSelected
                            ? 'border-primary ring-2 ring-primary/40'
                            : 'border-border/60 hover:border-primary/50'
                        )}
                      >
                        <img
                          src={`/api/faces/image/${f.face_id}`}
                          alt="Face crop"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 bg-primary text-white p-1 rounded-full shadow-xs">
                            <Check size={12} />
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
                    {isRu ? 'Нет сохранённых снимков лица для выбора' : 'No face crops available'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: БИОГРАФИЯ И ЗАМЕТКИ (Bio) */}
          {activeTab === 'bio' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  {isRu ? 'Развёрнутая биография и воспоминания' : 'Detailed Biography & Memories'}
                </label>
                <textarea
                  rows={6}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={isRu ? 'Напишите историю жизни, памятные события или семейные воспоминания...' : 'Write life story, memorable events...'}
                  className="w-full p-3 bg-muted/30 border border-border/70 rounded-2xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  {isRu ? 'Краткие заметки и логические пояснения' : 'Quick Notes & Logical Context'}
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isRu ? 'Дополнительные пояснения к фото, родственникам или местам...' : 'Additional notes...'}
                  className="w-full p-3 bg-muted/30 border border-border/70 rounded-2xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-y"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/60 bg-muted/20">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate(`/photos?person=${encodeURIComponent(person.name)}`);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border/80 text-xs font-semibold hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ExternalLink size={13} />
            <span>{isRu ? `Перейти к фото (${person.count})` : `View all photos (${person.count})`}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {isRu ? 'Отмена' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>{isRu ? 'Сохранение...' : 'Saving...'}</span>
                </>
              ) : (
                <span>{isRu ? 'Сохранить изменения' : 'Save Changes'}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Universal Tag Modal for Person Profile (FEAT-032) */}
      {isTagModalOpen && (
        <UniversalTagModal
          isOpen={isTagModalOpen}
          mode="person_add"
          targetName={composedDisplayName}
          existingTags={personTags}
          onClose={() => setIsTagModalOpen(false)}
          onSubmit={async (val: string) => {
            await handleAddTag(val);
          }}
        />
      )}
    </div>
  );
};

export default PersonProfileModal;
