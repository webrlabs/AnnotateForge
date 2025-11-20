export interface APIError {
  detail: string;
}

export interface InferenceParams {
  image_id: string;
  params?: Record<string, any>;
}

export interface SAM2Prompts {
  image_id: string;
  prompts: {
    points?: [number, number][];
    labels?: number[];
    boxes?: [number, number, number, number][];
  };
}

export interface InferenceResponse {
  annotations: any[];
  inference_time?: number;
}

export type ToolType =
  | 'select'
  | 'circle'
  | 'box'
  | 'rectangle'
  | 'polygon'
  | 'sam2'
  | 'yolo'
  | 'simpleblob';
