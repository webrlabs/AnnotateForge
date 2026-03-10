import { create } from 'zustand';
import { ToolType } from '@/types';

interface SnappingConfig {
  enabled: boolean;
  gridSize: number;
  snapToEdges: boolean;
  snapToVertices: boolean;
  snapThreshold: number;
}

interface UIStore {
  currentTool: ToolType;
  zoom: number;
  brightness: number;
  contrast: number;
  isLoading: boolean;
  error: string | null;

  // Auto-advance
  autoAdvance: boolean;

  // Image enhancements
  saturation: number;
  gamma: number;
  invert: boolean;

  // Minimap
  showMinimap: boolean;

  // Snapping
  snapping: SnappingConfig;

  // Active class for new annotations
  activeClass: string | null;

  // Actions
  setTool: (tool: ToolType) => void;
  setZoom: (zoom: number) => void;
  setBrightness: (brightness: number) => void;
  setContrast: (contrast: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAutoAdvance: (enabled: boolean) => void;
  setSaturation: (saturation: number) => void;
  setGamma: (gamma: number) => void;
  setInvert: (invert: boolean) => void;
  toggleMinimap: () => void;
  setSnapping: (updates: Partial<SnappingConfig>) => void;
  toggleSnapping: () => void;
  resetEnhancements: () => void;
  setActiveClass: (className: string | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  currentTool: 'select',
  zoom: 1.0,
  brightness: 0,
  contrast: 0,
  isLoading: false,
  error: null,
  autoAdvance: false,
  saturation: 100,
  gamma: 1.0,
  invert: false,
  showMinimap: true,
  activeClass: null,
  snapping: {
    enabled: false,
    gridSize: 10,
    snapToEdges: true,
    snapToVertices: true,
    snapThreshold: 8,
  },

  setTool: (tool) => set({ currentTool: tool }),

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5.0, zoom)) }),

  setBrightness: (brightness) =>
    set({ brightness: Math.max(-127, Math.min(127, brightness)) }),

  setContrast: (contrast) =>
    set({ contrast: Math.max(-127, Math.min(127, contrast)) }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  setAutoAdvance: (enabled) => set({ autoAdvance: enabled }),

  setSaturation: (saturation) =>
    set({ saturation: Math.max(0, Math.min(200, saturation)) }),

  setGamma: (gamma) =>
    set({ gamma: Math.max(0.1, Math.min(3.0, gamma)) }),

  setInvert: (invert) => set({ invert }),

  toggleMinimap: () => set((state) => ({ showMinimap: !state.showMinimap })),

  setSnapping: (updates) =>
    set((state) => ({ snapping: { ...state.snapping, ...updates } })),

  toggleSnapping: () =>
    set((state) => ({
      snapping: { ...state.snapping, enabled: !state.snapping.enabled },
    })),

  resetEnhancements: () =>
    set({ brightness: 0, contrast: 0, saturation: 100, gamma: 1.0, invert: false }),

  setActiveClass: (className) => set({ activeClass: className }),
}));
