"""Pydantic schemas for request/response validation"""
from app.schemas.user import UserCreate, UserResponse, UserLogin, Token
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.schemas.image import ImageResponse, ImageUpload
from app.schemas.annotation import AnnotationCreate, AnnotationUpdate, AnnotationResponse
from app.schemas.inference import SimpleBlobParams, YOLOParams, SAM2Prompts, InferenceResponse

__all__ = [
    "UserCreate", "UserResponse", "UserLogin", "Token",
    "ProjectCreate", "ProjectUpdate", "ProjectResponse",
    "ImageResponse", "ImageUpload",
    "AnnotationCreate", "AnnotationUpdate", "AnnotationResponse",
    "SimpleBlobParams", "YOLOParams", "SAM2Prompts", "InferenceResponse"
]
