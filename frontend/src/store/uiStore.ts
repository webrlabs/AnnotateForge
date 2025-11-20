import { create } from 'zustand';
import { ToolType } from '@/types';

interface UIStore {
  currentTool: ToolType;
  zoom: number;
  brightness: number;
  contrast: number;
  isLoading: boolean;
  error: string | null;
  setTool: (tool: ToolType) => void;
  setZoom: (zoom: number) => void;
  setBrightness: (brightness: number) => void;
  setContrast: (contrast: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useUIStore = create<UIStore>(set => ({
  currentTool: 'select',
  zoom: 1.0,
  brightness: 0,
  contrast: 0,
  isLoading: false,
  error: null,

  setTool: tool =>
    set({
      currentTool: tool,
    }),

  setZoom: zoom =>
    set({
      zoom: Math.max(0.1, Math.min(5.0, zoom)),
    }),

  setBrightness: brightness =>
    set({
      brightness: Math.max(-127, Math.min(127, brightness)),
    }),

  setContrast: contrast =>
    set({
      contrast: Math.max(-127, Math.min(127, contrast)),
    }),

  setLoading: loading =>
    set({
      isLoading: loading,
    }),

  setError: error =>
    set({
      error,
    }),
}));
