"""Training system Pydantic schemas"""
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, List, Any, Literal
from datetime import datetime
from uuid import UUID


# ===== Training Configuration Schemas =====

class SplitConfig(BaseModel):
    """Train/validation split configuration"""
    train_ratio: float = Field(0.8, ge=0.0, le=1.0)
    val_ratio: float = Field(0.2, ge=0.0, le=1.0)
    random_seed: int = Field(42, ge=0)

    @validator('val_ratio')
    def validate_ratios(cls, v, values):
        if 'train_ratio' in values:
            if abs(values['train_ratio'] + v - 1.0) > 0.01:
                raise ValueError('train_ratio + val_ratio must equal 1.0')
        return v


class HyperparametersBase(BaseModel):
    """Base hyperparameters common to all task types"""
    model: str = "yolov8n.pt"
    epochs: int = Field(100, ge=1)
    batch: int = Field(16, ge=1)
    imgsz: int = Field(640, ge=32)
    lr0: float = Field(0.01, gt=0.0)
    lrf: float = Field(0.01, gt=0.0)
    momentum: float = Field(0.937, ge=0.0, le=1.0)
    weight_decay: float = Field(0.0005, ge=0.0)
    warmup_epochs: int = Field(3, ge=0)
    augment: bool = True
    optimizer: str = "auto"
    device: Optional[str] = None


class ClassificationHyperparameters(HyperparametersBase):
    """Classification-specific hyperparameters"""
    dropout: float = Field(0.0, ge=0.0, le=1.0)


class DetectionHyperparameters(HyperparametersBase):
    """Detection-specific hyperparameters"""
    iou: float = Field(0.7, ge=0.0, le=1.0)
    conf: float = Field(0.001, ge=0.0, le=1.0)


class SegmentationHyperparameters(HyperparametersBase):
    """Segmentation-specific hyperparameters"""
    overlap_mask: bool = True
    mask_ratio: int = Field(4, ge=1)


class TrainingConfigBase(BaseModel):
    """Base training configuration"""
    task_type: Literal["classify", "detect", "segment"]
    projects: List[UUID] = Field(..., min_items=1)
    class_mapping: Dict[str, int] = Field(..., min_items=1)
    split: SplitConfig = SplitConfig()


class ClassificationTrainingConfig(TrainingConfigBase):
    """Classification training configuration"""
    task_type: Literal["classify"] = "classify"
    hyperparameters: ClassificationHyperparameters = ClassificationHyperparameters()


class DetectionTrainingConfig(TrainingConfigBase):
    """Detection training configuration"""
    task_type: Literal["detect"] = "detect"
    annotation_types: List[str] = Field(..., min_items=1)
    hyperparameters: DetectionHyperparameters = DetectionHyperparameters()


class SegmentationTrainingConfig(TrainingConfigBase):
    """Segmentation training configuration"""
    task_type: Literal["segment"] = "segment"
    annotation_types: List[str] = Field(..., min_items=1)
    hyperparameters: SegmentationHyperparameters = SegmentationHyperparameters()


# Union type for all configs
TrainingConfig = ClassificationTrainingConfig | DetectionTrainingConfig | SegmentationTrainingConfig


# ===== Training Job Schemas =====

class TrainingJobCreate(BaseModel):
    """Create training job request"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    task_type: Literal["classify", "detect", "segment"]
    config: Dict[str, Any]  # Will be validated based on task_type


class TrainingJobResponse(BaseModel):
    """Training job response"""
    id: UUID
    name: str
    description: Optional[str]
    task_type: str
    status: str
    current_epoch: int
    total_epochs: int
    progress_percent: float
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_by: UUID

    class Config:
        from_attributes = True


class TrainingJobDetail(TrainingJobResponse):
    """Training job detailed response"""
    config: Dict[str, Any]
    final_metrics: Optional[Dict[str, Any]]
    error_message: Optional[str]
    dataset: Optional[Dict[str, Any]]
    latest_metrics: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True


# ===== Training Metrics Schemas =====

class TrainingMetricResponse(BaseModel):
    """Training metric response"""
    epoch: int
    train_loss: Optional[float]
    val_loss: Optional[float]
    metrics: Dict[str, Any]
    epoch_time_seconds: Optional[float]
    timestamp: datetime

    class Config:
        from_attributes = True


# ===== Trained Model Schemas =====

class TrainedModelResponse(BaseModel):
    """Trained model response"""
    id: UUID
    name: str
    description: Optional[str]
    task_type: str
    model_type: str
    image_size: int
    num_classes: int
    classes: Dict[str, Any]
    performance_metrics: Dict[str, Any]
    is_active: bool
    created_at: datetime
    created_by: UUID

    class Config:
        from_attributes = True


class TrainedModelDetail(TrainedModelResponse):
    """Trained model detailed response"""
    training_job_id: UUID
    model_path: str

    class Config:
        from_attributes = True


# ===== Inference Schemas =====

class InferenceRequest(BaseModel):
    """Inference request"""
    image_id: UUID
    confidence: Optional[float] = Field(0.5, ge=0.0, le=1.0)
    iou: Optional[float] = Field(0.45, ge=0.0, le=1.0)


class ClassificationPrediction(BaseModel):
    """Classification prediction"""
    class_id: int
    class_label: str
    confidence: float


class ClassificationInferenceResponse(BaseModel):
    """Classification inference response"""
    task_type: Literal["classify"] = "classify"
    predictions: List[ClassificationPrediction]
    top1_class: str
    top1_confidence: float
    model_name: str
    inference_time_ms: float


class DetectionAnnotation(BaseModel):
    """Detection annotation"""
    type: Literal["box"] = "box"
    data: Dict[str, Any]
    confidence: float
    source: str = "custom_model"
    class_label: str
    class_id: int


class DetectionInferenceResponse(BaseModel):
    """Detection inference response"""
    task_type: Literal["detect"] = "detect"
    annotations: List[DetectionAnnotation]
    model_name: str
    inference_time_ms: float


class SegmentationAnnotation(BaseModel):
    """Segmentation annotation"""
    type: Literal["polygon"] = "polygon"
    data: Dict[str, Any]
    bbox: Dict[str, Any]
    confidence: float
    source: str = "custom_model"
    class_label: str
    class_id: int


class SegmentationInferenceResponse(BaseModel):
    """Segmentation inference response"""
    task_type: Literal["segment"] = "segment"
    annotations: List[SegmentationAnnotation]
    model_name: str
    inference_time_ms: float


# Union type for inference responses
InferenceResponse = ClassificationInferenceResponse | DetectionInferenceResponse | SegmentationInferenceResponse


# ===== WebSocket Messages =====

class WSStatusChange(BaseModel):
    """WebSocket status change message"""
    type: Literal["status_change"] = "status_change"
    status: str
    timestamp: datetime


class WSEpochStart(BaseModel):
    """WebSocket epoch start message"""
    type: Literal["epoch_start"] = "epoch_start"
    epoch: int
    total_epochs: int


class WSEpochComplete(BaseModel):
    """WebSocket epoch complete message"""
    type: Literal["epoch_complete"] = "epoch_complete"
    epoch: int
    metrics: Dict[str, Any]


class WSTrainingComplete(BaseModel):
    """WebSocket training complete message"""
    type: Literal["training_complete"] = "training_complete"
    final_metrics: Dict[str, Any]
    model_id: UUID


class WSTrainingFailed(BaseModel):
    """WebSocket training failed message"""
    type: Literal["training_failed"] = "training_failed"
    error: str
