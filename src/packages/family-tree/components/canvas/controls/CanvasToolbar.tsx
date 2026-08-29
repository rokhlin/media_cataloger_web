import { memo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useFamilyTreeStore } from '../../../state/useFamilyTreeStore.js';
import type { TreeGraphData } from '../../../types/tree.types.js';

interface CanvasToolbarProps {
  graphData: TreeGraphData | null;
  onAddMember: () => void;
  onRecalculateLayout: () => void;
}

export const CanvasToolbar = memo(({ graphData, onAddMember, onRecalculateLayout }: CanvasToolbarProps) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { layoutDirection, setLayoutDirection, selectPerson } = useFamilyTreeStore();

  const handleFocusRoot = () => {
    if (!graphData?.root_person_id) return;
    const rootNodeId = `p_${graphData.root_person_id}`;
    selectPerson(graphData.root_person_id, false);
    fitView({ nodes: [{ id: rootNodeId }], duration: 800, maxZoom: 1.2 });
  };

  const toggleDirection = () => {
    setLayoutDirection(layoutDirection === 'TB' ? 'LR' : 'TB');
  };

  const buttonStyle: React.CSSProperties = {
    background: 'rgba(30, 41, 59, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#e2e8f0',
    padding: '7px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    backdropFilter: 'blur(8px)',
    transition: 'all 0.15s ease',
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(15, 23, 42, 0.75)',
        padding: '6px 8px',
        borderRadius: 12,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}
    >
      <button type="button" style={buttonStyle} onClick={() => zoomIn({ duration: 300 })} title="Zoom In">
        ➕ Zoom In
      </button>

      <button type="button" style={buttonStyle} onClick={() => zoomOut({ duration: 300 })} title="Zoom Out">
        ➖ Zoom Out
      </button>

      <button type="button" style={buttonStyle} onClick={() => fitView({ duration: 500, padding: 0.2 })} title="Fit Tree View">
        🔍 Fit View
      </button>

      <button
        type="button"
        style={{
          ...buttonStyle,
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(99, 102, 241, 0.3))',
          border: '1px solid rgba(168, 85, 247, 0.4)',
          color: '#e0e7ff',
        }}
        onClick={handleFocusRoot}
        title="Focus on Root ('ME') Person"
      >
        ⭐ Focus ME
      </button>

      <button type="button" style={buttonStyle} onClick={toggleDirection} title="Toggle Layout Direction (Vertical / Horizontal)">
        {layoutDirection === 'TB' ? '⬇️ Vertical' : '➡️ Horizontal'}
      </button>

      <button type="button" style={buttonStyle} onClick={onRecalculateLayout} title="Rearrange Layout">
        🔄 Re-layout
      </button>

      <button
        type="button"
        style={{
          ...buttonStyle,
          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
          border: 'none',
          color: '#ffffff',
          boxShadow: '0 2px 10px rgba(99, 102, 241, 0.4)',
        }}
        onClick={onAddMember}
        title="Add New Person to Family Tree"
      >
        ➕ Add Person
      </button>
    </div>
  );
});

CanvasToolbar.displayName = 'CanvasToolbar';
