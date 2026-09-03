import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TreeGraphPerson } from '../../../types/tree.types.js';
import { useFamilyTreeStore } from '../../../state/useFamilyTreeStore.js';

export interface PersonCardNodeData {
  person: TreeGraphPerson;
  isRoot?: boolean;
  isFolded?: boolean;
}

export const PersonCardNode = memo(({ data, selected }: NodeProps) => {
  const { person, isRoot, isFolded } = data as unknown as PersonCardNodeData;
  const {
    selectedPersonId,
    highlightedPersonId,
    selectPerson,
    openDrawer,
    openQuickAdd,
    toggleFoldBranch,
  } = useFamilyTreeStore();

  const isCurrentSelected = selected || selectedPersonId === person.id;
  const isHighlighted = highlightedPersonId === person.id;

  const fullName = person.full_name || `${person.first_name} ${person.last_name || ''}`.trim();
  const birthYear = person.birth_date ? person.birth_date.split('-')[0] : '';
  const deathYear = person.death_date ? person.death_date.split('-')[0] : '';
  const lifespan = person.is_living
    ? birthYear ? `b. ${birthYear}` : 'Living'
    : birthYear && deathYear
      ? `${birthYear} – ${deathYear}`
      : deathYear ? `d. ${deathYear}` : 'Deceased';

  const avatarUrl = person.avatar_url || (person.avatar_face_id && !person.avatar_face_id.startsWith('manual_') && !person.avatar_face_id.startsWith('face_manual_') ? `/api/faces/image/${person.avatar_face_id}` : null);
  const initials = `${person.first_name?.[0] || ''}${person.last_name?.[0] || ''}`.toUpperCase() || '?';

  // Gender colors
  const genderGradient =
    person.gender === 'MALE'
      ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
      : person.gender === 'FEMALE'
        ? 'linear-gradient(135deg, #ec4899, #be185d)'
        : 'linear-gradient(135deg, #8b5cf6, #6d28d9)';

  const cardBorder = isHighlighted
    ? '2px solid #f59e0b'
    : isCurrentSelected
      ? '2px solid var(--primary-color, #6366f1)'
      : isRoot
        ? '1.5px solid var(--accent-color, #a855f7)'
        : '1px solid var(--border-color)';

  const cardShadow = isHighlighted
    ? '0 0 25px rgba(245, 158, 11, 0.5)'
    : isCurrentSelected
      ? '0 0 25px rgba(99, 102, 241, 0.5)'
      : isRoot
        ? '0 4px 20px rgba(168, 85, 247, 0.25)'
        : 'var(--shadow-card)';

  return (
    <div
      style={{
        width: 250,
        height: 140,
        backgroundColor: 'var(--card-bg-solid)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 14,
        border: cardBorder,
        boxShadow: cardShadow,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        userSelect: 'none',
      }}
      onClick={(e) => {
        e.stopPropagation();
        selectPerson(person.id, true);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        openDrawer('bio', person.id);
      }}
    >
      {/* Handles for connections */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: 'var(--primary-color, #6366f1)',
          width: 8,
          height: 8,
          border: '2px solid var(--card-bg-solid)',
          top: -4,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: 'var(--accent-color, #a855f7)',
          width: 8,
          height: 8,
          border: '2px solid var(--card-bg-solid)',
          bottom: -4,
        }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ opacity: 0 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ opacity: 0 }}
      />

      {/* Root "ME" Anchor Badge */}
      {isRoot && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            left: 12,
            background: 'linear-gradient(135deg, #a855f7, #6366f1)',
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.05em',
            padding: '2px 8px',
            borderRadius: 10,
            boxShadow: '0 2px 8px rgba(168, 85, 247, 0.4)',
            zIndex: 10,
          }}
        >
          ⭐ ROOT (ME)
        </div>
      )}

      {/* Card Header: Avatar, Name, Maiden Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={fullName}
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid rgba(255, 255, 255, 0.15)',
              flexShrink: 0,
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: genderGradient,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 16,
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            }}
          >
            {initials}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={fullName}
          >
            {fullName}
          </div>
          {person.maiden_name && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              née {person.maiden_name}
            </div>
          )}
          <div
            style={{
              fontSize: 11,
              color: person.is_living ? '#10b981' : 'var(--text-secondary)',
              marginTop: 2,
              fontWeight: 500,
            }}
          >
            {lifespan}
          </div>
        </div>
      </div>

      {/* Card Details: Birth Place & Attributes */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border-color)',
          paddingTop: 6,
          fontSize: 11,
          color: 'var(--text-secondary)',
        }}
      >
        <div
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 150,
          }}
          title={person.birth_place || ''}
        >
          {person.birth_place ? `📍 ${person.birth_place}` : '📍 Location unrecorded'}
        </div>

        {/* Action buttons: Quick-Add & Fold */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            style={{
              background: 'var(--nav-tab-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
            }}
            title="Quick add relative"
            onClick={(e) => {
              e.stopPropagation();
              openQuickAdd(person.id);
            }}
          >
            +
          </button>

          <button
            type="button"
            style={{
              background: isFolded ? 'rgba(168, 85, 247, 0.25)' : 'var(--nav-tab-bg)',
              border: isFolded ? '1px solid var(--accent-color, #a855f7)' : '1px solid var(--border-color)',
              borderRadius: 6,
              color: isFolded ? 'var(--accent-color, #a855f7)' : 'var(--text-primary)',
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 12,
            }}
            title={isFolded ? 'Unfold branch' : 'Fold descendants branch'}
            onClick={(e) => {
              e.stopPropagation();
              toggleFoldBranch(person.id);
            }}
          >
            {isFolded ? '▼' : '▲'}
          </button>
        </div>
      </div>
    </div>
  );
});

PersonCardNode.displayName = 'PersonCardNode';
