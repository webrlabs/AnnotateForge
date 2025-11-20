"""Project schemas"""
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List


class ProjectCreate(BaseModel):
    """Schema for creating a project"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    classes: List[str] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    """Schema for updating a project"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    classes: Optional[List[str]] = None


class ProjectResponse(BaseModel):
    """Schema for project response"""
    id: UUID
    name: str
    description: Optional[str]
    classes: List[str] = []
    created_at: datetime
    updated_at: datetime
    image_count: int = 0
    thumbnails: List[str] = []

    class Config:
        from_attributes = True
