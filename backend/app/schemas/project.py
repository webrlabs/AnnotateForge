"""Project schemas"""
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from enum import Enum


class MemberRole(str, Enum):
    """Role for project members"""
    VIEWER = "viewer"
    EDITOR = "editor"


class ProjectCreate(BaseModel):
    """Schema for creating a project"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    classes: List[str] = Field(default_factory=list)
    is_public: bool = False


class ProjectUpdate(BaseModel):
    """Schema for updating a project"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    classes: Optional[List[str]] = None
    is_public: Optional[bool] = None


class ProjectMemberResponse(BaseModel):
    """Schema for project member response"""
    id: UUID
    user_id: UUID
    username: str
    email: str
    role: MemberRole
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectResponse(BaseModel):
    """Schema for project response"""
    id: UUID
    name: str
    description: Optional[str]
    classes: List[str] = []
    owner_id: Optional[UUID] = None
    is_public: bool = False
    created_at: datetime
    updated_at: datetime
    image_count: int = 0
    thumbnails: List[str] = []
    # Permission info for current user
    can_edit: bool = False
    can_manage_members: bool = False
    member_count: int = 0

    class Config:
        from_attributes = True


class ProjectMemberCreate(BaseModel):
    """Schema for adding a member to a project"""
    user_id: Optional[UUID] = None
    email: Optional[str] = None
    role: MemberRole = MemberRole.VIEWER

    @classmethod
    def validate_user_identifier(cls, values):
        """Ensure either user_id or email is provided"""
        if not values.get('user_id') and not values.get('email'):
            raise ValueError('Either user_id or email must be provided')
        return values


class ProjectMemberUpdate(BaseModel):
    """Schema for updating a member's role"""
    role: MemberRole
