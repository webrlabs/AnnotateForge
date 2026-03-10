import api from './api';

export interface AnnotationTemplate {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  annotations: Array<Record<string, any>>;
  created_by: string | null;
  created_at: string;
}

export interface TemplateCreate {
  name: string;
  description?: string;
  annotations: Array<Record<string, any>>;
}

export interface TemplateUpdate {
  name?: string;
  description?: string;
  annotations?: Array<Record<string, any>>;
}

export const templateAPI = {
  getByProject: async (projectId: string): Promise<AnnotationTemplate[]> => {
    const response = await api.get<AnnotationTemplate[]>(`/templates/projects/${projectId}/templates`);
    return response.data;
  },

  getById: async (id: string): Promise<AnnotationTemplate> => {
    const response = await api.get<AnnotationTemplate>(`/templates/${id}`);
    return response.data;
  },

  create: async (projectId: string, data: TemplateCreate): Promise<AnnotationTemplate> => {
    const response = await api.post<AnnotationTemplate>(`/templates/projects/${projectId}/templates`, data);
    return response.data;
  },

  update: async (id: string, data: TemplateUpdate): Promise<AnnotationTemplate> => {
    const response = await api.put<AnnotationTemplate>(`/templates/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/templates/${id}`);
  },
};
