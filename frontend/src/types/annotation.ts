export type AnnotationType = 'circle' | 'box' | 'rectangle' | 'polygon';
export type AnnotationSource = 'manual' | 'simpleblob' | 'yolo' | 'sam2';

export interface CircleData {
  x: number;
  y: number;
  size: number;
}

export interface BoxData {
  corners: [number, number][];  // Array of [x, y] points
}

export interface PolygonData {
  points: [number, number][];  // Array of [x, y] points
}

export type AnnotationData = CircleData | BoxData | PolygonData;

export interface Annotation {
  id: string;
  image_id: string;
  type: AnnotationType;
  data: any;  // Will be one of the specific data types
  confidence?: number;
  source: AnnotationSource;
  class_label?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AnnotationCreate {
  type: AnnotationType;
  data: any;
  confidence?: number;
  source?: AnnotationSource;
  class_label?: string;
}

export interface AnnotationUpdate {
  data?: any;
  class_label?: string;
  confidence?: number;
}
