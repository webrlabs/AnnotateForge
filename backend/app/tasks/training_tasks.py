"""Training-related Celery tasks"""
from celery import Task
from celery.signals import task_prerun, task_postrun, task_failure
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime
import logging
import traceback

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.training import TrainingJob, TrainedModel, TrainingMetric, TrainingDataset

logger = logging.getLogger(__name__)


class DatabaseTask(Task):
    """Base task that provides database session"""
    _db: Session = None

    @property
    def db(self):
        if self._db is None:
            self._db = SessionLocal()
        return self._db

    def after_return(self, *args, **kwargs):
        if self._db is not None:
            self._db.close()
            self._db = None


@task_prerun.connect
def task_prerun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, **extra):
    """Log task start"""
    logger.info(f"Task {task.name} [{task_id}] starting with args={args} kwargs={kwargs}")


@task_postrun.connect
def task_postrun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, retval=None, **extra):
    """Log task completion"""
    logger.info(f"Task {task.name} [{task_id}] completed successfully")


@task_failure.connect
def task_failure_handler(sender=None, task_id=None, exception=None, args=None, kwargs=None, traceback=None, einfo=None, **extra):
    """Log task failure"""
    logger.error(f"Task {sender.name} [{task_id}] failed: {exception}")
    logger.error(f"Traceback: {einfo}")


@celery_app.task(base=DatabaseTask, bind=True, name="app.tasks.training_tasks.train_model")
def train_model(self, job_id: str):
    """
    Train a model using the specified training job configuration

    Args:
        job_id: UUID of the training job (as string)

    Returns:
        dict: Training results including model_id and final metrics
    """
    job_uuid = UUID(job_id)
    db = self.db

    try:
        # Get training job
        job = db.query(TrainingJob).filter(TrainingJob.id == job_uuid).first()
        if not job:
            raise ValueError(f"Training job {job_id} not found")

        # Update status to preparing
        job.status = "preparing"
        job.started_at = datetime.utcnow()
        db.commit()

        logger.info(f"Starting training job {job_id}: {job.name}")
        logger.info(f"Task type: {job.task_type}")
        logger.info(f"Config: {job.config}")

        # TODO: This will be implemented with the training service
        # For now, just update status to show Celery is working

        # Simulate different stages
        from time import sleep

        # Stage 1: Data preparation
        logger.info("Preparing dataset...")
        job.status = "preparing"
        job.progress_percent = 10.0
        db.commit()
        sleep(2)

        # Stage 2: Training
        logger.info("Training model...")
        job.status = "training"
        job.progress_percent = 20.0
        db.commit()

        # Call the training service
        from app.services.training_service import TrainingService
        from app.core.config import settings

        training_service = TrainingService(db, storage_dir=settings.UPLOAD_DIR)
        result = training_service.train(job)

        return {
            "job_id": str(job.id),
            "status": "completed",
            "model_id": result["model_id"],
            "final_metrics": result["final_metrics"]
        }

    except Exception as e:
        # Update job status to failed
        logger.error(f"Training job {job_id} failed: {e}")
        logger.error(traceback.format_exc())

        job = db.query(TrainingJob).filter(TrainingJob.id == job_uuid).first()
        if job:
            job.status = "failed"
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            db.commit()

        raise


@celery_app.task(name="app.tasks.training_tasks.cancel_training")
def cancel_training(job_id: str):
    """
    Cancel a running training job

    Args:
        job_id: UUID of the training job (as string)
    """
    job_uuid = UUID(job_id)
    db = SessionLocal()

    try:
        job = db.query(TrainingJob).filter(TrainingJob.id == job_uuid).first()
        if not job:
            logger.warning(f"Training job {job_id} not found for cancellation")
            return

        if job.status in ["preparing", "training"]:
            job.status = "cancelled"
            job.completed_at = datetime.utcnow()
            db.commit()
            logger.info(f"Training job {job_id} cancelled")

    except Exception as e:
        logger.error(f"Error cancelling training job {job_id}: {e}")
        raise
    finally:
        db.close()


@celery_app.task(name="app.tasks.training_tasks.cleanup_old_jobs")
def cleanup_old_jobs(days: int = 30):
    """
    Clean up old completed/failed training jobs

    Args:
        days: Delete jobs older than this many days (default 30)
    """
    from datetime import timedelta

    db = SessionLocal()

    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        # Delete old completed/failed/cancelled jobs
        deleted = db.query(TrainingJob).filter(
            TrainingJob.status.in_(["completed", "failed", "cancelled"]),
            TrainingJob.completed_at < cutoff_date
        ).delete(synchronize_session=False)

        db.commit()
        logger.info(f"Cleaned up {deleted} old training jobs")

        return {"deleted": deleted}

    except Exception as e:
        logger.error(f"Error cleaning up old jobs: {e}")
        db.rollback()
        raise
    finally:
        db.close()
