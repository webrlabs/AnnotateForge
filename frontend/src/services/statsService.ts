import api from './api';

export interface ProjectStats {
  total_images: number;
  annotated_images: number;
  unannotated_images: number;
  total_annotations: number;
  annotations_by_type: Record<string, number>;
  annotations_by_source: Record<string, number>;
  annotations_by_class: Record<string, number>;
  avg_annotations_per_image: number;
  annotations_by_annotator: Record<string, number>;
  project_classes: string[];
}

export interface ClassDetail {
  class_label: string;
  annotation_count: number;
  image_count: number;
  avg_confidence: number | null;
  min_confidence: number | null;
  max_confidence: number | null;
}

export interface ClassDistribution {
  classes: ClassDetail[];
  project_classes: string[];
}

export interface TimelineEntry {
  date: string;
  count: number;
}

export interface TimelineData {
  timeline: TimelineEntry[];
  days: number;
}

export interface CoverageData {
  total_images: number;
  annotated_images: number;
  distribution: {
    min: number;
    max: number;
    avg: number;
    median: number;
  };
  buckets: Record<string, number>;
}

export const statsAPI = {
  getProjectStats: async (projectId: string): Promise<ProjectStats> => {
    const response = await api.get<ProjectStats>(`/stats/projects/${projectId}`);
    return response.data;
  },

  getClassDistribution: async (projectId: string): Promise<ClassDistribution> => {
    const response = await api.get<ClassDistribution>(`/stats/projects/${projectId}/classes`);
    return response.data;
  },

  getTimeline: async (projectId: string, days = 30): Promise<TimelineData> => {
    const response = await api.get<TimelineData>(`/stats/projects/${projectId}/timeline`, {
      params: { days },
    });
    return response.data;
  },

  getCoverage: async (projectId: string): Promise<CoverageData> => {
    const response = await api.get<CoverageData>(`/stats/projects/${projectId}/coverage`);
    return response.data;
  },
};
