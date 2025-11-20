"""
Application configuration
"""
from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings"""

    # Application
    PROJECT_NAME: str = "LabelFlow"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "info"

    # Security
    SECRET_KEY: str = "changeme-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Database
    DATABASE_URL: str = "postgresql://labelflow:changeme@localhost:5432/labelflow"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 40

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Storage
    UPLOAD_DIR: str = "/app/storage"
    MAX_UPLOAD_SIZE: int = 104857600  # 100MB in bytes

    # ML Models
    YOLO_MODEL: str = "yolov8n.pt"
    SAM2_MODEL: str = "sam2.1_b.pt"
    MODEL_CACHE_DIR: str = "/app/models"

    # Performance
    WORKER_COUNT: int = 4
    INFERENCE_TIMEOUT: int = 30

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost"

    def get_cors_origins_list(self) -> List[str]:
        """Get CORS origins as a list"""
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        return [origin.strip() for origin in self.CORS_ORIGINS.split(',')]

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
