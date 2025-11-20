import { create } from 'zustand';
import { Annotation, AnnotationCreate } from '@/types';

const MAX_HISTORY = 50; // Maximum number of undo steps

interface AnnotationStore {
  annotations: Annotation[];
  selectedIds: string[];
  history: Annotation[][];
  historyIndex: number;
  clipboard: Annotation[];
  setAnnotations: (annotations: Annotation[]) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, data: Partial<Annotation>) => void;
  updateAnnotationLocal: (id: string, data: Partial<Annotation>) => void; // No history
  deleteAnnotation: (id: string) => void;
  selectAnnotation: (id: string, multi?: boolean) => void;
  clearSelection: () => void;
  deleteSelected: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  duplicateSelected: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  annotations: [],
  selectedIds: [],
  history: [],
  historyIndex: -1,
  clipboard: [],

  setAnnotations: annotations =>
    set({
      annotations,
      selectedIds: [],
      history: [annotations],
      historyIndex: 0,
    }),

  addAnnotation: annotation =>
    set(state => {
      const newAnnotations = [...state.annotations, annotation];
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(newAnnotations);

      // Limit history size
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
        return {
          annotations: newAnnotations,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }

      return {
        annotations: newAnnotations,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  updateAnnotation: (id, data) =>
    set(state => {
      const newAnnotations = state.annotations.map(ann =>
        ann.id === id ? { ...ann, ...data } : ann
      );
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(newAnnotations);

      // Limit history size
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
        return {
          annotations: newAnnotations,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }

      return {
        annotations: newAnnotations,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  // Update annotation without saving to history (for drag previews)
  updateAnnotationLocal: (id, data) =>
    set(state => ({
      annotations: state.annotations.map(ann =>
        ann.id === id ? { ...ann, ...data } : ann
      ),
    })),

  deleteAnnotation: id =>
    set(state => {
      const newAnnotations = state.annotations.filter(ann => ann.id !== id);
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(newAnnotations);

      // Limit history size
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
        return {
          annotations: newAnnotations,
          selectedIds: state.selectedIds.filter(sid => sid !== id),
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }

      return {
        annotations: newAnnotations,
        selectedIds: state.selectedIds.filter(sid => sid !== id),
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  selectAnnotation: (id, multi = false) =>
    set(state => {
      if (multi) {
        return {
          selectedIds: state.selectedIds.includes(id)
            ? state.selectedIds.filter(sid => sid !== id)
            : [...state.selectedIds, id],
        };
      } else {
        return {
          selectedIds: state.selectedIds.includes(id) && state.selectedIds.length === 1 ? [] : [id],
        };
      }
    }),

  clearSelection: () =>
    set({
      selectedIds: [],
    }),

  deleteSelected: () =>
    set(state => {
      const newAnnotations = state.annotations.filter(ann => !state.selectedIds.includes(ann.id));
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(newAnnotations);

      // Limit history size
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
        return {
          annotations: newAnnotations,
          selectedIds: [],
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }

      return {
        annotations: newAnnotations,
        selectedIds: [],
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  copySelected: () =>
    set(state => {
      const selectedAnnotations = state.annotations.filter(ann =>
        state.selectedIds.includes(ann.id)
      );
      return {
        clipboard: selectedAnnotations,
      };
    }),

  pasteClipboard: () =>
    set(state => {
      if (state.clipboard.length === 0) return state;

      // Create new annotations with new IDs and offset positions
      const newAnnotations = state.clipboard.map(ann => {
        const newId = `${Date.now()}-${Math.random()}`;
        const offsetX = 20;
        const offsetY = 20;

        let newData = { ...ann.data };

        // Offset annotation based on type
        if (ann.type === 'circle') {
          newData = {
            ...newData,
            x: newData.x + offsetX,
            y: newData.y + offsetY,
          };
        } else if (ann.type === 'box' || ann.type === 'rectangle') {
          newData = {
            ...newData,
            corners: newData.corners.map((corner: [number, number]) => [
              corner[0] + offsetX,
              corner[1] + offsetY,
            ]),
          };
        } else if (ann.type === 'polygon') {
          newData = {
            ...newData,
            points: newData.points.map((point: [number, number]) => [
              point[0] + offsetX,
              point[1] + offsetY,
            ]),
          };
        }

        return {
          ...ann,
          id: newId,
          data: newData,
        };
      });

      const allAnnotations = [...state.annotations, ...newAnnotations];
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(allAnnotations);

      // Limit history size
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
        return {
          annotations: allAnnotations,
          selectedIds: newAnnotations.map(ann => ann.id),
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }

      return {
        annotations: allAnnotations,
        selectedIds: newAnnotations.map(ann => ann.id),
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  duplicateSelected: () =>
    set(state => {
      const selectedAnnotations = state.annotations.filter(ann =>
        state.selectedIds.includes(ann.id)
      );

      if (selectedAnnotations.length === 0) return state;

      // Create new annotations with new IDs and offset positions
      const newAnnotations = selectedAnnotations.map(ann => {
        const newId = `${Date.now()}-${Math.random()}`;
        const offsetX = 20;
        const offsetY = 20;

        let newData = { ...ann.data };

        // Offset annotation based on type
        if (ann.type === 'circle') {
          newData = {
            ...newData,
            x: newData.x + offsetX,
            y: newData.y + offsetY,
          };
        } else if (ann.type === 'box' || ann.type === 'rectangle') {
          newData = {
            ...newData,
            corners: newData.corners.map((corner: [number, number]) => [
              corner[0] + offsetX,
              corner[1] + offsetY,
            ]),
          };
        } else if (ann.type === 'polygon') {
          newData = {
            ...newData,
            points: newData.points.map((point: [number, number]) => [
              point[0] + offsetX,
              point[1] + offsetY,
            ]),
          };
        }

        return {
          ...ann,
          id: newId,
          data: newData,
        };
      });

      const allAnnotations = [...state.annotations, ...newAnnotations];
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(allAnnotations);

      // Limit history size
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
        return {
          annotations: allAnnotations,
          selectedIds: newAnnotations.map(ann => ann.id),
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }

      return {
        annotations: allAnnotations,
        selectedIds: newAnnotations.map(ann => ann.id),
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  undo: () =>
    set(state => {
      if (state.historyIndex > 0) {
        const newIndex = state.historyIndex - 1;
        return {
          annotations: state.history[newIndex],
          historyIndex: newIndex,
          selectedIds: [], // Clear selection on undo
        };
      }
      return state;
    }),

  redo: () =>
    set(state => {
      if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        return {
          annotations: state.history[newIndex],
          historyIndex: newIndex,
          selectedIds: [], // Clear selection on redo
        };
      }
      return state;
    }),

  canUndo: () => {
    const state = get();
    return state.historyIndex > 0;
  },

  canRedo: () => {
    const state = get();
    return state.historyIndex < state.history.length - 1;
  },
}));
