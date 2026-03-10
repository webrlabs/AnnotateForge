import api from './api';

// --- Dataset Versions ---

export interface DatasetVersion {
  id: string;
  project_id: string;
  version_number: number;
  name: string;
  description: string | null;
  image_count: number;
  annotation_count: number;
  class_counts: Record<string, number>;
  split_config: Record<string, any> | null;
  parent_version_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface VersionDiff {
  version_a: DatasetVersion;
  version_b: DatasetVersion;
  images_added: number;
  images_removed: number;
  annotations_added: number;
  annotations_removed: number;
  class_changes: Record<string, { a: number; b: number }>;
}

// --- Splits ---

export interface SplitConfig {
  train_ratio: number;
  val_ratio: number;
  test_ratio: number;
  random_seed: number;
  stratify_by_class: boolean;
}

export interface SplitResponse {
  id: string;
  project_id: string;
  train_ratio: number;
  val_ratio: number;
  test_ratio: number;
  random_seed: number;
  stratify_by_class: boolean;
  assignments: Record<string, string>;
  updated_at: string | null;
  summary: { train: number; val: number; test: number } | null;
}

export interface SplitPreview {
  train_count: number;
  val_count: number;
  test_count: number;
  per_class: Record<string, { train: number; val: number; test: number }>;
}

// --- Duplicates ---

export interface DuplicateImage {
  id: string;
  filename: string;
  thumbnail_path: string;
  phash: string | null;
  width: number;
  height: number;
}

export interface DuplicateGroup {
  images: DuplicateImage[];
  similarity: number;
}

export interface DuplicateResponse {
  total_groups: number;
  total_duplicates: number;
  groups: DuplicateGroup[];
}

export const datasetAPI = {
  // Versions
  listVersions: async (projectId: string): Promise<DatasetVersion[]> => {
    const response = await api.get<DatasetVersion[]>(`/datasets/versions/${projectId}`);
    return response.data;
  },

  createVersion: async (projectId: string, data: { name: string; description?: string }): Promise<DatasetVersion> => {
    const response = await api.post<DatasetVersion>(`/datasets/versions/${projectId}`, data);
    return response.data;
  },

  deleteVersion: async (projectId: string, versionId: string): Promise<void> => {
    await api.delete(`/datasets/versions/${projectId}/${versionId}`);
  },

  diffVersions: async (projectId: string, versionAId: string, versionBId: string): Promise<VersionDiff> => {
    const response = await api.get<VersionDiff>(`/datasets/versions/${projectId}/${versionAId}/diff/${versionBId}`);
    return response.data;
  },

  // Splits
  getSplit: async (projectId: string): Promise<SplitResponse> => {
    const response = await api.get<SplitResponse>(`/datasets/splits/${projectId}`);
    return response.data;
  },

  updateSplit: async (projectId: string, config: SplitConfig): Promise<SplitResponse> => {
    const response = await api.put<SplitResponse>(`/datasets/splits/${projectId}`, config);
    return response.data;
  },

  reshuffleSplit: async (projectId: string): Promise<SplitResponse> => {
    const response = await api.post<SplitResponse>(`/datasets/splits/${projectId}/reshuffle`);
    return response.data;
  },

  previewSplit: async (projectId: string, config: SplitConfig): Promise<SplitPreview> => {
    const response = await api.get<SplitPreview>(`/datasets/splits/${projectId}/preview`, {
      params: {
        train_ratio: config.train_ratio,
        val_ratio: config.val_ratio,
        test_ratio: config.test_ratio,
        seed: config.random_seed,
        stratify: config.stratify_by_class,
      },
    });
    return response.data;
  },

  // Duplicates
  findDuplicates: async (projectId: string, threshold = 10): Promise<DuplicateResponse> => {
    const response = await api.post<DuplicateResponse>(`/datasets/duplicates/${projectId}`, null, {
      params: { threshold },
    });
    return response.data;
  },

  deleteDuplicates: async (projectId: string, imageIds: string[]): Promise<{ deleted: number }> => {
    const response = await api.delete<{ deleted: number }>(`/datasets/duplicates/${projectId}`, {
      data: { image_ids: imageIds },
    });
    return response.data;
  },
};
