import api from './api';

export interface LockInfo {
  image_id: string;
  locked_by: string;
  locked_by_username: string;
  locked_at: string;
  expires_at: string;
}

export interface LockAcquireResponse {
  success: boolean;
  message: string;
  lock: LockInfo | null;
}

export const lockAPI = {
  acquire: async (imageId: string): Promise<LockAcquireResponse> => {
    const response = await api.post<LockAcquireResponse>(`/locks/images/${imageId}/acquire`);
    return response.data;
  },

  release: async (imageId: string, force = false): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>(`/locks/images/${imageId}/release`, null, {
      params: { force },
    });
    return response.data;
  },

  refresh: async (imageId: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>(`/locks/images/${imageId}/refresh`);
    return response.data;
  },

  get: async (imageId: string): Promise<LockInfo | null> => {
    const response = await api.get<LockInfo | null>(`/locks/images/${imageId}`);
    return response.data;
  },
};
