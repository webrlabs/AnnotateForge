"""
Celery worker entry point

Usage:
    celery -A celery_worker.celery_app worker --loglevel=info --queues=training
"""
from app.core.celery_app import celery_app

if __name__ == "__main__":
    celery_app.start()
