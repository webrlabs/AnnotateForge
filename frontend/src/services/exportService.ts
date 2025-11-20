import api from './api';

export type ExportFormat = 'detection' | 'segmentation' | 'classification' | 'coco';

export const exportAPI = {
  exportYOLO: async (projectId: string, format: ExportFormat): Promise<Blob> => {
    const response = await api.get(`/export/projects/${projectId}/yolo`, {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  },

  exportCOCO: async (projectId: string): Promise<Blob> => {
    const response = await api.get(`/export/projects/${projectId}/coco`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
