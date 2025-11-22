import api from './api';
import { Project, ProjectCreate, ProjectUpdate, ProjectMember, ProjectMemberCreate, ProjectMemberUpdate } from '@/types';

export const projectAPI = {
  getAll: async (): Promise<Project[]> => {
    const response = await api.get<Project[]>('/projects');
    return response.data;
  },

  getById: async (id: string): Promise<Project> => {
    const response = await api.get<Project>(`/projects/${id}`);
    return response.data;
  },

  create: async (data: ProjectCreate): Promise<Project> => {
    const response = await api.post<Project>('/projects', data);
    return response.data;
  },

  update: async (id: string, data: ProjectUpdate): Promise<Project> => {
    const response = await api.put<Project>(`/projects/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}`);
  },

  // Member management
  getMembers: async (projectId: string): Promise<ProjectMember[]> => {
    const response = await api.get<ProjectMember[]>(`/projects/${projectId}/members`);
    return response.data;
  },

  addMember: async (projectId: string, data: ProjectMemberCreate): Promise<ProjectMember> => {
    const response = await api.post<ProjectMember>(`/projects/${projectId}/members`, data);
    return response.data;
  },

  updateMember: async (projectId: string, memberId: string, data: ProjectMemberUpdate): Promise<ProjectMember> => {
    const response = await api.put<ProjectMember>(`/projects/${projectId}/members/${memberId}`, data);
    return response.data;
  },

  removeMember: async (projectId: string, memberId: string): Promise<void> => {
    await api.delete(`/projects/${projectId}/members/${memberId}`);
  },
};
