import { useState, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useFamilyTreeStore } from '../../state/useFamilyTreeStore.js';
import { useKinship } from '../../hooks/useKinship.js';
import type { TreeGraphPerson, TreeGraphData, Gender, UnionType, TreeGraphUnion } from '../../types/tree.types.js';
import { PersonTimelineView } from '../timeline/PersonTimelineView.js';
import { CustomDatePicker } from '../common/CustomDatePicker.js';
import { formatTreeDate } from '../../utils/dateUtils.js';

interface PersonDetailDrawerProps {
  person: TreeGraphPerson | null;
  graphData: TreeGraphData | null;
  onUpdatePerson: (id: string, data: Record<string, any>) => Promise<any>;
  onDeletePerson: (id: string) => Promise<void>;
  onSetRootPerson: (treeId: string, personId: string) => Promise<void>;
  onOpenQuickAdd: (targetPersonId: string, relation?: 'PARENT' | 'CHILD' | 'SPOUSE' | 'SIBLING') => void;
  onOpenFaceLink: (targetPersonId: string) => void;
}

export const PersonDetailDrawer = ({
  person,
  graphData,
  onUpdatePerson,
  onDeletePerson,
  onSetRootPerson,
  onOpenQuickAdd,
  onOpenFaceLink,
}: PersonDetailDrawerProps) => {
  const {
    isDetailDrawerOpen,
    drawerActiveTab,
    closeDrawer,
    selectPerson,
    openDrawer,
    activeTreeId,
    dateFormatStyle,
  } = useFamilyTreeStore();

  const { fitView } = useReactFlow();

  // Bio Form State
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [maidenName, setMaidenName] = useState('');
  const [gender, setGender] = useState<Gender>('UNKNOWN');
  const [birthDate, setBirthDate] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [isLiving, setIsLiving] = useState(true);
  const [deathDate, setDeathDate] = useState('');
  const [deathPlace, setDeathPlace] = useState('');
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);

  // Spouse Union Editing State
  const [editingUnion, setEditingUnion] = useState<TreeGraphUnion | null>(null);
  const [editingSpouseName, setEditingSpouseName] = useState('');
  const [unionType, setUnionType] = useState<UnionType>('MARRIAGE');
  const [unionStartDate, setUnionStartDate] = useState('');
  const [unionEndDate, setUnionEndDate] = useState('');
  const [unionStartPlace, setUnionStartPlace] = useState('');
  const [unionNotes, setUnionNotes] = useState('');
  const [isSavingUnion, setIsSavingUnion] = useState(false);

  const rootPersonId = graphData?.root_person_id;
  const isRoot = person?.id === rootPersonId;
  const { kinship } = useKinship(rootPersonId, person?.id);
  const { getPersonContext } = useKinship();
  const [personContext, setPersonContext] = useState<any>(null);

  useEffect(() => {
    if (person) {
      setFirstName(person.first_name || '');
      setMiddleName(person.middle_name || '');
      setLastName(person.last_name || '');
      setMaidenName(person.maiden_name || '');
      setGender(person.gender || 'UNKNOWN');
      setBirthDate(person.birth_date || '');
      setBirthPlace(person.birth_place || '');
      setIsLiving(person.is_living === 1);
      setDeathDate(person.death_date || '');
      setDeathPlace(person.death_place || '');
      setBio(person.bio || '');
      setIsEditingBio(false);

      // Load full person context (relatives)
      getPersonContext({ personId: person.id }).then((ctx) => {
        setPersonContext(ctx);
      });
    }
  }, [person]);

  if (!isDetailDrawerOpen || !person) return null;

  const fullName = person.full_name || `${person.first_name} ${person.last_name || ''}`.trim();
  const avatarUrl = person.avatar_url || (person.avatar_face_id && !person.avatar_face_id.startsWith('manual_') && !person.avatar_face_id.startsWith('face_manual_') ? `/api/faces/image/${person.avatar_face_id}` : null);

  const handleSaveBio = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdatePerson(person.id, {
        first_name: firstName.trim(),
        middle_name: middleName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        maiden_name: maidenName.trim() || undefined,
        gender,
        birth_date: birthDate.trim() || undefined,
        birth_place: birthPlace.trim() || undefined,
        is_living: isLiving,
        death_date: !isLiving ? deathDate.trim() || undefined : undefined,
        death_place: !isLiving ? deathPlace.trim() || undefined : undefined,
        bio: bio.trim() || undefined,
      });
      setIsEditingBio(false);
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  const handleFlyToNode = () => {
    fitView({
      nodes: [{ id: `p_${person.id}` }],
      duration: 600,
      maxZoom: 1.2,
    });
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${fullName} from the family tree?`)) {
      try {
        await onDeletePerson(person.id);
        closeDrawer();
      } catch (err: any) {
        window.alert(err?.message || 'Failed to delete person.');
      }
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--input-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 4,
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 460,
        zIndex: 50,
        background: 'var(--modal-bg)',
        borderLeft: '1px solid var(--border-color)',
        backdropFilter: 'blur(20px)',
        boxShadow: 'var(--shadow-modal)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {/* Drawer Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          background: 'var(--card-bg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Avatar with Face Link Button */}
          <div style={{ position: 'relative' }}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #6366f1',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 20,
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
                }}
              >
                {person.first_name[0]}
              </div>
            )}
            <button
              type="button"
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                background: '#6366f1',
                color: '#ffffff',
                border: '1.5px solid var(--card-bg-solid)',
                borderRadius: '50%',
                width: 20,
                height: 20,
                fontSize: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Link / Update Face Photo"
              onClick={() => onOpenFaceLink(person.id)}
            >
              📷
            </button>
          </div>

          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{fullName}</span>
              {isRoot && (
                <span
                  style={{
                    background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                    color: '#ffffff',
                    fontSize: 9,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 8,
                  }}
                >
                  ROOT ME
                </span>
              )}
            </div>

            {person.maiden_name && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                née {person.maiden_name}
              </div>
            )}

            {kinship && kinship.primaryTerm !== 'Self' && (
              <div style={{ marginTop: 4 }}>
                <span
                  style={{
                    background: 'var(--nav-tab-active-bg)',
                    border: '1px solid var(--primary-color, #6366f1)',
                    color: 'var(--primary-color, #6366f1)',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                  }}
                >
                  {kinship.primaryTerm}
                </span>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 18,
            cursor: 'pointer',
            padding: 4,
          }}
          onClick={closeDrawer}
        >
          ✕
        </button>
      </div>

      {/* Action Shortcut Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 20px',
          background: 'var(--nav-tab-bg)',
          borderBottom: '1px solid var(--border-color)',
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          style={{
            background: 'var(--card-bg-solid)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          onClick={handleFlyToNode}
        >
          🎯 Focus in Canvas
        </button>

        <button
          type="button"
          style={{
            background: 'var(--nav-tab-active-bg)',
            border: '1px solid var(--primary-color, #6366f1)',
            color: 'var(--primary-color, #6366f1)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          onClick={() => onOpenQuickAdd(person.id)}
        >
          ➕ Add Relative
        </button>

        {!isRoot && (
          <button
            type="button"
            style={{
              background: 'rgba(168, 85, 247, 0.2)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              color: 'var(--accent-color, #a855f7)',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            onClick={() => onSetRootPerson(activeTreeId, person.id)}
          >
            ⭐ Set as Root &quot;ME&quot;
          </button>
        )}

        <button
          type="button"
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--error-color, #ef4444)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          onClick={handleDelete}
        >
          🗑️ Delete
        </button>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--card-bg)',
        }}
      >
        <button
          type="button"
          style={{
            flex: 1,
            padding: '10px 0',
            border: 'none',
            background: 'transparent',
            color: drawerActiveTab === 'bio' ? 'var(--primary-color, #6366f1)' : 'var(--text-secondary)',
            borderBottom: drawerActiveTab === 'bio' ? '2px solid var(--primary-color, #6366f1)' : '2px solid transparent',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
          onClick={() => openDrawer('bio', person.id)}
        >
          👤 Bio & Details
        </button>

        <button
          type="button"
          style={{
            flex: 1,
            padding: '10px 0',
            border: 'none',
            background: 'transparent',
            color: drawerActiveTab === 'family' ? 'var(--primary-color, #6366f1)' : 'var(--text-secondary)',
            borderBottom: drawerActiveTab === 'family' ? '2px solid var(--primary-color, #6366f1)' : '2px solid transparent',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
          onClick={() => openDrawer('family', person.id)}
        >
          👨‍👩‍👧‍👦 Family
        </button>

        <button
          type="button"
          style={{
            flex: 1,
            padding: '10px 0',
            border: 'none',
            background: 'transparent',
            color: drawerActiveTab === 'timeline' ? 'var(--primary-color, #6366f1)' : 'var(--text-secondary)',
            borderBottom: drawerActiveTab === 'timeline' ? '2px solid var(--primary-color, #6366f1)' : '2px solid transparent',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
          onClick={() => openDrawer('timeline', person.id)}
        >
          📖 Life Story & Facts
        </button>
      </div>

      {/* Tab Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {/* Tab 1: Bio & Details */}
        {drawerActiveTab === 'bio' && (
          <div>
            {!isEditingBio ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    style={{
                      background: 'rgba(99, 102, 241, 0.2)',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                      color: '#c7d2fe',
                      padding: '4px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    onClick={() => setIsEditingBio(true)}
                  >
                    ✏️ Edit Information
                  </button>
                </div>

                <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 14, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Birth Information</div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
                    {person.birth_date ? formatTreeDate(person.birth_date, dateFormatStyle) : 'Date unknown'} {person.birth_place ? `• ${person.birth_place}` : ''}
                  </div>
                </div>

                {!person.is_living && (
                  <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 14, border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Passing Information</div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
                      {person.death_date ? formatTreeDate(person.death_date, dateFormatStyle) : 'Date unknown'} {person.death_place ? `• ${person.death_place}` : ''}
                    </div>
                  </div>
                )}

                <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 14, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Gender</div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
                    {person.gender}
                  </div>
                </div>

                <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 14, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Life Biography & Notes</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {person.bio || 'No biography written yet. Click Edit Information above to add memories, background, and stories.'}
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveBio} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>First Name</label>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Last Name</label>
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Middle Name</label>
                    <input type="text" value={middleName} onChange={(e) => setMiddleName(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Maiden Name</label>
                    <input type="text" value={maidenName} onChange={(e) => setMaidenName(e.target.value)} style={inputStyle} />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Gender</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value as any)} style={inputStyle}>
                    <option value="UNKNOWN">Unknown</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="NON_BINARY">Non-Binary</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Birth Date</label>
                    <CustomDatePicker value={birthDate} onChange={setBirthDate} placeholder="e.g. 1985-04-12, 12.04.1985..." />
                  </div>
                  <div>
                    <label style={labelStyle}>Birth Place</label>
                    <input type="text" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} style={inputStyle} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={isLiving} onChange={(e) => setIsLiving(e.target.checked)} />
                    <span>Currently living</span>
                  </label>
                </div>

                {!isLiving && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Death Date</label>
                      <CustomDatePicker value={deathDate} onChange={setDeathDate} placeholder="e.g. 2020-05-10, 10.05.2020..." />
                    </div>
                    <div>
                      <label style={labelStyle}>Death Place</label>
                      <input type="text" value={deathPlace} onChange={(e) => setDeathPlace(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Biography</label>
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    style={{ background: 'var(--nav-tab-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}
                    onClick={() => setIsEditingBio(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#ffffff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tab 2: Family & Relatives */}
        {drawerActiveTab === 'family' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Parents */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Parents ({personContext?.immediateFamily?.parents?.length || 0})
                </div>
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary-color, #6366f1)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => onOpenQuickAdd(person.id, 'PARENT')}
                >
                  + Add Parent
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {personContext?.immediateFamily?.parents?.map((p: any) => (
                  <div
                    key={p.id}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}
                    onClick={() => selectPerson(p.id, true)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>👤</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--primary-color, #6366f1)', fontWeight: 600 }}>{p.relation}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Spouses & Partners */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Spouses & Partners ({personContext?.immediateFamily?.spouses?.length || 0})
                </div>
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary-color, #6366f1)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => onOpenQuickAdd(person.id, 'SPOUSE')}
                >
                  + Add Spouse
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {personContext?.immediateFamily?.spouses?.map((s: any) => {
                  const u = graphData?.unions?.find(
                    (unionItem) => unionItem.partner_ids.includes(person.id) && unionItem.partner_ids.includes(s.id)
                  );
                  const isDivorced = u?.union_type === 'DIVORCED';
                  const uIcon = isDivorced ? '💔' : u?.union_type === 'MARRIAGE' ? '💍' : '💞';
                  const statusLabel = isDivorced
                    ? 'Divorced'
                    : u?.union_type === 'MARRIAGE'
                      ? 'Married'
                      : u?.union_type === 'SEPARATED'
                        ? 'Separated'
                        : (u?.union_type || s.relation);

                  const dateDetails = [
                    u?.start_date ? `Since ${formatTreeDate(u.start_date, dateFormatStyle)}` : null,
                    u?.end_date ? `Ended ${formatTreeDate(u.end_date, dateFormatStyle)}` : null,
                  ].filter(Boolean).join(' • ');

                  return (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'var(--card-bg)',
                        border: isDivorced ? '1px dashed #f43f5e' : '1px solid var(--border-color)',
                        padding: '10px 12px',
                        borderRadius: 8,
                        gap: 6,
                      }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                        onClick={() => selectPerson(s.id, true)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{uIcon}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              fontSize: 11,
                              color: isDivorced ? '#f43f5e' : '#f472b6',
                              fontWeight: 700,
                              background: isDivorced ? 'rgba(244, 63, 94, 0.15)' : 'rgba(244, 114, 182, 0.15)',
                              padding: '2px 8px',
                              borderRadius: 6,
                            }}
                          >
                            {statusLabel}
                          </span>
                          {u && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingUnion(u);
                                setEditingSpouseName(s.name);
                                setUnionType(u.union_type);
                                setUnionStartDate(u.start_date || '');
                                setUnionEndDate(u.end_date || '');
                                setUnionStartPlace(u.start_place || '');
                                setUnionNotes(u.notes || '');
                              }}
                              style={{
                                background: 'transparent',
                                border: '1px solid var(--border-color)',
                                borderRadius: 4,
                                color: 'var(--text-secondary)',
                                padding: '2px 6px',
                                fontSize: 11,
                                cursor: 'pointer',
                              }}
                              title="Edit spouse union details"
                            >
                              ✏️ Edit
                            </button>
                          )}
                        </div>
                      </div>

                      {dateDetails && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', paddingLeft: 24 }}>
                          {dateDetails}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Spouse Union Editing Modal */}
            {editingUnion && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 200,
                  background: 'rgba(0,0,0,0.65)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 20,
                  backdropFilter: 'blur(8px)',
                }}
                onClick={() => setEditingUnion(null)}
              >
                <div
                  style={{
                    background: 'var(--modal-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 16,
                    width: '100%',
                    maxWidth: 480,
                    padding: 24,
                    boxShadow: 'var(--shadow-modal)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Spouse & Union Details
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Relationship between {person.first_name} and {editingSpouseName}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Union Status</label>
                      <select value={unionType} onChange={(e) => setUnionType(e.target.value as UnionType)} style={inputStyle}>
                        <option value="MARRIAGE">💍 Marriage</option>
                        <option value="DIVORCED">💔 Divorced</option>
                        <option value="SEPARATED">⚡ Separated</option>
                        <option value="PARTNERSHIP">💞 Partnership</option>
                        <option value="CIVIL_UNION">📜 Civil Union</option>
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Marriage / Start Date</label>
                      <CustomDatePicker value={unionStartDate} onChange={setUnionStartDate} placeholder="e.g. 1980-06-21, 21.06.1980..." />
                    </div>

                    <div>
                      <label style={labelStyle}>
                        {unionType === 'DIVORCED' ? 'Divorce Date' : 'End Date (if applicable)'}
                      </label>
                      <CustomDatePicker value={unionEndDate} onChange={setUnionEndDate} placeholder="e.g. 1995-11-04, 04.11.1995..." />
                    </div>

                    <div>
                      <label style={labelStyle}>Marriage / Union Location</label>
                      <input
                        type="text"
                        value={unionStartPlace}
                        onChange={(e) => setUnionStartPlace(e.target.value)}
                        style={inputStyle}
                        placeholder="City, State, Country"
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Notes & Details</label>
                      <textarea
                        value={unionNotes}
                        onChange={(e) => setUnionNotes(e.target.value)}
                        rows={2}
                        style={{ ...inputStyle, resize: 'vertical' }}
                        placeholder="Optional details or memories..."
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                      <button
                        type="button"
                        style={{
                          background: 'var(--nav-tab-bg)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 8,
                          padding: '8px 16px',
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                        onClick={() => setEditingUnion(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSavingUnion}
                        style={{
                          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 20px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        onClick={async () => {
                          if (!editingUnion) return;
                          setIsSavingUnion(true);
                          try {
                            const res = await fetch(`/api/family-tree/unions/${editingUnion.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                union_type: unionType,
                                start_date: unionStartDate.trim() || undefined,
                                end_date: unionEndDate.trim() || undefined,
                                start_place: unionStartPlace.trim() || undefined,
                                notes: unionNotes.trim() || undefined,
                              }),
                            });
                            if (res.ok) {
                              setEditingUnion(null);
                              getPersonContext({ personId: person.id }).then((ctx) => setPersonContext(ctx));
                              await onUpdatePerson(person.id, {});
                            }
                          } finally {
                            setIsSavingUnion(false);
                          }
                        }}
                      >
                        {isSavingUnion ? 'Saving...' : 'Save Union'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Siblings */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Siblings ({personContext?.immediateFamily?.siblings?.length || 0})
                </div>
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary-color, #6366f1)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => onOpenQuickAdd(person.id, 'SIBLING')}
                >
                  + Add Sibling
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {personContext?.immediateFamily?.siblings?.map((sib: any) => (
                  <div
                    key={sib.id}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}
                    onClick={() => selectPerson(sib.id, true)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>↔️</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{sib.name}</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{sib.relation}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Children */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Children ({personContext?.immediateFamily?.children?.length || 0})
                </div>
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary-color, #6366f1)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => onOpenQuickAdd(person.id, 'CHILD')}
                >
                  + Add Child
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {personContext?.immediateFamily?.children?.map((c: any) => (
                  <div
                    key={c.id}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}
                    onClick={() => selectPerson(c.id, true)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>👶</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--primary-color, #6366f1)', fontWeight: 600 }}>{c.relation}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Life Story & Facts */}
        {drawerActiveTab === 'timeline' && (
          <PersonTimelineView personId={person.id} personName={fullName} />
        )}
      </div>
    </div>
  );
};
