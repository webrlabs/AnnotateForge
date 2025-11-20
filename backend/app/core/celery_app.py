"""Celery configuration and app instance"""
from celery import Celery
from app.core.config import settings

# Create Celery app
celery_app = Celery(
    "labelflow",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.training_tasks"
    ]
)

# Configure Celery
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Result settings
    result_expires=3600,  # 1 hour
    result_persistent=True,

    # Task routing
    task_routes={
        "app.tasks.training_tasks.*": {"queue": "training"},
    },

    # Worker settings
    worker_prefetch_multiplier=1,  # Only fetch one task at a time
    worker_max_tasks_per_child=50,  # Restart worker after 50 tasks (increased for long training)

    # Task time limits
    task_time_limit=86400,  # 24 hours hard limit
    task_soft_time_limit=82800,  # 23 hours soft limit

    # Task acknowledgment - acknowledge immediately for long-running tasks
    # This prevents duplicate task execution if worker restarts during training
    task_acks_late=False,  # Acknowledge task immediately when started
    task_reject_on_worker_lost=False,  # Don't requeue if worker dies (task already started)
)

# Optional: Configure task events for monitoring
celery_app.conf.task_send_sent_event = True
celery_app.conf.worker_send_task_events = True
