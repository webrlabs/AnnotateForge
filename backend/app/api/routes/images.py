"""Image routes"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from uuid import UUID
import os
import shutil
from PIL import Image as PILImage

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.project import Project
from app.models.image import Image
from app.models.annotation import Annotation
from app.schemas.image import ImageResponse, ImageUpdate
from app.services.image_processor import ImageProcessor

router = APIRouter(prefix="/images", tags=["images"])
image_processor = ImageProcessor()


@router.get("/projects/{project_id}/images", response_model=List[ImageResponse])
def get_project_images(
    project_id: UUID,
    skip: int = 0,
    limit: int = 10000,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all images for a project

    Args:
        project_id: Project UUID
        skip: Number of records to skip
        limit: Maximum number of records to return
        db: Database session
        current_user: Current authenticated user

    Returns:
        List of images

    Raises:
        HTTPException: If project not found
    """
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Get images
    images = db.query(Image).filter(Image.project_id == project_id).offset(skip).limit(limit).all()

    # Add annotation count and annotation classes
    result = []
    for image in images:
        annotation_count = db.query(func.count(Annotation.id)).filter(Annotation.image_id == image.id).scalar()

        # Get unique annotation classes for this image
        annotation_classes = db.query(Annotation.class_label).filter(
            Annotation.image_id == image.id,
            Annotation.class_label.isnot(None)
        ).distinct().all()
        annotation_classes = [ac[0] for ac in annotation_classes if ac[0]]

        image_dict = {
            "id": image.id,
            "project_id": image.project_id,
            "filename": image.filename,
            "original_path": image.original_path,
            "thumbnail_path": image.thumbnail_path,
            "width": image.width,
            "height": image.height,
            "file_size": image.file_size,
            "format": image.format,
            "image_class": image.image_class,
            "uploaded_by": image.uploaded_by,
            "created_at": image.created_at,
            "metadata": image.image_metadata,
            "annotation_count": annotation_count,
            "annotation_classes": annotation_classes
        }
        result.append(ImageResponse(**image_dict))

    return result


@router.post("/projects/{project_id}/images", response_model=ImageResponse, status_code=status.HTTP_201_CREATED)
async def upload_image(
    project_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload image to project

    Args:
        project_id: Project UUID
        file: Image file
        db: Database session
        current_user: Current authenticated user

    Returns:
        Created image record

    Raises:
        HTTPException: If project not found or upload fails
    """
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    try:
        # Create storage directories
        os.makedirs(os.path.join(settings.UPLOAD_DIR, "original"), exist_ok=True)
        os.makedirs(os.path.join(settings.UPLOAD_DIR, "thumbnails"), exist_ok=True)

        # Save original file
        original_filepath = os.path.join(settings.UPLOAD_DIR, "original", file.filename)
        with open(original_filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Get image metadata
        pil_image = PILImage.open(original_filepath)
        width, height = pil_image.size
        img_format = pil_image.format
        file_size = os.path.getsize(original_filepath)

        # Generate thumbnail
        import cv2
        cv_image = cv2.imread(original_filepath)
        thumbnail_bytes = image_processor.generate_thumbnail(cv_image, size=256)
        thumbnail_filepath = os.path.join(settings.UPLOAD_DIR, "thumbnails", f"{file.filename}.jpg")
        with open(thumbnail_filepath, "wb") as f:
            f.write(thumbnail_bytes)

        # Store web-accessible paths (relative to /storage mount)
        original_path = f"/storage/original/{file.filename}"
        thumbnail_path = f"/storage/thumbnails/{file.filename}.jpg"

        # Create database record
        image = Image(
            project_id=project_id,
            filename=file.filename,
            original_path=original_path,
            thumbnail_path=thumbnail_path,
            width=width,
            height=height,
            file_size=file_size,
            format=img_format,
            uploaded_by=current_user.id
        )

        db.add(image)
        db.commit()
        db.refresh(image)

        return ImageResponse(
            id=image.id,
            project_id=image.project_id,
            filename=image.filename,
            original_path=image.original_path,
            thumbnail_path=image.thumbnail_path,
            width=image.width,
            height=image.height,
            file_size=image.file_size,
            format=image.format,
            image_class=None,
            uploaded_by=image.uploaded_by,
            created_at=image.created_at,
            metadata=image.image_metadata,
            annotation_count=0,
            annotation_classes=[]
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Image upload failed: {str(e)}"
        )


@router.get("/{image_id}", response_model=ImageResponse)
def get_image(
    image_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get image by ID

    Args:
        image_id: Image UUID
        db: Database session
        current_user: Current authenticated user

    Returns:
        Image details

    Raises:
        HTTPException: If image not found
    """
    image = db.query(Image).filter(Image.id == image_id).first()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )

    annotation_count = db.query(func.count(Annotation.id)).filter(Annotation.image_id == image_id).scalar()

    # Get unique annotation classes for this image
    annotation_classes = db.query(Annotation.class_label).filter(
        Annotation.image_id == image_id,
        Annotation.class_label.isnot(None)
    ).distinct().all()
    annotation_classes = [ac[0] for ac in annotation_classes if ac[0]]

    return ImageResponse(
        id=image.id,
        project_id=image.project_id,
        filename=image.filename,
        original_path=image.original_path,
        thumbnail_path=image.thumbnail_path,
        width=image.width,
        height=image.height,
        file_size=image.file_size,
        format=image.format,
        image_class=image.image_class,
        uploaded_by=image.uploaded_by,
        created_at=image.created_at,
        metadata=image.image_metadata,
        annotation_count=annotation_count,
        annotation_classes=annotation_classes
    )


@router.put("/{image_id}", response_model=ImageResponse)
def update_image(
    image_id: UUID,
    image_data: ImageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update image

    Args:
        image_id: Image UUID
        image_data: Image update data
        db: Database session
        current_user: Current authenticated user

    Returns:
        Updated image

    Raises:
        HTTPException: If image not found
    """
    image = db.query(Image).filter(Image.id == image_id).first()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )

    # Update fields
    update_data = image_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(image, field, value)

    db.commit()
    db.refresh(image)

    annotation_count = db.query(func.count(Annotation.id)).filter(Annotation.image_id == image_id).scalar()

    # Get unique annotation classes for this image
    annotation_classes = db.query(Annotation.class_label).filter(
        Annotation.image_id == image_id,
        Annotation.class_label.isnot(None)
    ).distinct().all()
    annotation_classes = [ac[0] for ac in annotation_classes if ac[0]]

    return ImageResponse(
        id=image.id,
        project_id=image.project_id,
        filename=image.filename,
        original_path=image.original_path,
        thumbnail_path=image.thumbnail_path,
        width=image.width,
        height=image.height,
        file_size=image.file_size,
        format=image.format,
        image_class=image.image_class,
        uploaded_by=image.uploaded_by,
        created_at=image.created_at,
        metadata=image.image_metadata,
        annotation_count=annotation_count,
        annotation_classes=annotation_classes
    )


@router.delete("/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_image(
    image_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete image

    Args:
        image_id: Image UUID
        db: Database session
        current_user: Current authenticated user

    Raises:
        HTTPException: If image not found
    """
    image = db.query(Image).filter(Image.id == image_id).first()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )

    # Delete files (convert web paths to filesystem paths)
    try:
        # Convert /storage/... to actual filesystem path
        original_filepath = image.original_path.replace("/storage/", settings.UPLOAD_DIR + "/")
        if os.path.exists(original_filepath):
            os.remove(original_filepath)
        if image.thumbnail_path:
            thumbnail_filepath = image.thumbnail_path.replace("/storage/", settings.UPLOAD_DIR + "/")
            if os.path.exists(thumbnail_filepath):
                os.remove(thumbnail_filepath)
    except Exception:
        pass  # Continue even if file deletion fails

    # Delete database record
    db.delete(image)
    db.commit()

    return None
