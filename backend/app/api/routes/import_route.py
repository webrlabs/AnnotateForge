"""Import routes"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Literal
from uuid import UUID
import shutil
import os
import logging
from pathlib import Path

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.project import Project
from app.models.image import Image
from app.models.annotation import Annotation
from app.services.import_service import ImportService
from app.services.image_processor import ImageProcessor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/import", tags=["import"])
import_service = ImportService()
image_processor = ImageProcessor()


@router.post("/projects/{project_id}/dataset")
async def import_dataset(
    project_id: UUID,
    file: UploadFile = File(...),
    format: Literal["yolo_detection", "yolo_segmentation", "coco"] = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import a dataset from a ZIP file

    Args:
        project_id: Project UUID
        file: ZIP file containing dataset
        format: Import format - "yolo_detection", "yolo_segmentation", or "coco"
        db: Database session
        current_user: Current authenticated user

    Returns:
        Import results with statistics

    Raises:
        HTTPException: If project not found or import fails
    """
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Read uploaded file
    try:
        zip_data = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded file: {str(e)}"
        )

    # Create temp directory for extraction
    temp_dir = os.path.join(settings.UPLOAD_DIR, 'temp')
    os.makedirs(temp_dir, exist_ok=True)
    logger.info(f"Starting import for project {project_id}, format: {format}")
    logger.info(f"Temp directory: {temp_dir}")

    try:
        # Parse dataset based on format
        if format == "yolo_detection":
            results = import_service.import_yolo_dataset(zip_data, 'detection', temp_dir)
        elif format == "yolo_segmentation":
            results = import_service.import_yolo_dataset(zip_data, 'segmentation', temp_dir)
        elif format == "coco":
            results = import_service.import_coco_dataset(zip_data, temp_dir)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid format: {format}"
            )

        logger.info(f"Parsed dataset: {len(results['images'])} images, {results['total_annotations']} annotations")

        # Update project classes (merge with existing)
        existing_classes = set(project.classes or [])
        new_classes = set(results['class_names'])
        all_classes = list(existing_classes | new_classes)
        project.classes = all_classes

        # Create storage directories if they don't exist (matching normal upload structure)
        original_dir = os.path.join(settings.UPLOAD_DIR, 'original')
        thumbnails_dir = os.path.join(settings.UPLOAD_DIR, 'thumbnails')
        os.makedirs(original_dir, exist_ok=True)
        os.makedirs(thumbnails_dir, exist_ok=True)
        logger.info(f"Storage directories: original={original_dir}, thumbnails={thumbnails_dir}")

        # Import images and annotations
        imported_images = 0
        imported_annotations = 0
        failed_images = []

        for img_data in results['images']:
            try:
                # Copy image to original directory (matching normal upload structure)
                source_path = img_data['path']
                dest_filename = img_data['filename']
                dest_path = os.path.join(original_dir, dest_filename)

                # Check if source file exists
                if not os.path.exists(source_path):
                    logger.warning(f"Source file not found: {source_path}")
                    failed_images.append(f"{dest_filename} (source not found)")
                    continue

                # Handle duplicate filenames
                counter = 1
                base_name, ext = os.path.splitext(img_data['filename'])
                while os.path.exists(dest_path):
                    dest_filename = f"{base_name}_{counter}{ext}"
                    dest_path = os.path.join(original_dir, dest_filename)
                    counter += 1

                # Copy the file
                logger.debug(f"Copying {source_path} to {dest_path}")
                shutil.copy2(source_path, dest_path)

                # Verify the copy was successful
                if not os.path.exists(dest_path):
                    logger.error(f"Copy verification failed: {dest_path}")
                    failed_images.append(f"{dest_filename} (copy failed)")
                    continue

                # Generate thumbnail
                import cv2
                cv_image = cv2.imread(dest_path)
                if cv_image is None:
                    logger.error(f"Failed to read image for thumbnail: {dest_path}")
                    failed_images.append(f"{dest_filename} (thumbnail generation failed)")
                    continue

                thumbnail_bytes = image_processor.generate_thumbnail(cv_image, size=256)
                thumbnail_filename = f"{dest_filename}.jpg"
                thumbnail_path = os.path.join(thumbnails_dir, thumbnail_filename)
                with open(thumbnail_path, "wb") as f:
                    f.write(thumbnail_bytes)

                # Get file size
                file_size = os.path.getsize(dest_path)

                # Create image record (matching normal upload path structure)
                image = Image(
                    project_id=project_id,
                    filename=dest_filename,
                    original_path=f"/storage/original/{dest_filename}",
                    thumbnail_path=f"/storage/thumbnails/{thumbnail_filename}",
                    width=img_data['width'],
                    height=img_data['height'],
                    file_size=file_size,
                    format=img_data.get('format'),
                    uploaded_by=current_user.id,
                    image_class=img_data.get('image_class')
                )
                db.add(image)
                db.flush()  # Get image ID

                imported_images += 1

                # Create annotations
                for ann_data in img_data['annotations']:
                    annotation = Annotation(
                        image_id=image.id,
                        type=ann_data['type'],
                        data=ann_data['data'],
                        class_label=ann_data.get('class_label'),
                        confidence=ann_data.get('confidence', 1.0),
                        created_by=current_user.id
                    )
                    db.add(annotation)
                    imported_annotations += 1

            except Exception as e:
                failed_images.append(f"{img_data['filename']} ({str(e)})")
                continue

        # Commit all changes
        db.commit()

        response_data = {
            "status": "success",
            "imported_images": imported_images,
            "imported_annotations": imported_annotations,
            "classes": all_classes,
            "new_classes": list(new_classes - existing_classes)
        }

        if failed_images:
            response_data["failed_images"] = failed_images
            response_data["status"] = "partial_success"
            logger.warning(f"Import completed with {len(failed_images)} failed images")

        logger.info(f"Import completed: {imported_images} images, {imported_annotations} annotations")

        return response_data

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {str(e)}"
        )
    finally:
        # Cleanup temp directory
        try:
            for root, dirs, files in os.walk(temp_dir):
                for d in dirs:
                    dir_path = os.path.join(root, d)
                    if os.path.exists(dir_path):
                        shutil.rmtree(dir_path, ignore_errors=True)
        except:
            pass
