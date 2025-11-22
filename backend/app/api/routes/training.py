"""Training system routes"""
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Dict, Any
from uuid import UUID
from datetime import datetime
import logging
import os

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.training import TrainingJob, TrainedModel, TrainingMetric, TrainingDataset
from app.schemas.training import (
    TrainingJobCreate,
    TrainingJobResponse,
    TrainingJobDetail,
    TrainedModelResponse,
    TrainedModelDetail,
    TrainingMetricResponse,
    InferenceRequest,
    InferenceResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/training", tags=["training"])


# ===== Training Job Routes =====

@router.get("/jobs", response_model=List[TrainingJobResponse])
def get_training_jobs(
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    task_type: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all training jobs

    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        status: Filter by status (optional)
        task_type: Filter by task type (optional)
        db: Database session
        current_user: Current authenticated user

    Returns:
        List of training jobs
    """
    query = db.query(TrainingJob).filter(TrainingJob.created_by == current_user.id)

    if status:
        query = query.filter(TrainingJob.status == status)
    if task_type:
        query = query.filter(TrainingJob.task_type == task_type)

    jobs = query.order_by(desc(TrainingJob.created_at)).offset(skip).limit(limit).all()

    return [
        TrainingJobResponse(
            id=job.id,
            name=job.name,
            description=job.description,
            task_type=job.task_type,
            status=job.status,
            current_epoch=job.current_epoch,
            total_epochs=job.total_epochs,
            progress_percent=job.progress_percent,
            created_at=job.created_at,
            started_at=job.started_at,
            completed_at=job.completed_at,
            created_by=job.created_by
        )
        for job in jobs
    ]


@router.post("/jobs", response_model=TrainingJobResponse, status_code=status.HTTP_201_CREATED)
def create_training_job(
    job_data: TrainingJobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new training job

    Args:
        job_data: Training job creation data
        db: Database session
        current_user: Current authenticated user

    Returns:
        Created training job

    Raises:
        HTTPException: If validation fails
    """
    # Validate config has required fields based on task_type
    config = job_data.config
    task_type = job_data.task_type

    # Basic validation
    if "projects" not in config or not config["projects"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Config must include at least one project"
        )

    if "class_mapping" not in config or not config["class_mapping"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Config must include class_mapping"
        )

    if "hyperparameters" not in config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Config must include hyperparameters"
        )

    # Get total epochs from hyperparameters
    total_epochs = config.get("hyperparameters", {}).get("epochs", 100)

    # Create training job
    job = TrainingJob(
        name=job_data.name,
        description=job_data.description,
        task_type=task_type,
        config=config,
        total_epochs=total_epochs,
        created_by=current_user.id,
        status="pending"
    )

    db.add(job)
    db.commit()
    db.refresh(job)

    # Trigger Celery task to start training
    from app.tasks.training_tasks import train_model
    task = train_model.delay(str(job.id))

    # Store the Celery task ID for cancellation
    job.celery_task_id = task.id
    db.commit()

    return TrainingJobResponse(
        id=job.id,
        name=job.name,
        description=job.description,
        task_type=job.task_type,
        status=job.status,
        current_epoch=job.current_epoch,
        total_epochs=job.total_epochs,
        progress_percent=job.progress_percent,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        created_by=job.created_by
    )


@router.get("/jobs/{job_id}", response_model=TrainingJobDetail)
def get_training_job(
    job_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get training job by ID

    Args:
        job_id: Training job UUID
        db: Database session
        current_user: Current authenticated user

    Returns:
        Training job details

    Raises:
        HTTPException: If job not found or access denied
    """
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training job not found"
        )

    if job.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Get latest metrics
    latest_metric = db.query(TrainingMetric).filter(
        TrainingMetric.training_job_id == job_id
    ).order_by(desc(TrainingMetric.epoch)).first()

    latest_metrics_dict = None
    if latest_metric:
        latest_metrics_dict = {
            "epoch": latest_metric.epoch,
            "train_loss": latest_metric.train_loss,
            "val_loss": latest_metric.val_loss,
            **latest_metric.metrics
        }

    # Get dataset info
    dataset = db.query(TrainingDataset).filter(
        TrainingDataset.training_job_id == job_id
    ).first()

    dataset_dict = None
    if dataset:
        dataset_dict = {
            "total_images": dataset.total_images,
            "train_images": dataset.train_images,
            "val_images": dataset.val_images,
            "class_mapping": dataset.class_mapping,
            "annotation_types": dataset.annotation_types
        }

    return TrainingJobDetail(
        id=job.id,
        name=job.name,
        description=job.description,
        task_type=job.task_type,
        status=job.status,
        current_epoch=job.current_epoch,
        total_epochs=job.total_epochs,
        progress_percent=job.progress_percent,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        created_by=job.created_by,
        config=job.config,
        final_metrics=job.final_metrics,
        error_message=job.error_message,
        dataset=dataset_dict,
        latest_metrics=latest_metrics_dict
    )


@router.post("/jobs/{job_id}/restart", response_model=TrainingJobResponse, status_code=status.HTTP_201_CREATED)
def restart_training_job(
    job_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Restart a training job with the same configuration

    Args:
        job_id: Training job UUID to restart
        db: Database session
        current_user: Current authenticated user

    Returns:
        New training job created from the previous job's configuration

    Raises:
        HTTPException: If job not found, access denied, or job is still running
    """
    # Get the original job
    original_job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()

    if not original_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training job not found"
        )

    if original_job.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Don't allow restarting jobs that are still running
    if original_job.status in ["pending", "preparing", "training"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot restart a job that is still running. Cancel it first."
        )

    # Get the trained model from the original job (if it completed successfully)
    resume_from_model = None
    if original_job.model_id:
        trained_model = db.query(TrainedModel).filter(TrainedModel.id == original_job.model_id).first()
        if trained_model and trained_model.model_path:
            resume_from_model = trained_model.model_path
            logger.info(f"Restart will continue from previous model: {resume_from_model}")

    # Create new job with same configuration, but add resume model path
    new_config = original_job.config.copy()
    if resume_from_model:
        new_config['resume_from_model'] = resume_from_model

    new_job = TrainingJob(
        name=f"{original_job.name} (Restart)",
        description=original_job.description,
        task_type=original_job.task_type,
        config=new_config,
        total_epochs=original_job.total_epochs,
        created_by=current_user.id,
        status="pending"
    )

    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    # Trigger Celery task to start training
    from app.tasks.training_tasks import train_model
    task = train_model.delay(str(new_job.id))

    # Store the Celery task ID for cancellation
    new_job.celery_task_id = task.id
    db.commit()

    logger.info(f"Restarted training job {job_id} as new job {new_job.id}")

    return TrainingJobResponse(
        id=new_job.id,
        name=new_job.name,
        description=new_job.description,
        task_type=new_job.task_type,
        status=new_job.status,
        current_epoch=new_job.current_epoch,
        total_epochs=new_job.total_epochs,
        progress_percent=new_job.progress_percent,
        created_at=new_job.created_at,
        started_at=new_job.started_at,
        completed_at=new_job.completed_at,
        created_by=new_job.created_by
    )


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_training_job(
    job_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cancel/delete training job

    Args:
        job_id: Training job UUID
        db: Database session
        current_user: Current authenticated user

    Raises:
        HTTPException: If job not found or access denied
    """
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training job not found"
        )

    if job.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # If training is in progress, cancel it
    if job.status in ["preparing", "training"]:
        # Revoke the Celery task if task ID is available
        if job.celery_task_id:
            from app.core.celery_app import celery_app
            # Terminate the task immediately
            celery_app.control.revoke(job.celery_task_id, terminate=True, signal='SIGKILL')
            logger.info(f"Revoked Celery task {job.celery_task_id} for job {job_id}")

        # Update job status
        job.status = "cancelled"
        job.completed_at = datetime.utcnow()
        job.error_message = "Training cancelled by user"
        db.commit()
    else:
        # Delete completed/failed/cancelled jobs
        db.delete(job)
        db.commit()

    return None


@router.get("/jobs/{job_id}/metrics", response_model=List[TrainingMetricResponse])
def get_training_metrics(
    job_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all metrics for a training job

    Args:
        job_id: Training job UUID
        db: Database session
        current_user: Current authenticated user

    Returns:
        List of training metrics by epoch

    Raises:
        HTTPException: If job not found or access denied
    """
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training job not found"
        )

    if job.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    metrics = db.query(TrainingMetric).filter(
        TrainingMetric.training_job_id == job_id
    ).order_by(TrainingMetric.epoch).all()

    return [
        TrainingMetricResponse(
            epoch=metric.epoch,
            train_loss=metric.train_loss,
            val_loss=metric.val_loss,
            metrics=metric.metrics,
            epoch_time_seconds=metric.epoch_time_seconds,
            timestamp=metric.timestamp
        )
        for metric in metrics
    ]


# ===== Trained Model Routes =====

@router.get("/models", response_model=List[TrainedModelResponse])
def get_trained_models(
    skip: int = 0,
    limit: int = 100,
    task_type: str = None,
    is_active: bool = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all trained models (available to all users)

    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        task_type: Filter by task type (optional)
        is_active: Filter by active status (optional)
        db: Database session
        current_user: Current authenticated user

    Returns:
        List of trained models
    """
    query = db.query(TrainedModel)

    if task_type:
        query = query.filter(TrainedModel.task_type == task_type)
    if is_active is not None:
        query = query.filter(TrainedModel.is_active == is_active)

    models = query.order_by(desc(TrainedModel.created_at)).offset(skip).limit(limit).all()

    return [
        TrainedModelResponse(
            id=model.id,
            name=model.name,
            description=model.description,
            task_type=model.task_type,
            model_type=model.model_type,
            image_size=model.image_size,
            num_classes=model.num_classes,
            classes=model.classes,
            performance_metrics=model.performance_metrics,
            is_active=model.is_active,
            created_at=model.created_at,
            created_by=model.created_by
        )
        for model in models
    ]


@router.get("/models/{model_id}", response_model=TrainedModelDetail)
def get_trained_model(
    model_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get trained model by ID

    Args:
        model_id: Trained model UUID
        db: Database session
        current_user: Current authenticated user

    Returns:
        Trained model details

    Raises:
        HTTPException: If model not found or access denied
    """
    model = db.query(TrainedModel).filter(TrainedModel.id == model_id).first()

    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trained model not found"
        )

    if model.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return TrainedModelDetail(
        id=model.id,
        name=model.name,
        description=model.description,
        task_type=model.task_type,
        model_type=model.model_type,
        image_size=model.image_size,
        num_classes=model.num_classes,
        classes=model.classes,
        performance_metrics=model.performance_metrics,
        is_active=model.is_active,
        created_at=model.created_at,
        created_by=model.created_by,
        training_job_id=model.training_job_id,
        model_path=model.model_path
    )


@router.get("/models/{model_id}/download")
def download_trained_model(
    model_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Download trained model file

    Args:
        model_id: Trained model UUID
        db: Database session
        current_user: Current authenticated user

    Returns:
        Model file for download

    Raises:
        HTTPException: If model not found, access denied, or file doesn't exist
    """
    model = db.query(TrainedModel).filter(TrainedModel.id == model_id).first()

    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trained model not found"
        )

    # Any authenticated user can download any model
    logger.info(f"User {current_user.id} downloading model {model_id}")

    # Check if model file exists
    if not model.model_path or not os.path.exists(model.model_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model file not found on server"
        )

    # Generate filename from model name
    filename = f"{model.name.replace(' ', '_')}.pt"

    return FileResponse(
        path=model.model_path,
        media_type="application/octet-stream",
        filename=filename
    )


@router.patch("/models/{model_id}/activate", response_model=TrainedModelResponse)
def activate_model(
    model_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Activate a trained model (deactivates others of same task type)

    Args:
        model_id: Trained model UUID
        db: Database session
        current_user: Current authenticated user

    Returns:
        Updated model

    Raises:
        HTTPException: If model not found
    """
    model = db.query(TrainedModel).filter(TrainedModel.id == model_id).first()

    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trained model not found"
        )

    # Deactivate other models of same task type (for all users)
    db.query(TrainedModel).filter(
        TrainedModel.task_type == model.task_type,
        TrainedModel.id != model_id
    ).update({"is_active": False})

    # Activate this model
    model.is_active = True
    db.commit()
    db.refresh(model)

    return TrainedModelResponse(
        id=model.id,
        name=model.name,
        description=model.description,
        task_type=model.task_type,
        model_type=model.model_type,
        image_size=model.image_size,
        num_classes=model.num_classes,
        classes=model.classes,
        performance_metrics=model.performance_metrics,
        is_active=model.is_active,
        created_at=model.created_at,
        created_by=model.created_by
    )


@router.delete("/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_model(
    model_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a trained model (available to all users)

    Args:
        model_id: Trained model UUID
        db: Database session
        current_user: Current authenticated user

    Raises:
        HTTPException: If model not found
    """
    model = db.query(TrainedModel).filter(TrainedModel.id == model_id).first()

    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trained model not found"
        )

    # TODO: Delete model file from disk
    # import os
    # if os.path.exists(model.model_path):
    #     os.remove(model.model_path)

    db.delete(model)
    db.commit()

    return None


# ===== Inference Routes =====

@router.post("/models/{model_id}/predict", response_model=Dict[str, Any])
def predict_with_model(
    model_id: UUID,
    request: InferenceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Run inference with a trained model

    Args:
        model_id: Trained model UUID
        request: Inference request with image_id and parameters
        db: Database session
        current_user: Current authenticated user

    Returns:
        Inference results (format depends on task_type)

    Raises:
        HTTPException: If model not found, access denied, or inference fails
    """
    model = db.query(TrainedModel).filter(TrainedModel.id == model_id).first()

    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trained model not found"
        )

    if model.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # TODO: Implement actual inference
    # This is a placeholder that will be implemented in the training service
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Inference endpoint will be implemented with training service"
    )


# ===== WebSocket Routes =====

@router.websocket("/ws/{job_id}")
async def training_websocket(
    websocket: WebSocket,
    job_id: UUID,
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for real-time training progress updates

    Args:
        websocket: WebSocket connection
        job_id: Training job UUID
        db: Database session
    """
    await websocket.accept()

    try:
        # Verify job exists
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if not job:
            await websocket.send_json({
                "type": "error",
                "message": "Training job not found"
            })
            await websocket.close()
            return

        # TODO: This will be implemented with the training service
        # For now, just keep connection open and send heartbeat
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "message": str(e)
        })
        await websocket.close()
