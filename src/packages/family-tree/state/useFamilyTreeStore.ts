import { useState, useEffect, useCallback } from 'react';
import type { PersonEventRecord } from '../types/event.types.js';

export interface FamilyTreeState {
  selectedPersonId: string | null;
  selectedUnionId: string | null;
  hoveredPersonId: string | null;
  isDetailDrawerOpen: boolean;
  drawerActiveTab: 'bio' | 'family' | 'timeline';
  isQuickAddModalOpen: boolean;
  quickAddTargetPersonId: string | null;
  quickAddInitialRelation: 'PARENT' | 'CHILD' | 'SPOUSE' | 'SIBLING';
  isFaceLinkModalOpen: boolean;
  faceLinkTargetPersonId: string | null;
  isAddFactModalOpen: boolean;
  factToEdit: PersonEventRecord | null;
  isGalleryPickerOpen: boolean;
  layoutDirection: 'TB' | 'LR';
  foldedNodeIds: Set<string>;
  searchQuery: string;
  highlightedPersonId: string | null;
  activeTimelineCategory: string;
  activeTreeId: string;
}

let globalState: FamilyTreeState = {
  selectedPersonId: null,
  selectedUnionId: null,
  hoveredPersonId: null,
  isDetailDrawerOpen: false,
  drawerActiveTab: 'bio',
  isQuickAddModalOpen: false,
  quickAddTargetPersonId: null,
  quickAddInitialRelation: 'CHILD',
  isFaceLinkModalOpen: false,
  faceLinkTargetPersonId: null,
  isAddFactModalOpen: false,
  factToEdit: null,
  isGalleryPickerOpen: false,
  layoutDirection: 'TB',
  foldedNodeIds: new Set<string>(),
  searchQuery: '',
  highlightedPersonId: null,
  activeTimelineCategory: 'ALL',
  activeTreeId: 'default_tree',
};

const listeners = new Set<(state: FamilyTreeState) => void>();

function emit() {
  listeners.forEach((listener) => listener(globalState));
}

export function setTreeStore(partial: Partial<FamilyTreeState> | ((prev: FamilyTreeState) => Partial<FamilyTreeState>)) {
  const next = typeof partial === 'function' ? partial(globalState) : partial;
  globalState = { ...globalState, ...next };
  emit();
}

export function useFamilyTreeStore() {
  const [state, setState] = useState<FamilyTreeState>(globalState);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const selectPerson = useCallback((personId: string | null, openDrawer: boolean = false) => {
    setTreeStore((prev) => ({
      selectedPersonId: personId,
      selectedUnionId: null,
      isDetailDrawerOpen: openDrawer ? true : prev.isDetailDrawerOpen,
    }));
  }, []);

  const openDrawer = useCallback((tab: 'bio' | 'family' | 'timeline' = 'bio', personId?: string) => {
    setTreeStore((prev) => ({
      isDetailDrawerOpen: true,
      drawerActiveTab: tab,
      selectedPersonId: personId || prev.selectedPersonId,
    }));
  }, []);

  const closeDrawer = useCallback(() => {
    setTreeStore({ isDetailDrawerOpen: false });
  }, []);

  const openQuickAdd = useCallback((targetPersonId: string, relation: 'PARENT' | 'CHILD' | 'SPOUSE' | 'SIBLING' = 'CHILD') => {
    setTreeStore({
      isQuickAddModalOpen: true,
      quickAddTargetPersonId: targetPersonId,
      quickAddInitialRelation: relation,
    });
  }, []);

  const closeQuickAdd = useCallback(() => {
    setTreeStore({ isQuickAddModalOpen: false, quickAddTargetPersonId: null });
  }, []);

  const openFaceLink = useCallback((targetPersonId: string) => {
    setTreeStore({
      isFaceLinkModalOpen: true,
      faceLinkTargetPersonId: targetPersonId,
    });
  }, []);

  const closeFaceLink = useCallback(() => {
    setTreeStore({ isFaceLinkModalOpen: false, faceLinkTargetPersonId: null });
  }, []);

  const openAddFact = useCallback((fact?: PersonEventRecord | null) => {
    setTreeStore({
      isAddFactModalOpen: true,
      factToEdit: fact || null,
    });
  }, []);

  const closeAddFact = useCallback(() => {
    setTreeStore({ isAddFactModalOpen: false, factToEdit: null });
  }, []);

  const toggleFoldBranch = useCallback((personId: string) => {
    setTreeStore((prev) => {
      const nextSet = new Set(prev.foldedNodeIds);
      if (nextSet.has(personId)) {
        nextSet.delete(personId);
      } else {
        nextSet.add(personId);
      }
      return { foldedNodeIds: nextSet };
    });
  }, []);

  const setLayoutDirection = useCallback((dir: 'TB' | 'LR') => {
    setTreeStore({ layoutDirection: dir });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setTreeStore({ searchQuery: query });
  }, []);

  const setHighlightedPersonId = useCallback((id: string | null) => {
    setTreeStore({ highlightedPersonId: id });
  }, []);

  const setActiveTimelineCategory = useCallback((category: string) => {
    setTreeStore({ activeTimelineCategory: category });
  }, []);

  const setActiveTreeId = useCallback((treeId: string) => {
    setTreeStore({ activeTreeId: treeId });
  }, []);

  return {
    ...state,
    selectPerson,
    openDrawer,
    closeDrawer,
    openQuickAdd,
    closeQuickAdd,
    openFaceLink,
    closeFaceLink,
    openAddFact,
    closeAddFact,
    toggleFoldBranch,
    setLayoutDirection,
    setSearchQuery,
    setHighlightedPersonId,
    setActiveTimelineCategory,
    setActiveTreeId,
    setTreeStore,
  };
}
