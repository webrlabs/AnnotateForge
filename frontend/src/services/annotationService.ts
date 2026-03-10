import api from './api';
import { Annotation, AnnotationCreate, AnnotationUpdate } from '@/types';

export const annotationAPI = {
  getByImage: async (imageId: string): Promise<Annotation[]> => {
    const response = await api.get<Annotation[]>(`/annotations/images/${imageId}/annotations`);
    return response.data;
  },

  getById: async (id: string): Promise<Annotation> => {
    const response = await api.get<Annotation>(`/annotations/${id}`);
    return response.data;
  },

  create: async (imageId: string, data: AnnotationCreate): Promise<Annotation> => {
    const response = await api.post<Annotation>(
      `/annotations/images/${imageId}/annotations`,
      data
    );
    return response.data;
  },

  update: async (id: string, data: AnnotationUpdate): Promise<Annotation> => {
    const response = await api.put<Annotation>(`/annotations/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/annotations/${id}`);
  },

  batchUpdate: async (annotationIds: string[], updates: AnnotationUpdate): Promise<Annotation[]> => {
    const response = await api.put<Annotation[]>('/annotations/batch', {
      annotation_ids: annotationIds,
      updates,
    });
    return response.data;
  },

  batchDelete: async (annotationIds: string[]): Promise<void> => {
    await api.delete('/annotations/batch', {
      data: { annotation_ids: annotationIds },
    });
  },
};
