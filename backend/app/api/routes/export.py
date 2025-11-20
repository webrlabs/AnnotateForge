"""Export routes"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Literal
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.project import Project
from app.models.image import Image
from app.models.annotation import Annotation
from app.services.export_service import ExportService

router = APIRouter(prefix="/export", tags=["export"])
export_service = ExportService()


@router.get("/projects/{project_id}/yolo")
def export_yolo(
    project_id: UUID,
    format: Literal["detection", "segmentation", "classification"] = "detection",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export project annotations in YOLO format

    Args:
        project_id: Project UUID
        format: Export format - "detection" (bbox), "segmentation" (polygon), or "classification"
        db: Database session
        current_user: Current authenticated user

    Returns:
        Zip file containing YOLO format labels

    Raises:
        HTTPException: If project not found or has no classes defined
    """
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Check if project has classes defined
    if not project.classes or len(project.classes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project has no classes defined. Please add classes before exporting."
        )

    # Get all images in project
    images = db.query(Image).filter(Image.project_id == project_id).all()

    if len(images) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project has no images"
        )

    # Get all annotations grouped by image
    annotations_by_image = {}
    for image in images:
        annotations = db.query(Annotation).filter(Annotation.image_id == image.id).all()
        annotations_by_image[image.id] = annotations

    # Export based on format
    if format == "detection":
        zip_data = export_service.export_yolo_detection(
            images, annotations_by_image, project.classes, settings.UPLOAD_DIR
        )
        filename = f"{project.name}_yolo_detection.zip"

    elif format == "segmentation":
        zip_data = export_service.export_yolo_segmentation(
            images, annotations_by_image, project.classes, settings.UPLOAD_DIR
        )
        filename = f"{project.name}_yolo_segmentation.zip"

    elif format == "classification":
        zip_data = export_service.export_yolo_classification(
            images, project.classes, settings.UPLOAD_DIR
        )
        filename = f"{project.name}_yolo_classification.zip"

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid format: {format}"
        )

    # Return zip file
    return Response(
        content=zip_data,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.get("/projects/{project_id}/coco")
def export_coco(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export project annotations in COCO format

    Args:
        project_id: Project UUID
        db: Database session
        current_user: Current authenticated user

    Returns:
        Zip file containing COCO format annotations and images

    Raises:
        HTTPException: If project not found or has no classes defined
    """
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Check if project has classes defined
    if not project.classes or len(project.classes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project has no classes defined. Please add classes before exporting."
        )

    # Get all images in project
    images = db.query(Image).filter(Image.project_id == project_id).all()

    if len(images) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project has no images"
        )

    # Get all annotations grouped by image
    annotations_by_image = {}
    for image in images:
        annotations = db.query(Annotation).filter(Annotation.image_id == image.id).all()
        annotations_by_image[image.id] = annotations

    # Export to COCO format
    zip_data = export_service.export_coco(
        project.name, images, annotations_by_image, project.classes, settings.UPLOAD_DIR
    )
    filename = f"{project.name}_coco.zip"

    # Return zip file
    return Response(
        content=zip_data,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
