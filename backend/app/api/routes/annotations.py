"""Annotation routes"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
import asyncio

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.image import Image
from app.models.annotation import Annotation
from app.schemas.annotation import AnnotationCreate, AnnotationUpdate, AnnotationResponse
from app.services.audit_service import AuditService
from app.services.connection_manager import manager

router = APIRouter(prefix="/annotations", tags=["annotations"])


@router.get("/images/{image_id}/annotations", response_model=List[AnnotationResponse])
def get_image_annotations(
    image_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all annotations for an image

    Args:
        image_id: Image UUID
        db: Database session
        current_user: Current authenticated user

    Returns:
        List of annotations

    Raises:
        HTTPException: If image not found
    """
    # Verify image exists
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )

    annotations = db.query(Annotation).filter(Annotation.image_id == image_id).all()
    return annotations


@router.post("/images/{image_id}/annotations", response_model=AnnotationResponse, status_code=status.HTTP_201_CREATED)
async def create_annotation(
    image_id: UUID,
    annotation_data: AnnotationCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new annotation

    Args:
        image_id: Image UUID
        annotation_data: Annotation data
        request: FastAPI request object
        db: Database session
        current_user: Current authenticated user

    Returns:
        Created annotation

    Raises:
        HTTPException: If image not found
    """
    # Verify image exists
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )

    # Create annotation
    annotation = Annotation(
        image_id=image_id,
        created_by=current_user.id,
        **annotation_data.model_dump()
    )

    db.add(annotation)
    db.flush()  # Flush to get the ID

    # Log the action
    AuditService.log_create(
        db=db,
        user=current_user,
        resource_type="annotation",
        resource_id=annotation.id,
        data={
            "type": annotation.type,
            "image_id": str(image_id),
            "class_label": annotation.class_label,
            "source": annotation.source
        },
        request=request
    )

    db.commit()
    db.refresh(annotation)

    # Broadcast to other users viewing this image
    annotation_dict = {
        "id": str(annotation.id),
        "type": annotation.type,
        "data": annotation.data,
        "class_label": annotation.class_label,
        "confidence": annotation.confidence,
        "source": annotation.source,
        "created_by": str(annotation.created_by),
        "created_at": annotation.created_at.isoformat() if annotation.created_at else None
    }

    await manager.broadcast_annotation_created(
        image_id=str(image_id),
        annotation=annotation_dict,
        user_id=str(current_user.id)
    )

    return annotation


@router.get("/{annotation_id}", response_model=AnnotationResponse)
def get_annotation(
    annotation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get annotation by ID

    Args:
        annotation_id: Annotation UUID
        db: Database session
        current_user: Current authenticated user

    Returns:
        Annotation details

    Raises:
        HTTPException: If annotation not found
    """
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()

    if not annotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Annotation not found"
        )

    return annotation


@router.put("/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(
    annotation_id: UUID,
    annotation_data: AnnotationUpdate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update annotation

    Args:
        annotation_id: Annotation UUID
        annotation_data: Annotation update data
        request: FastAPI request object
        db: Database session
        current_user: Current authenticated user

    Returns:
        Updated annotation

    Raises:
        HTTPException: If annotation not found
    """
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()

    if not annotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Annotation not found"
        )

    # Capture old data for audit log
    old_data = {
        "type": annotation.type,
        "class_label": annotation.class_label,
        "data": annotation.data,
        "confidence": annotation.confidence
    }

    # Update fields
    update_data = annotation_data.model_dump(exclude_unset=True)
    new_data = {}
    for field, value in update_data.items():
        setattr(annotation, field, value)
        new_data[field] = value

    # Log the action
    AuditService.log_update(
        db=db,
        user=current_user,
        resource_type="annotation",
        resource_id=annotation_id,
        old_data={k: v for k, v in old_data.items() if k in new_data},
        new_data=new_data,
        request=request
    )

    db.commit()
    db.refresh(annotation)

    # Broadcast to other users viewing this image
    annotation_dict = {
        "id": str(annotation.id),
        "type": annotation.type,
        "data": annotation.data,
        "class_label": annotation.class_label,
        "confidence": annotation.confidence,
        "source": annotation.source,
        "created_by": str(annotation.created_by),
        "created_at": annotation.created_at.isoformat() if annotation.created_at else None
    }

    await manager.broadcast_annotation_updated(
        image_id=str(annotation.image_id),
        annotation=annotation_dict,
        user_id=str(current_user.id)
    )

    return annotation


@router.delete("/{annotation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_annotation(
    annotation_id: UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete annotation

    Args:
        annotation_id: Annotation UUID
        request: FastAPI request object
        db: Database session
        current_user: Current authenticated user

    Raises:
        HTTPException: If annotation not found
    """
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()

    if not annotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Annotation not found"
        )

    # Capture data for audit log and broadcast before deletion
    image_id = annotation.image_id
    deleted_data = {
        "type": annotation.type,
        "image_id": str(annotation.image_id),
        "class_label": annotation.class_label,
        "source": annotation.source
    }

    # Log the action
    AuditService.log_delete(
        db=db,
        user=current_user,
        resource_type="annotation",
        resource_id=annotation_id,
        data=deleted_data,
        request=request
    )

    db.delete(annotation)
    db.commit()

    # Broadcast to other users viewing this image
    await manager.broadcast_annotation_deleted(
        image_id=str(image_id),
        annotation_id=str(annotation_id),
        user_id=str(current_user.id)
    )

    return None
