"""Annotation template schemas"""
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any


class TemplateCreate(BaseModel):
    """Schema for creating an annotation template"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    annotations: List[Dict[str, Any]]


class TemplateUpdate(BaseModel):
    """Schema for updating an annotation template"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    annotations: Optional[List[Dict[str, Any]]] = None


class TemplateResponse(BaseModel):
    """Schema for annotation template response"""
    id: UUID
    project_id: UUID
    name: str
    description: Optional[str]
    annotations: List[Dict[str, Any]]
    created_by: Optional[UUID]
    created_at: datetime

    class Config:
        from_attributes = True
