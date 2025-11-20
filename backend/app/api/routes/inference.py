"""Inference routes"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import time
import cv2
import os

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.core.redis_client import redis_cache
from app.models.user import User
from app.models.image import Image
from app.models.training import TrainedModel
from app.schemas.inference import SimpleBlobParams, YOLOParams, SAM2Prompts, InferenceResponse
from app.services.sam2_service import SAM2Service
from app.services.yolo_service import YOLOService
from app.services.simpleblob_service import SimpleBlobService
from app.services.image_processor import ImageProcessor

router = APIRouter(prefix="/inference", tags=["inference"])

# Initialize services
sam2_service = SAM2Service(settings.SAM2_MODEL)
yolo_service = YOLOService(settings.YOLO_MODEL)
simpleblob_service = SimpleBlobService()
image_processor = ImageProcessor()


@router.post("/simpleblob", response_model=InferenceResponse)
def run_simpleblob(
    params: SimpleBlobParams,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Run SimpleBlob detection on image (with Redis caching)

    Args:
        params: SimpleBlob parameters
        db: Database session
        current_user: Current authenticated user

    Returns:
        Detection results

    Raises:
        HTTPException: If image not found or inference fails
    """
    # Get image
    image = db.query(Image).filter(Image.id == params.image_id).first()
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )

    # Check Redis cache first
    cached_result = redis_cache.get_inference_result(
        service="simpleblob",
        image_id=str(params.image_id),
        params=params.params
    )

    if cached_result is not None:
        return InferenceResponse(
            annotations=cached_result,
            inference_time=0.0,  # Cached result
            cached=True
        )

    try:
        # Load image (convert web path to filesystem path)
        original_filepath = image.original_path.replace("/storage/", settings.UPLOAD_DIR + "/")
        cv_image = image_processor.load_image(original_filepath)

        # Run detection
        start_time = time.time()
        annotations = simpleblob_service.detect(cv_image, params.params)
        inference_time = time.time() - start_time

        # Cache the result (1 hour TTL)
        redis_cache.set_inference_result(
            service="simpleblob",
            image_id=str(params.image_id),
            params=params.params,
            results=annotations,
            ttl=3600
        )

        return InferenceResponse(
            annotations=annotations,
            inference_time=inference_time,
            cached=False
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"SimpleBlob inference failed: {str(e)}"
        )


@router.post("/yolo", response_model=InferenceResponse)
def run_yolo(
    params: YOLOParams,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Run YOLO object detection on image (with Redis caching)

    Args:
        params: YOLO parameters (can specify model_id for trained models)
        db: Database session
        current_user: Current authenticated user

    Returns:
        Detection results

    Raises:
        HTTPException: If image not found or inference fails
    """
    # Get image
    image = db.query(Image).filter(Image.id == params.image_id).first()
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )

    # Determine which model to use
    model_path = params.model
    cache_key_suffix = params.model

    if params.model_id:
        # Use trained model
        trained_model = db.query(TrainedModel).filter(TrainedModel.id == params.model_id).first()
        if not trained_model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trained model not found"
            )
        model_path = trained_model.model_path
        cache_key_suffix = str(params.model_id)

    # Check Redis cache first
    cached_result = redis_cache.get_inference_result(
        service="yolo",
        image_id=str(params.image_id),
        params={"confidence": params.confidence, "model": cache_key_suffix}
    )

    if cached_result is not None:
        return InferenceResponse(
            annotations=cached_result,
            inference_time=0.0,
            cached=True
        )

    try:
        # Load image (convert web path to filesystem path)
        original_filepath = image.original_path.replace("/storage/", settings.UPLOAD_DIR + "/")
        cv_image = image_processor.load_image(original_filepath)

        # Load model and run detection
        start_time = time.time()

        # Create temporary YOLO service with the specified model
        temp_yolo_service = YOLOService(model_path)
        annotations = temp_yolo_service.predict(cv_image, params.confidence)

        inference_time = time.time() - start_time

        # Cache the result
        redis_cache.set_inference_result(
            service="yolo",
            image_id=str(params.image_id),
            params={"confidence": params.confidence, "model": cache_key_suffix},
            results=annotations,
            ttl=3600
        )

        return InferenceResponse(
            annotations=annotations,
            inference_time=inference_time,
            cached=False
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"YOLO inference failed: {str(e)}"
        )


@router.post("/sam2", response_model=InferenceResponse)
def run_sam2(
    params: SAM2Prompts,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Run SAM2 segmentation on image (with Redis caching)

    Args:
        params: SAM2 prompts
        db: Database session
        current_user: Current authenticated user

    Returns:
        Segmentation results

    Raises:
        HTTPException: If image not found or inference fails
    """
    # Get image
    image = db.query(Image).filter(Image.id == params.image_id).first()
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )

    # Check Redis cache first
    cached_result = redis_cache.get_inference_result(
        service="sam2",
        image_id=str(params.image_id),
        params=params.prompts
    )

    if cached_result is not None:
        return InferenceResponse(
            annotations=cached_result,
            inference_time=0.0,
            cached=True
        )

    try:
        # Load image (convert web path to filesystem path)
        original_filepath = image.original_path.replace("/storage/", settings.UPLOAD_DIR + "/")
        cv_image = image_processor.load_image(original_filepath)

        # Run segmentation
        start_time = time.time()

        if "points" in params.prompts and "labels" in params.prompts:
            annotations = sam2_service.predict_with_points(
                cv_image,
                params.prompts["points"],
                params.prompts["labels"],
                multimask_output=params.multimask_output
            )
        elif "boxes" in params.prompts:
            # Get first box
            bbox = params.prompts["boxes"][0]
            annotations = sam2_service.predict_with_box(cv_image, bbox)
        else:
            raise ValueError("Invalid prompts: must contain either points+labels or boxes")

        inference_time = time.time() - start_time

        # Cache the result
        redis_cache.set_inference_result(
            service="sam2",
            image_id=str(params.image_id),
            params=params.prompts,
            results=annotations,
            ttl=3600
        )

        return InferenceResponse(
            annotations=annotations,
            inference_time=inference_time,
            cached=False
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"SAM2 inference failed: {str(e)}"
        )
