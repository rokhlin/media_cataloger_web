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
        backgroundColor: 'var(--card-bg-solid)',
        border: '2px solid var(--border-color-hover)',
        boxShadow: 'var(--shadow-card)',
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
          background: 'var(--primary-color, #6366f1)',
          width: 6,
          height: 6,
          border: '1px solid var(--card-bg-solid)',
          top: -3,
        }}
      />
      
      <span>{icon}</span>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: 'var(--accent-color, #a855f7)',
          width: 6,
          height: 6,
          border: '1px solid var(--card-bg-solid)',
          bottom: -3,
        }}
      />
    </div>
  );
});

UnionNode.displayName = 'UnionNode';
