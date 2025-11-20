import api from './api';
import { InferenceParams, SAM2Prompts, InferenceResponse } from '@/types';

interface SimpleBlobParams {
  min_threshold: number;
  max_threshold: number;
  min_area: number;
  max_area: number;
  filter_by_circularity: boolean;
}

export const inferenceAPI = {
  simpleBlob: async (params: InferenceParams & { params?: SimpleBlobParams }): Promise<InferenceResponse> => {
    const response = await api.post<InferenceResponse>('/inference/simpleblob', params);
    return response.data;
  },

  yolo: async (params: InferenceParams & { confidence?: number; model_id?: string }): Promise<InferenceResponse> => {
    const response = await api.post<InferenceResponse>('/inference/yolo', {
      image_id: params.image_id,
      model: 'yolov8n.pt',
      model_id: params.model_id || null,
      confidence: params.confidence || 0.5,
    });
    return response.data;
  },

  sam2: async (prompts: SAM2Prompts & { multimask_output?: boolean }): Promise<InferenceResponse> => {
    const response = await api.post<InferenceResponse>('/inference/sam2', prompts);
    return response.data;
  },
};
