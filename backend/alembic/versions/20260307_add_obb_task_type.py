"""add obb task type to training models

Revision ID: 9a4b3c2d5e6f
Revises: 8f3a2b1c4d5e
Create Date: 2026-03-07

"""
from alembic import op
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = "9a4b3c2d5e6f"
down_revision = "8f3a2b1c4d5e"
branch_labels = None
depends_on = None


def upgrade():
    # Update training_jobs task_type constraint
    op.execute(text(
        "ALTER TABLE training_jobs DROP CONSTRAINT IF EXISTS check_task_type"
    ))
    op.execute(text(
        "ALTER TABLE training_jobs ADD CONSTRAINT check_task_type "
        "CHECK (task_type IN ('classify', 'detect', 'segment', 'obb'))"
    ))

    # Update trained_models task_type constraint
    op.execute(text(
        "ALTER TABLE trained_models DROP CONSTRAINT IF EXISTS check_model_task_type"
    ))
    op.execute(text(
        "ALTER TABLE trained_models ADD CONSTRAINT check_model_task_type "
        "CHECK (task_type IN ('classify', 'detect', 'segment', 'obb'))"
    ))


def downgrade():
    op.execute(text(
        "ALTER TABLE training_jobs DROP CONSTRAINT IF EXISTS check_task_type"
    ))
    op.execute(text(
        "ALTER TABLE training_jobs ADD CONSTRAINT check_task_type "
        "CHECK (task_type IN ('classify', 'detect', 'segment'))"
    ))

    op.execute(text(
        "ALTER TABLE trained_models DROP CONSTRAINT IF EXISTS check_model_task_type"
    ))
    op.execute(text(
        "ALTER TABLE trained_models ADD CONSTRAINT check_model_task_type "
        "CHECK (task_type IN ('classify', 'detect', 'segment'))"
    ))
