"""Schemas for dataset versioning and split management"""
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, List, Any


# --- Dataset Version Schemas ---

class DatasetVersionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    split_config: Optional[Dict[str, float]] = None


class DatasetVersionResponse(BaseModel):
    id: UUID
    project_id: UUID
    version_number: int
    name: str
    description: Optional[str]
    image_count: int
    annotation_count: int
    class_counts: Dict[str, int]
    split_config: Optional[Dict[str, Any]]
    parent_version_id: Optional[UUID]
    created_by: Optional[UUID]
    created_at: datetime

    class Config:
        from_attributes = True


class VersionDiffResponse(BaseModel):
    version_a: DatasetVersionResponse
    version_b: DatasetVersionResponse
    images_added: int
    images_removed: int
    annotations_added: int
    annotations_removed: int
    class_changes: Dict[str, Dict[str, int]]  # {class: {a: count, b: count}}


# --- Dataset Split Schemas ---

class SplitConfigUpdate(BaseModel):
    train_ratio: float = Field(0.7, ge=0.0, le=1.0)
    val_ratio: float = Field(0.15, ge=0.0, le=1.0)
    test_ratio: float = Field(0.15, ge=0.0, le=1.0)
    random_seed: int = Field(42)
    stratify_by_class: bool = Field(True)


class SplitAssignment(BaseModel):
    image_id: UUID
    split: str  # train, val, test


class SplitResponse(BaseModel):
    id: UUID
    project_id: UUID
    train_ratio: float
    val_ratio: float
    test_ratio: float
    random_seed: int
    stratify_by_class: bool
    assignments: Dict[str, str]  # {image_id: split}
    updated_at: Optional[datetime]
    summary: Optional[Dict[str, int]] = None  # {train: N, val: N, test: N}

    class Config:
        from_attributes = True


class SplitPreviewResponse(BaseModel):
    train_count: int
    val_count: int
    test_count: int
    per_class: Dict[str, Dict[str, int]]  # {class: {train: N, val: N, test: N}}


# --- Duplicate Detection Schemas ---

class DuplicateGroup(BaseModel):
    images: List[Dict[str, Any]]  # [{id, filename, thumbnail_path, phash}]
    similarity: float


class DuplicateResponse(BaseModel):
    total_groups: int
    total_duplicates: int
    groups: List[DuplicateGroup]


class DuplicateDeleteRequest(BaseModel):
    image_ids: List[UUID]
