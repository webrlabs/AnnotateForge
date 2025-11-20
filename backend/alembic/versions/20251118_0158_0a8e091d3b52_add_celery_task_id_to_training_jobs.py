"""Add celery_task_id to training_jobs

Revision ID: 0a8e091d3b52
Revises: 0800_add_training
Create Date: 2025-11-18 01:58:39.171161

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0a8e091d3b52'
down_revision: Union[str, None] = '0800_add_training'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add celery_task_id column to training_jobs table
    op.add_column('training_jobs', sa.Column('celery_task_id', sa.String(length=255), nullable=True))


def downgrade() -> None:
    # Remove celery_task_id column from training_jobs table
    op.drop_column('training_jobs', 'celery_task_id')
