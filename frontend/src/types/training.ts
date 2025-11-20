/**
 * Training system types
 */

export type TaskType = 'classify' | 'detect' | 'segment';

export type TrainingStatus = 'pending' | 'preparing' | 'training' | 'completed' | 'failed' | 'cancelled';

// Configuration types
export interface SplitConfig {
  train_ratio: number;
  val_ratio: number;
  random_seed: number;
}

export interface HyperparametersBase {
  model: string;
  epochs: number;
  batch: number;
  imgsz: number;
  lr0: number;
  lrf: number;
  momentum: number;
  weight_decay: number;
  warmup_epochs: number;
  augment: boolean;
  optimizer: string;
  device?: string;
}

export interface ClassificationHyperparameters extends HyperparametersBase {
  dropout: number;
}

export interface DetectionHyperparameters extends HyperparametersBase {
  iou: number;
  conf: number;
}

export interface SegmentationHyperparameters extends HyperparametersBase {
  overlap_mask: boolean;
  mask_ratio: number;
}

export type Hyperparameters = ClassificationHyperparameters | DetectionHyperparameters | SegmentationHyperparameters;

export interface TrainingConfigBase {
  task_type: TaskType;
  projects: string[];
  class_mapping: Record<string, number>;
  split: SplitConfig;
}

export interface ClassificationTrainingConfig extends TrainingConfigBase {
  task_type: 'classify';
  hyperparameters: ClassificationHyperparameters;
}

export interface DetectionTrainingConfig extends TrainingConfigBase {
  task_type: 'detect';
  annotation_types: string[];
  hyperparameters: DetectionHyperparameters;
}

export interface SegmentationTrainingConfig extends TrainingConfigBase {
  task_type: 'segment';
  annotation_types: string[];
  hyperparameters: SegmentationHyperparameters;
}

export type TrainingConfig = ClassificationTrainingConfig | DetectionTrainingConfig | SegmentationTrainingConfig;

// API types
export interface TrainingJobCreate {
  name: string;
  description?: string;
  task_type: TaskType;
  config: Record<string, any>;
}

export interface TrainingJobResponse {
  id: string;
  name: string;
  description?: string;
  task_type: TaskType;
  status: TrainingStatus;
  current_epoch: number;
  total_epochs: number;
  progress_percent: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  created_by: string;
}

export interface TrainingDatasetInfo {
  total_images: number;
  train_images: number;
  val_images: number;
  class_mapping: Record<string, number>;
  annotation_types: string[];
}

export interface TrainingJobDetail extends TrainingJobResponse {
  config: Record<string, any>;
  final_metrics?: Record<string, any>;
  error_message?: string;
  dataset?: TrainingDatasetInfo;
  latest_metrics?: Record<string, any>;
}

export interface TrainingMetric {
  epoch: number;
  train_loss?: number;
  val_loss?: number;
  metrics: Record<string, any>;
  epoch_time_seconds?: number;
  timestamp: string;
}

// Model types
export interface TrainedModel {
  id: string;
  name: string;
  description?: string;
  task_type: TaskType;
  model_type: string;
  image_size: number;
  num_classes: number;
  classes: Record<string, number>;
  performance_metrics: Record<string, any>;
  is_active: boolean;
  created_at: string;
  created_by: string;
}

export interface TrainedModelDetail extends TrainedModel {
  training_job_id: string;
  model_path: string;
}

// WebSocket message types
export interface WSStatusChange {
  type: 'status_change';
  status: TrainingStatus;
  timestamp: string;
}

export interface WSEpochStart {
  type: 'epoch_start';
  epoch: number;
  total_epochs: number;
}

export interface WSEpochComplete {
  type: 'epoch_complete';
  epoch: number;
  metrics: Record<string, any>;
}

export interface WSTrainingComplete {
  type: 'training_complete';
  final_metrics: Record<string, any>;
  model_id: string;
}

export interface WSTrainingFailed {
  type: 'training_failed';
  error: string;
}

export type WSTrainingMessage = WSStatusChange | WSEpochStart | WSEpochComplete | WSTrainingComplete | WSTrainingFailed;

// Inference types
export interface InferenceRequest {
  image_id: string;
  confidence?: number;
  iou?: number;
}
