"""Image lock routes"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.lock_service import LockService
from app.services.connection_manager import manager

router = APIRouter(prefix="/locks", tags=["locks"])


class LockResponse(BaseModel):
    """Lock response schema"""
    image_id: str
    locked_by: str
    locked_by_username: str
    locked_at: datetime
    expires_at: datetime

    class Config:
        from_attributes = True


class LockAcquireResponse(BaseModel):
    """Response for lock acquisition"""
    success: bool
    message: str
    lock: Optional[LockResponse] = None


@router.post("/images/{image_id}/acquire", response_model=LockAcquireResponse)
async def acquire_lock(
    image_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Acquire a lock on an image

    Args:
        image_id: Image UUID
        db: Database session
        current_user: Current authenticated user

    Returns:
        Lock acquisition result
    """
    success, lock, error = LockService.acquire_lock(db, image_id, current_user)

    if not success:
        return LockAcquireResponse(
            success=False,
            message=error or "Failed to acquire lock",
            lock=None
        )

    # Get username for response
    lock_response = LockResponse(
        image_id=str(lock.image_id),
        locked_by=str(lock.locked_by),
        locked_by_username=current_user.username,
        locked_at=lock.locked_at,
        expires_at=lock.expires_at
    )

    # Broadcast lock acquired to other users viewing this image
    await manager.broadcast_to_image(
        str(image_id),
        {
            "type": "image_locked",
            "image_id": str(image_id),
            "locked_by": str(current_user.id),
            "username": current_user.username,
            "expires_at": lock.expires_at.isoformat()
        }
    )

    return LockAcquireResponse(
        success=True,
        message="Lock acquired successfully",
        lock=lock_response
    )


@router.post("/images/{image_id}/release")
async def release_lock(
    image_id: UUID,
    force: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Release a lock on an image

    Args:
        image_id: Image UUID
        force: Force unlock (admin only)
        db: Database session
        current_user: Current authenticated user

    Returns:
        Success message
    """
    success, error = LockService.release_lock(db, image_id, current_user, force=force)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error or "Failed to release lock"
        )

    # Broadcast lock released to other users viewing this image
    await manager.broadcast_to_image(
        str(image_id),
        {
            "type": "image_unlocked",
            "image_id": str(image_id),
            "unlocked_by": str(current_user.id),
            "username": current_user.username
        }
    )

    return {"message": "Lock released successfully"}


@router.post("/images/{image_id}/refresh")
async def refresh_lock(
    image_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Refresh/extend an existing lock

    Args:
        image_id: Image UUID
        db: Database session
        current_user: Current authenticated user

    Returns:
        Success message
    """
    success, error = LockService.refresh_lock(db, image_id, current_user)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error or "Failed to refresh lock"
        )

    return {"message": "Lock refreshed successfully"}


@router.get("/images/{image_id}", response_model=Optional[LockResponse])
def get_lock(
    image_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get lock information for an image

    Args:
        image_id: Image UUID
        db: Database session
        current_user: Current authenticated user

    Returns:
        Lock information or None
    """
    lock = LockService.get_lock(db, image_id)

    if not lock:
        return None

    # Get username
    from app.models.user import User as UserModel
    user = db.query(UserModel).filter(UserModel.id == lock.locked_by).first()
    username = user.username if user else "Unknown"

    return LockResponse(
        image_id=str(lock.image_id),
        locked_by=str(lock.locked_by),
        locked_by_username=username,
        locked_at=lock.locked_at,
        expires_at=lock.expires_at
    )


@router.post("/cleanup")
def cleanup_expired_locks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cleanup expired locks (admin only)

    Args:
        db: Database session
        current_user: Current authenticated user

    Returns:
        Number of locks cleaned up
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    count = LockService.cleanup_expired_locks(db)
    return {"message": f"Cleaned up {count} expired locks"}
