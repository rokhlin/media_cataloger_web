import { memo } from 'react';
import { useFamilyTreeStore } from '../../../state/useFamilyTreeStore.js';
import { useKinship } from '../../../hooks/useKinship.js';
import type { TreeGraphData } from '../../../types/tree.types.js';

interface KinshipHUDProps {
  graphData: TreeGraphData | null;
}

export const KinshipHUD = memo(({ graphData }: KinshipHUDProps) => {
  const { selectedPersonId, openDrawer } = useFamilyTreeStore();
  const rootPersonId = graphData?.root_person_id;

  const { kinship } = useKinship(rootPersonId, selectedPersonId);

  if (!selectedPersonId || !graphData) return null;

  const selectedPerson = graphData.persons.find((p) => p.id === selectedPersonId);
  const rootPerson = graphData.persons.find((p) => p.id === rootPersonId);

  if (!selectedPerson) return null;

  const selectedName = selectedPerson.full_name || `${selectedPerson.first_name} ${selectedPerson.last_name || ''}`.trim();
  const rootName = rootPerson ? (rootPerson.full_name || rootPerson.first_name) : 'Root';

  const term = kinship?.primaryTerm || 'Selected';
  const category = kinship?.category ? ` • ${kinship.category.replace('_', ' ')}` : '';
  const genDist = kinship?.generationalDistance ? ` • ${kinship.generationalDistance > 0 ? `+${kinship.generationalDistance}` : kinship.generationalDistance} Gen` : '';
  const blood = kinship?.isDirectBlood ? ' • 🩸 Direct Blood' : '';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        background: 'rgba(15, 23, 42, 0.9)',
        border: '1.5px solid rgba(99, 102, 241, 0.5)',
        borderRadius: 30,
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(99, 102, 241, 0.25)',
        backdropFilter: 'blur(16px)',
        color: '#f8fafc',
        fontSize: 13,
        fontWeight: 500,
        userSelect: 'none',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🧬</span>
        <span>
          <strong style={{ color: '#a5b4fc' }}>{selectedName}</strong>
          {' is '}
          <span
            style={{
              background: 'linear-gradient(135deg, #a855f7, #6366f1)',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: 6,
              fontWeight: 700,
            }}
          >
            {term}
          </span>
          {` to ${rootName}`}
          <span style={{ color: '#94a3b8', fontSize: 12 }}>
            {category}
            {genDist}
            {blood}
          </span>
        </span>
      </div>

      <button
        type="button"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: '#ffffff',
          padding: '4px 12px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onClick={() => openDrawer('timeline', selectedPerson.id)}
      >
        📖 View Life Story & Facts
      </button>
    </div>
  );
});

KinshipHUD.displayName = 'KinshipHUD';
