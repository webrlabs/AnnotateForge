import api from './api';
import { Image, ImageUpdate } from '@/types';

export const imageAPI = {
  getByProject: async (projectId: string): Promise<Image[]> => {
    const response = await api.get<Image[]>(`/images/projects/${projectId}/images`);
    return response.data;
  },

  getById: async (id: string): Promise<Image> => {
    const response = await api.get<Image>(`/images/${id}`);
    return response.data;
  },

  upload: async (projectId: string, file: File): Promise<Image> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<Image>(`/images/projects/${projectId}/images`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  update: async (id: string, data: ImageUpdate): Promise<Image> => {
    const response = await api.put<Image>(`/images/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/images/${id}`);
  },
};
