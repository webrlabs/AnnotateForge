"""Annotation schemas"""
from pydantic import BaseModel, Field, field_validator
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any, Literal


class AnnotationCreate(BaseModel):
    """Schema for creating an annotation"""
    type: Literal["circle", "box", "rectangle", "polygon"]
    data: Dict[str, Any]
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    source: Literal["manual", "simpleblob", "yolo", "sam2"] = "manual"
    class_label: Optional[str] = None

    @field_validator("data")
    @classmethod
    def validate_data(cls, v, info):
        """Validate annotation data based on type"""
        annotation_type = info.data.get("type")

        if annotation_type == "circle":
            required = ["x", "y", "size"]
            if not all(k in v for k in required):
                raise ValueError(f"Circle requires: {required}")
        elif annotation_type in ["box", "rectangle"]:
            if "corners" not in v or len(v["corners"]) != 4:
                raise ValueError("Box/rectangle requires 4 corners")
        elif annotation_type == "polygon":
            if "points" not in v or len(v["points"]) < 3:
                raise ValueError("Polygon requires at least 3 points")

        return v


class AnnotationUpdate(BaseModel):
    """Schema for updating an annotation"""
    data: Optional[Dict[str, Any]] = None
    class_label: Optional[str] = None
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)


class AnnotationResponse(BaseModel):
    """Schema for annotation response"""
    id: UUID
    image_id: UUID
    type: str
    data: Dict[str, Any]
    confidence: Optional[float]
    source: str
    class_label: Optional[str]
    created_by: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
