export interface Image {
  id: string;
  project_id: string;
  filename: string;
  original_path: string;
  thumbnail_path?: string;
  width: number;
  height: number;
  file_size?: number;
  format?: string;
  image_class?: string;
  uploaded_by?: string;
  created_at: string;
  metadata: Record<string, any>;
  annotation_count: number;
  annotation_classes: string[];
}

export interface ImageUpload {
  project_id: string;
  file: File;
}

export interface ImageUpdate {
  image_class?: string | null;
}
