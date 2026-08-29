import ELK from 'elkjs/lib/elk.bundled.js';
import type { TreeGraphData } from '../types/tree.types.js';

export interface LayoutRequestMessage {
  type: 'LAYOUT_REQUEST';
  requestId: string;
  graphData: TreeGraphData;
  direction: 'TB' | 'LR';
  foldedNodeIds: string[];
}

export interface LayoutSuccessMessage {
  type: 'LAYOUT_SUCCESS';
  requestId: string;
  nodes: Array<{
    id: string;
    type: 'person' | 'union';
    position: { x: number; y: number };
    data: Record<string, any>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: 'biological' | 'non_biological';
    data?: Record<string, any>;
  }>;
}

export interface LayoutErrorMessage {
  type: 'LAYOUT_ERROR';
  requestId: string;
  error: string;
}

const ELKConstructor = (ELK as any)?.default || ELK;
let elkInstance: any = null;

function getElk() {
  if (!elkInstance) {
    elkInstance = typeof ELKConstructor === 'function' ? new ELKConstructor() : new (ELK as any)();
  }
  return elkInstance;
}

const PERSON_WIDTH = 250;
const PERSON_HEIGHT = 140;
const UNION_SIZE = 36;

export async function computeElkLayout(
  graphData: TreeGraphData,
  direction: 'TB' | 'LR',
  foldedNodeIds: Set<string>,
): Promise<{
  nodes: Array<{ id: string; type: 'person' | 'union'; position: { x: number; y: number }; data: Record<string, any> }>;
  edges: Array<{ id: string; source: string; target: string; type: 'biological' | 'non_biological'; data?: Record<string, any> }>;
}> {
  const isHorizontal = direction === 'LR';
  const elkDirection = isHorizontal ? 'RIGHT' : 'DOWN';

  // 1. Filter out folded descendant subtrees
  const hiddenPersonIds = new Set<string>();
  if (foldedNodeIds.size > 0) {
    const queue = Array.from(foldedNodeIds);
    while (queue.length > 0) {
      const pId = queue.shift()!;
      // Find all unions where pId is partner
      const partnerUnions = graphData.unions.filter((u) => u.partner_ids.includes(pId));
      for (const u of partnerUnions) {
        for (const ch of u.children) {
          if (!hiddenPersonIds.has(ch.person_id) && !foldedNodeIds.has(ch.person_id)) {
            hiddenPersonIds.add(ch.person_id);
            queue.push(ch.person_id);
          }
        }
      }
    }
  }

  const visiblePersons = graphData.persons.filter((p) => !hiddenPersonIds.has(p.id));
  const visiblePersonIds = new Set(visiblePersons.map((p) => p.id));

  const visibleUnions = graphData.unions.filter((u) => {
    const hasVisiblePartner = u.partner_ids.some((pid) => visiblePersonIds.has(pid));
    const hasVisibleChild = u.children.some((ch) => visiblePersonIds.has(ch.person_id));
    return hasVisiblePartner || hasVisibleChild;
  });

  // 2. Build ELK Nodes
  const elkNodes: any[] = [];
  const elkEdges: any[] = [];
  const reactFlowNodes: any[] = [];
  const reactFlowEdges: any[] = [];

  for (const p of visiblePersons) {
    elkNodes.push({
      id: `p_${p.id}`,
      width: PERSON_WIDTH,
      height: PERSON_HEIGHT,
      layoutOptions: {
        'elk.padding': '[top=10,left=10,bottom=10,right=10]',
      },
    });
  }

  for (const u of visibleUnions) {
    elkNodes.push({
      id: `u_${u.id}`,
      width: UNION_SIZE,
      height: UNION_SIZE,
      layoutOptions: {
        'elk.padding': '[top=4,left=4,bottom=4,right=4]',
      },
    });

    // Edges: Partners -> Union
    u.partner_ids.forEach((partnerId, idx) => {
      if (visiblePersonIds.has(partnerId)) {
        const edgeId = `edge_p_${partnerId}_to_u_${u.id}_${idx}`;
        elkEdges.push({
          id: edgeId,
          sources: [`p_${partnerId}`],
          targets: [`u_${u.id}`],
        });

        reactFlowEdges.push({
          id: edgeId,
          source: `p_${partnerId}`,
          target: `u_${u.id}`,
          type: 'biological',
          data: { unionId: u.id, partnerId },
        });
      }
    });

    // Edges: Union -> Children
    u.children.forEach((child) => {
      if (visiblePersonIds.has(child.person_id)) {
        const edgeId = `edge_u_${u.id}_to_p_${child.person_id}`;
        const isBiological = child.filiation === 'BIOLOGICAL' || !child.filiation;

        elkEdges.push({
          id: edgeId,
          sources: [`u_${u.id}`],
          targets: [`p_${child.person_id}`],
        });

        reactFlowEdges.push({
          id: edgeId,
          source: `u_${u.id}`,
          target: `p_${child.person_id}`,
          type: isBiological ? 'biological' : 'non_biological',
          data: { unionId: u.id, filiation: child.filiation },
        });
      }
    });
  }

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': elkDirection,
      'elk.spacing.nodeNode': isHorizontal ? '60' : '45',
      'elk.layered.spacing.nodeNodeBetweenLayers': isHorizontal ? '80' : '65',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.edgeRouting': 'SPLINES',
      'elk.layered.mergeEdges': 'true',
    },
    children: elkNodes,
    edges: elkEdges,
  };

  const layouted = await getElk().layout(elkGraph);

  const nodeMap = new Map<string, { x: number; y: number }>();
  if (layouted.children) {
    for (const child of layouted.children) {
      nodeMap.set(child.id, { x: child.x || 0, y: child.y || 0 });
    }
  }

  // Build final React Flow Nodes
  for (const p of visiblePersons) {
    const pos = nodeMap.get(`p_${p.id}`) || { x: 0, y: 0 };
    reactFlowNodes.push({
      id: `p_${p.id}`,
      type: 'person',
      position: pos,
      data: {
        person: p,
        isRoot: p.id === graphData.root_person_id,
        isFolded: foldedNodeIds.has(p.id),
      },
    });
  }

  for (const u of visibleUnions) {
    const pos = nodeMap.get(`u_${u.id}`) || { x: 0, y: 0 };
    reactFlowNodes.push({
      id: `u_${u.id}`,
      type: 'union',
      position: pos,
      data: {
        union: u,
      },
    });
  }

  return {
    nodes: reactFlowNodes,
    edges: reactFlowEdges,
  };
}

// Web Worker message dispatcher (if run in worker context)
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.onmessage = async (e: MessageEvent<LayoutRequestMessage>) => {
    const { type, requestId, graphData, direction, foldedNodeIds } = e.data;
    if (type === 'LAYOUT_REQUEST') {
      try {
        const result = await computeElkLayout(graphData, direction, new Set(foldedNodeIds || []));
        const res: LayoutSuccessMessage = {
          type: 'LAYOUT_SUCCESS',
          requestId,
          nodes: result.nodes,
          edges: result.edges,
        };
        self.postMessage(res);
      } catch (err: any) {
        const errRes: LayoutErrorMessage = {
          type: 'LAYOUT_ERROR',
          requestId,
          error: err?.message || String(err),
        };
        self.postMessage(errRes);
      }
    }
  };
}
