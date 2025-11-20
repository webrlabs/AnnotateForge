"""
Health check endpoints for monitoring
"""
from fastapi import APIRouter, status, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Dict, Any

from app.core.database import get_db
from app.core.redis_client import redis_cache
from app.core.config import settings

router = APIRouter(prefix="/health", tags=["health"])


class HealthResponse(BaseModel):
    """Health check response model"""
    status: str
    database: str
    redis: str
    version: str = "1.0.0"


class DetailedHealthResponse(BaseModel):
    """Detailed health check response"""
    status: str
    services: Dict[str, Dict[str, Any]]
    version: str = "1.0.0"


@router.get("", response_model=HealthResponse, status_code=status.HTTP_200_OK)
def health_check_simple():
    """
    Simple health check endpoint (no dependencies)

    Returns:
        Basic health status
    """
    return HealthResponse(
        status="ok",
        database="unknown",
        redis="unknown"
    )


@router.get("/ready", response_model=HealthResponse, status_code=status.HTTP_200_OK)
def health_check_ready(db: Session = Depends(get_db)):
    """
    Readiness check - checks if app is ready to serve requests

    Checks:
    - Database connectivity
    - Redis connectivity

    Args:
        db: Database session

    Returns:
        Health status with service checks
    """
    # Check database
    db_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"error: {str(e)[:100]}"

    # Check Redis
    redis_status = "ok" if redis_cache.health_check() else "error"

    # Overall status
    overall_status = "ok" if db_status == "ok" and redis_status == "ok" else "degraded"

    return HealthResponse(
        status=overall_status,
        database=db_status,
        redis=redis_status
    )


@router.get("/live", status_code=status.HTTP_200_OK)
def health_check_live():
    """
    Liveness check - checks if app is alive

    Simple check that returns 200 if the service is running.
    Used by Kubernetes/Docker to detect if container needs restart.

    Returns:
        Simple OK response
    """
    return {"status": "ok"}


@router.get("/detailed", response_model=DetailedHealthResponse, status_code=status.HTTP_200_OK)
def health_check_detailed(db: Session = Depends(get_db)):
    """
    Detailed health check with service details

    Provides comprehensive health information about all services.

    Args:
        db: Database session

    Returns:
        Detailed health information
    """
    services = {}

    # Check database
    try:
        db.execute(text("SELECT 1"))
        db_version = db.execute(text("SELECT version()")).scalar()
        services["database"] = {
            "status": "ok",
            "type": "postgresql",
            "version": str(db_version)[:50] if db_version else "unknown"
        }
    except Exception as e:
        services["database"] = {
            "status": "error",
            "error": str(e)[:200]
        }

    # Check Redis
    try:
        if redis_cache.health_check():
            # Get Redis info
            info = redis_cache.client.info()
            services["redis"] = {
                "status": "ok",
                "version": info.get("redis_version", "unknown"),
                "uptime_days": info.get("uptime_in_days", 0)
            }
        else:
            services["redis"] = {
                "status": "error",
                "error": "Connection failed"
            }
    except Exception as e:
        services["redis"] = {
            "status": "error",
            "error": str(e)[:200]
        }

    # Check storage
    import os
    try:
        storage_path = settings.UPLOAD_DIR
        if os.path.exists(storage_path) and os.access(storage_path, os.W_OK):
            services["storage"] = {
                "status": "ok",
                "path": storage_path,
                "writable": True
            }
        else:
            services["storage"] = {
                "status": "error",
                "error": "Storage path not accessible"
            }
    except Exception as e:
        services["storage"] = {
            "status": "error",
            "error": str(e)[:200]
        }

    # Overall status
    all_ok = all(s.get("status") == "ok" for s in services.values())
    overall_status = "ok" if all_ok else "degraded"

    return DetailedHealthResponse(
        status=overall_status,
        services=services
    )
