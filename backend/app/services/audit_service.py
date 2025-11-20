"""Audit logging service"""
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from uuid import UUID
from fastapi import Request

from app.models.audit_log import AuditLog
from app.models.user import User


class AuditService:
    """Service for logging user actions"""

    @staticmethod
    def log(
        db: Session,
        user: User,
        action: str,
        resource_type: str,
        resource_id: UUID,
        changes: Optional[Dict[str, Any]] = None,
        request: Optional[Request] = None
    ) -> AuditLog:
        """
        Log a user action to the audit log

        Args:
            db: Database session
            user: User performing the action
            action: Action type (create, update, delete, etc.)
            resource_type: Type of resource (annotation, image, project, etc.)
            resource_id: ID of the resource
            changes: Optional dict of changes made
            request: Optional FastAPI request object to extract IP

        Returns:
            Created audit log entry
        """
        # Extract IP address from request
        ip_address = None
        if request:
            # Try to get real IP from X-Forwarded-For header (if behind proxy)
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                ip_address = forwarded_for.split(",")[0].strip()
            else:
                # Fall back to client host
                ip_address = request.client.host if request.client else None

        # Create audit log entry
        audit_entry = AuditLog(
            user_id=user.id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            changes=changes,
            ip_address=ip_address
        )

        db.add(audit_entry)
        db.flush()  # Flush to get the ID but don't commit yet

        return audit_entry

    @staticmethod
    def log_create(
        db: Session,
        user: User,
        resource_type: str,
        resource_id: UUID,
        data: Optional[Dict[str, Any]] = None,
        request: Optional[Request] = None
    ) -> AuditLog:
        """Log a create action"""
        return AuditService.log(
            db=db,
            user=user,
            action="create",
            resource_type=resource_type,
            resource_id=resource_id,
            changes={"created": data} if data else None,
            request=request
        )

    @staticmethod
    def log_update(
        db: Session,
        user: User,
        resource_type: str,
        resource_id: UUID,
        old_data: Optional[Dict[str, Any]] = None,
        new_data: Optional[Dict[str, Any]] = None,
        request: Optional[Request] = None
    ) -> AuditLog:
        """Log an update action"""
        changes = {}
        if old_data:
            changes["old"] = old_data
        if new_data:
            changes["new"] = new_data

        return AuditService.log(
            db=db,
            user=user,
            action="update",
            resource_type=resource_type,
            resource_id=resource_id,
            changes=changes if changes else None,
            request=request
        )

    @staticmethod
    def log_delete(
        db: Session,
        user: User,
        resource_type: str,
        resource_id: UUID,
        data: Optional[Dict[str, Any]] = None,
        request: Optional[Request] = None
    ) -> AuditLog:
        """Log a delete action"""
        return AuditService.log(
            db=db,
            user=user,
            action="delete",
            resource_type=resource_type,
            resource_id=resource_id,
            changes={"deleted": data} if data else None,
            request=request
        )
