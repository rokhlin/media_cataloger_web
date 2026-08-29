import { memo, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { PersonCardNode } from './nodes/PersonCardNode.js';
import { UnionNode } from './nodes/UnionNode.js';
import { BiologicalEdge } from './edges/BiologicalEdge.js';
import { NonBiologicalEdge } from './edges/NonBiologicalEdge.js';
import { CanvasToolbar } from './controls/CanvasToolbar.js';
import { KinshipHUD } from './controls/KinshipHUD.js';
import { TreeSearchBar } from './controls/TreeSearchBar.js';
import { useTreeLayoutWorker } from '../../hooks/useTreeLayoutWorker.js';
import { useFamilyTreeStore } from '../../state/useFamilyTreeStore.js';
import type { TreeGraphData } from '../../types/tree.types.js';

interface TreeCanvasProps {
  graphData: TreeGraphData | null;
  isLoading: boolean;
  onAddMember: () => void;
}

const nodeTypes: NodeTypes = {
  person: PersonCardNode,
  union: UnionNode,
};

const edgeTypes: EdgeTypes = {
  biological: BiologicalEdge,
  non_biological: NonBiologicalEdge,
};

export const TreeCanvas = memo(({ graphData, isLoading, onAddMember }: TreeCanvasProps) => {
  const { layoutDirection, foldedNodeIds, selectPerson } = useFamilyTreeStore();
  const { fitView } = useReactFlow();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    isCalculating,
    recalculateLayout,
  } = useTreeLayoutWorker(graphData, layoutDirection, foldedNodeIds) as any;

  // Auto fit on initial load
  useEffect(() => {
    if (nodes && nodes.length > 0) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.15, duration: 600 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes?.length, fitView]);

  const defaultEdgeOptions = useMemo(
    () => ({
      animated: false,
    }),
    [],
  );

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <TreeSearchBar />

      <CanvasToolbar
        graphData={graphData}
        onAddMember={onAddMember}
        onRecalculateLayout={recalculateLayout}
      />

      <KinshipHUD graphData={graphData} />

      {/* Loading overlay indicator */}
      {(isLoading || isCalculating) && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            color: '#c7d2fe',
            padding: '6px 16px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span style={{ animation: 'pulse 1s infinite' }}>⚙️</span>
          Computing Tree Layout...
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isCalculating && (!graphData?.persons || graphData.persons.length === 0) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            gap: 16,
          }}
        >
          <div style={{ fontSize: 48 }}>🌳</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>
            Your Family Tree is Empty
          </div>
          <div style={{ fontSize: 13, maxWidth: 360, textAlign: 'center', color: '#94a3b8' }}>
            Start your genealogical journey by adding yourself or your first ancestor to the tree.
          </div>
          <button
            type="button"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
            }}
            onClick={onAddMember}
          >
            ➕ Add First Family Member
          </button>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onPaneClick={() => selectPerson(null, false)}
        minZoom={0.1}
        maxZoom={2.5}
        fitView
        proOptions={{ hideAttribution: true }}
        style={{
          background: 'transparent',
        }}
      >
        <Background color="rgba(255, 255, 255, 0.05)" gap={24} size={1} />
        <Controls
          position="bottom-right"
          showInteractive={false}
          style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        />
        <MiniMap
          nodeColor={(n: Node) => (n.type === 'person' ? '#6366f1' : '#a855f7')}
          maskColor="rgba(11, 15, 25, 0.75)"
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 8,
            bottom: 24,
            left: 24,
          }}
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
});

TreeCanvas.displayName = 'TreeCanvas';
