import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TreeGraphUnion } from '../../../types/tree.types.js';

export interface UnionNodeData {
  union: TreeGraphUnion;
}

export const UnionNode = memo(({ data }: NodeProps) => {
  const { union } = data as unknown as UnionNodeData;

  const isDivorced = union.union_type === 'DIVORCED';
  const icon = isDivorced ? '💔' : union.union_type === 'MARRIAGE' ? '💍' : '💞';

  const tooltipText = [
    union.union_type,
    union.start_date ? `Since: ${union.start_date}` : null,
    union.start_place ? `at ${union.start_place}` : null,
    union.end_date ? `Ended: ${union.end_date}` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        backgroundColor: '#1e293b',
        border: '2px solid rgba(255, 255, 255, 0.18)',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 15,
        cursor: 'pointer',
        position: 'relative',
        transition: 'transform 0.15s ease',
      }}
      title={tooltipText || 'Partnership Union'}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#6366f1',
          width: 6,
          height: 6,
          border: '1px solid #0f172a',
          top: -3,
        }}
      />
      
      <span>{icon}</span>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#a855f7',
          width: 6,
          height: 6,
          border: '1px solid #0f172a',
          bottom: -3,
        }}
      />
    </div>
  );
});

UnionNode.displayName = 'UnionNode';
