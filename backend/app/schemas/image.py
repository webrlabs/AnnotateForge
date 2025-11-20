"""Image schemas"""
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any, List


class ImageUpload(BaseModel):
    """Schema for image upload"""
    project_id: UUID


class ImageUpdate(BaseModel):
    """Schema for image update"""
    image_class: Optional[str] = None


class ImageResponse(BaseModel):
    """Schema for image response"""
    id: UUID
    project_id: UUID
    filename: str
    original_path: str
    thumbnail_path: Optional[str]
    width: int
    height: int
    file_size: Optional[int]
    format: Optional[str]
    image_class: Optional[str] = None
    uploaded_by: Optional[UUID]
    created_at: datetime
    metadata: Dict[str, Any] = {}
    annotation_count: int = 0
    annotation_classes: List[str] = []

    class Config:
        from_attributes = True
