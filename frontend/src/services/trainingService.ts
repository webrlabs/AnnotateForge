import api from './api';
import {
  TrainingJobCreate,
  TrainingJobResponse,
  TrainingJobDetail,
  TrainingMetric,
  TrainedModel,
  TrainedModelDetail,
  InferenceRequest,
  TaskType,
  TrainingStatus,
} from '@/types/training';

export const trainingAPI = {
  // Training Jobs
  getJobs: async (params?: {
    skip?: number;
    limit?: number;
    status?: TrainingStatus;
    task_type?: TaskType;
  }): Promise<TrainingJobResponse[]> => {
    const response = await api.get<TrainingJobResponse[]>('/training/jobs', { params });
    return response.data;
  },

  createJob: async (data: TrainingJobCreate): Promise<TrainingJobResponse> => {
    const response = await api.post<TrainingJobResponse>('/training/jobs', data);
    return response.data;
  },

  getJob: async (jobId: string): Promise<TrainingJobDetail> => {
    const response = await api.get<TrainingJobDetail>(`/training/jobs/${jobId}`);
    return response.data;
  },

  deleteJob: async (jobId: string): Promise<void> => {
    await api.delete(`/training/jobs/${jobId}`);
  },

  getJobMetrics: async (jobId: string): Promise<TrainingMetric[]> => {
    const response = await api.get<TrainingMetric[]>(`/training/jobs/${jobId}/metrics`);
    return response.data;
  },

  // Trained Models
  getModels: async (params?: {
    skip?: number;
    limit?: number;
    task_type?: TaskType;
    is_active?: boolean;
  }): Promise<TrainedModel[]> => {
    const response = await api.get<TrainedModel[]>('/training/models', { params });
    return response.data;
  },

  getModel: async (modelId: string): Promise<TrainedModelDetail> => {
    const response = await api.get<TrainedModelDetail>(`/training/models/${modelId}`);
    return response.data;
  },

  activateModel: async (modelId: string): Promise<TrainedModel> => {
    const response = await api.patch<TrainedModel>(`/training/models/${modelId}/activate`);
    return response.data;
  },

  deleteModel: async (modelId: string): Promise<void> => {
    await api.delete(`/training/models/${modelId}`);
  },

  downloadModel: async (modelId: string, modelName: string): Promise<void> => {
    const response = await api.get(`/training/models/${modelId}/download`, {
      responseType: 'blob',
    });

    // Create a download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${modelName.replace(/\s+/g, '_')}.pt`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  predict: async (modelId: string, data: InferenceRequest): Promise<any> => {
    const response = await api.post(`/training/models/${modelId}/predict`, data);
    return response.data;
  },
};
