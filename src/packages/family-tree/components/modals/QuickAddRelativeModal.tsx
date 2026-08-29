import { useState } from 'react';
import type { Gender, FiliationType } from '../../types/tree.types.js';

interface QuickAddRelativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPersonId: string | null;
  targetPersonName?: string;
  initialRelationship?: 'PARENT' | 'CHILD' | 'SPOUSE' | 'SIBLING';
  onAddRelative: (data: {
    relationship: 'PARENT' | 'CHILD' | 'SPOUSE' | 'SIBLING';
    target_person_id: string;
    person: Record<string, any>;
    filiation?: FiliationType;
  }) => Promise<void>;
}

export const QuickAddRelativeModal = ({
  isOpen,
  onClose,
  targetPersonId,
  targetPersonName,
  initialRelationship = 'CHILD',
  onAddRelative,
}: QuickAddRelativeModalProps) => {
  const [relationship, setRelationship] = useState<'PARENT' | 'CHILD' | 'SPOUSE' | 'SIBLING'>(initialRelationship);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [maidenName, setMaidenName] = useState('');
  const [gender, setGender] = useState<Gender>('UNKNOWN');
  const [birthDate, setBirthDate] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [isLiving, setIsLiving] = useState(true);
  const [deathDate, setDeathDate] = useState('');
  const [filiation, setFiliation] = useState<FiliationType>('BIOLOGICAL');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !targetPersonId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddRelative({
        relationship,
        target_person_id: targetPersonId,
        person: {
          first_name: firstName.trim(),
          middle_name: middleName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          maiden_name: maidenName.trim() || undefined,
          gender,
          birth_date: birthDate.trim() || undefined,
          birth_place: birthPlace.trim() || undefined,
          is_living: isLiving,
          death_date: !isLiving ? deathDate.trim() || undefined : undefined,
        },
        filiation: (relationship === 'CHILD' || relationship === 'PARENT' || relationship === 'SIBLING') ? filiation : undefined,
      });
      onClose();
      // Reset
      setFirstName('');
      setMiddleName('');
      setLastName('');
      setMaidenName('');
      setBirthDate('');
      setBirthPlace('');
      setDeathDate('');
      setIsLiving(true);
    } catch {
      // ignore
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(30, 41, 59, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    padding: '8px 12px',
    color: '#f8fafc',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#94a3b8',
    marginBottom: 4,
  };

  const RELATIONSHIPS = [
    { id: 'PARENT', label: 'Parent (Father / Mother)', icon: '⬆️' },
    { id: 'SPOUSE', label: 'Spouse / Partner', icon: '💍' },
    { id: 'SIBLING', label: 'Sibling (Brother / Sister)', icon: '↔️' },
    { id: 'CHILD', label: 'Child (Son / Daughter)', icon: '⬇️' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 540,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
              Add Family Relative
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {targetPersonName ? `Connecting new relative to ${targetPersonName}` : 'Add relative to family tree'}
            </div>
          </div>
          <button
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: 16,
              cursor: 'pointer',
            }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Relationship Selector */}
          <div>
            <label style={labelStyle}>Relationship to {targetPersonName || 'Selection'}</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {RELATIONSHIPS.map((rel) => {
                const isSelected = relationship === rel.id;
                return (
                  <button
                    key={rel.id}
                    type="button"
                    style={{
                      background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(30, 41, 59, 0.5)',
                      border: isSelected ? '1.5px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      color: isSelected ? '#ffffff' : '#94a3b8',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onClick={() => setRelationship(rel.id as any)}
                  >
                    <span>{rel.icon}</span>
                    <span>{rel.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Names */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>First Name *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Sarah"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Johnson"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Middle Name</label>
              <input
                type="text"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="e.g. Elizabeth"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Maiden / Birth Name</label>
              <input
                type="text"
                value={maidenName}
                onChange={(e) => setMaidenName(e.target.value)}
                placeholder="e.g. Smith"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Gender and Filiation */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                style={inputStyle}
              >
                <option value="UNKNOWN">Unknown / Unspecified</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="NON_BINARY">Non-Binary</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {(relationship === 'CHILD' || relationship === 'PARENT' || relationship === 'SIBLING') && (
              <div>
                <label style={labelStyle}>Filiation / Tie</label>
                <select
                  value={filiation}
                  onChange={(e) => setFiliation(e.target.value as FiliationType)}
                  style={inputStyle}
                >
                  <option value="BIOLOGICAL">Biological</option>
                  <option value="ADOPTED">Adopted</option>
                  <option value="FOSTER">Foster</option>
                  <option value="STEP">Step-Relation</option>
                  <option value="SURROGATE">Surrogate</option>
                </select>
              </div>
            )}
          </div>

          {/* Birth Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Birth Date (YYYY, YYYY-MM, or YYYY-MM-DD)</label>
              <input
                type="text"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                placeholder="e.g. 1968-05-14"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Birth Place</label>
              <input
                type="text"
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                placeholder="e.g. Boston, MA"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Living vs Deceased */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                color: '#f8fafc',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={isLiving}
                onChange={(e) => setIsLiving(e.target.checked)}
              />
              <span>This person is currently living</span>
            </label>

            {!isLiving && (
              <div style={{ marginTop: 10 }}>
                <label style={labelStyle}>Death Date (YYYY, YYYY-MM, or YYYY-MM-DD)</label>
                <input
                  type="text"
                  value={deathDate}
                  onChange={(e) => setDeathDate(e.target.value)}
                  placeholder="e.g. 2015-11-20"
                  style={inputStyle}
                />
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                cursor: 'pointer',
              }}
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
              }}
            >
              {isSubmitting ? 'Adding...' : 'Add Family Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
