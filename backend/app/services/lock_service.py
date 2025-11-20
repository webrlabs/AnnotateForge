"""Image lock service for preventing concurrent edits"""
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from app.models.image_lock import ImageLock
from app.models.user import User
from app.models.image import Image


class LockService:
    """Service for managing image locks"""

    # Lock duration in minutes
    LOCK_DURATION_MINUTES = 30

    @staticmethod
    def acquire_lock(
        db: Session,
        image_id: UUID,
        user: User
    ) -> tuple[bool, Optional[ImageLock], Optional[str]]:
        """
        Acquire a lock on an image

        Args:
            db: Database session
            image_id: Image ID to lock
            user: User requesting the lock

        Returns:
            Tuple of (success, lock_object, error_message)
        """
        # Check if image exists
        image = db.query(Image).filter(Image.id == image_id).first()
        if not image:
            return False, None, "Image not found"

        # Check for existing lock
        existing_lock = db.query(ImageLock).filter(
            ImageLock.image_id == image_id
        ).first()

        now = datetime.utcnow()

        if existing_lock:
            # Check if lock is expired
            if existing_lock.expires_at < now:
                # Lock expired, remove it
                db.delete(existing_lock)
                db.flush()
            elif existing_lock.locked_by == user.id:
                # User already has the lock, refresh expiration
                existing_lock.expires_at = now + timedelta(minutes=LockService.LOCK_DURATION_MINUTES)
                db.commit()
                db.refresh(existing_lock)
                return True, existing_lock, None
            else:
                # Lock is held by another user
                locked_by_user = db.query(User).filter(User.id == existing_lock.locked_by).first()
                username = locked_by_user.username if locked_by_user else "Unknown"
                return False, existing_lock, f"Image is locked by {username}"

        # Create new lock
        lock = ImageLock(
            image_id=image_id,
            locked_by=user.id,
            expires_at=now + timedelta(minutes=LockService.LOCK_DURATION_MINUTES)
        )

        db.add(lock)
        db.commit()
        db.refresh(lock)

        return True, lock, None

    @staticmethod
    def release_lock(
        db: Session,
        image_id: UUID,
        user: User,
        force: bool = False
    ) -> tuple[bool, Optional[str]]:
        """
        Release a lock on an image

        Args:
            db: Database session
            image_id: Image ID to unlock
            user: User requesting the unlock
            force: If True, allows admins to force unlock

        Returns:
            Tuple of (success, error_message)
        """
        lock = db.query(ImageLock).filter(
            ImageLock.image_id == image_id
        ).first()

        if not lock:
            return True, None  # No lock exists, consider it successful

        # Check if user owns the lock or is admin with force flag
        if lock.locked_by == user.id or (force and user.is_admin):
            db.delete(lock)
            db.commit()
            return True, None
        else:
            locked_by_user = db.query(User).filter(User.id == lock.locked_by).first()
            username = locked_by_user.username if locked_by_user else "Unknown"
            return False, f"Cannot unlock - locked by {username}"

    @staticmethod
    def refresh_lock(
        db: Session,
        image_id: UUID,
        user: User
    ) -> tuple[bool, Optional[str]]:
        """
        Refresh/extend an existing lock

        Args:
            db: Database session
            image_id: Image ID
            user: User who owns the lock

        Returns:
            Tuple of (success, error_message)
        """
        lock = db.query(ImageLock).filter(
            ImageLock.image_id == image_id
        ).first()

        if not lock:
            return False, "No lock exists"

        if lock.locked_by != user.id:
            return False, "You don't own this lock"

        # Refresh expiration
        lock.expires_at = datetime.utcnow() + timedelta(minutes=LockService.LOCK_DURATION_MINUTES)
        db.commit()
        db.refresh(lock)

        return True, None

    @staticmethod
    def get_lock(
        db: Session,
        image_id: UUID
    ) -> Optional[ImageLock]:
        """
        Get lock information for an image

        Args:
            db: Database session
            image_id: Image ID

        Returns:
            ImageLock object or None
        """
        lock = db.query(ImageLock).filter(
            ImageLock.image_id == image_id
        ).first()

        if not lock:
            return None

        # Check if expired
        if lock.expires_at < datetime.utcnow():
            db.delete(lock)
            db.commit()
            return None

        return lock

    @staticmethod
    def cleanup_expired_locks(db: Session) -> int:
        """
        Remove all expired locks

        Args:
            db: Database session

        Returns:
            Number of locks removed
        """
        expired_locks = db.query(ImageLock).filter(
            ImageLock.expires_at < datetime.utcnow()
        ).all()

        count = len(expired_locks)
        for lock in expired_locks:
            db.delete(lock)

        db.commit()
        return count

    @staticmethod
    def release_user_locks(
        db: Session,
        user_id: UUID
    ) -> int:
        """
        Release all locks held by a user (e.g., on logout/disconnect)

        Args:
            db: Database session
            user_id: User ID

        Returns:
            Number of locks released
        """
        locks = db.query(ImageLock).filter(
            ImageLock.locked_by == user_id
        ).all()

        count = len(locks)
        for lock in locks:
            db.delete(lock)

        db.commit()
        return count
