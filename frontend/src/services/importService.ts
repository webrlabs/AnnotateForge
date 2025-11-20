import api from './api';

export type ImportFormat = 'yolo_detection' | 'yolo_segmentation' | 'coco';

export interface ImportResult {
  status: string;
  imported_images: number;
  imported_annotations: number;
  classes: string[];
  new_classes: string[];
  failed_images?: string[];
}

export const importAPI = {
  importDataset: async (
    projectId: string,
    file: File,
    format: ImportFormat
  ): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);

    const response = await api.post<ImportResult>(
      `/import/projects/${projectId}/dataset`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  },
};
