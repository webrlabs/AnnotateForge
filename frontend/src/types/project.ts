export interface Project {
  id: string;
  name: string;
  description?: string;
  classes: string[];
  created_at: string;
  updated_at: string;
  image_count: number;
  thumbnails: string[];
}

export interface ProjectCreate {
  name: string;
  description?: string;
  classes?: string[];
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  classes?: string[];
}
