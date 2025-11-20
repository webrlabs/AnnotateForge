"""Inference schemas"""
from pydantic import BaseModel, Field
from uuid import UUID
from typing import List, Optional, Dict, Any


class SimpleBlobParams(BaseModel):
    """Parameters for SimpleBlob detection"""
    image_id: UUID
    params: Dict[str, Any] = Field(
        default_factory=lambda: {
            "min_threshold": 40,
            "max_threshold": 255,
            "min_area": 100,
            "max_area": 1000,
            "filter_by_circularity": True
        }
    )


class YOLOParams(BaseModel):
    """Parameters for YOLO inference"""
    image_id: UUID
    model: str = "yolov8n.pt"
    model_id: Optional[UUID] = None  # ID of trained model to use
    confidence: float = Field(0.5, ge=0.0, le=1.0)


class SAM2Prompts(BaseModel):
    """Prompts for SAM2 segmentation"""
    image_id: UUID
    prompts: Dict[str, Any] = Field(
        ...,
        description="SAM2 prompts with points, labels, and optionally boxes"
    )
    multimask_output: bool = Field(
        True,
        description="If true, returns 3 masks with different quality scores"
    )


class InferenceResponse(BaseModel):
    """Response from inference"""
    annotations: List[Dict[str, Any]]
    inference_time: Optional[float] = None
    cached: bool = False
