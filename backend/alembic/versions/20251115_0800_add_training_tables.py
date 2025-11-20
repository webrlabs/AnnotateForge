"""add_training_tables

Revision ID: 0800_add_training
Revises: d1a044776b4f
Create Date: 2025-11-15 08:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY


# revision identifiers, used by Alembic.
revision: str = '0800_add_training'
down_revision: Union[str, None] = 'd1a044776b4f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create trained_models table first (no FK dependencies except users)
    op.create_table(
        'trained_models',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('training_job_id', UUID(as_uuid=True), nullable=True),  # FK added later
        sa.Column('name', sa.String(length=255), nullable=False, unique=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('task_type', sa.String(length=50), nullable=False),
        sa.Column('model_path', sa.Text(), nullable=False),
        sa.Column('model_type', sa.String(length=50), nullable=False, server_default='yolov8'),
        sa.Column('image_size', sa.Integer(), nullable=False),
        sa.Column('classes', JSONB, nullable=False),
        sa.Column('num_classes', sa.Integer(), nullable=False),
        sa.Column('performance_metrics', JSONB, nullable=False),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.CheckConstraint(
            "task_type IN ('classify', 'detect', 'segment')",
            name='check_model_task_type'
        ),
    )

    # Create training_jobs table
    op.create_table(
        'training_jobs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('task_type', sa.String(length=50), nullable=False),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('config', JSONB, nullable=False),
        sa.Column('final_metrics', JSONB, nullable=True),
        sa.Column('model_id', UUID(as_uuid=True), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('current_epoch', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_epochs', sa.Integer(), nullable=False),
        sa.Column('progress_percent', sa.Float(), nullable=False, server_default='0.0'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['model_id'], ['trained_models.id']),
        sa.CheckConstraint(
            "task_type IN ('classify', 'detect', 'segment')",
            name='check_task_type'
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'preparing', 'training', 'completed', 'failed', 'cancelled')",
            name='check_status'
        ),
    )

    # Add FK from trained_models to training_jobs
    op.create_foreign_key(
        'fk_trained_models_training_job_id',
        'trained_models',
        'training_jobs',
        ['training_job_id'],
        ['id']
    )

    # Create training_metrics table
    op.create_table(
        'training_metrics',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('training_job_id', UUID(as_uuid=True), nullable=False),
        sa.Column('epoch', sa.Integer(), nullable=False),
        sa.Column('train_loss', sa.Float(), nullable=True),
        sa.Column('val_loss', sa.Float(), nullable=True),
        sa.Column('metrics', JSONB, nullable=False),
        sa.Column('epoch_time_seconds', sa.Float(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(
            ['training_job_id'],
            ['training_jobs.id'],
            ondelete='CASCADE'
        ),
        sa.CheckConstraint(
            'epoch >= 1',
            name='check_epoch_positive'
        ),
    )

    # Create training_datasets table
    op.create_table(
        'training_datasets',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('training_job_id', UUID(as_uuid=True), nullable=False),
        sa.Column('project_ids', ARRAY(UUID(as_uuid=True)), nullable=False),
        sa.Column('total_images', sa.Integer(), nullable=False),
        sa.Column('train_images', sa.Integer(), nullable=False),
        sa.Column('val_images', sa.Integer(), nullable=False),
        sa.Column('class_mapping', JSONB, nullable=False),
        sa.Column('annotation_types', ARRAY(sa.String(length=50)), nullable=False),
        sa.Column('dataset_path', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(
            ['training_job_id'],
            ['training_jobs.id'],
            ondelete='CASCADE'
        ),
    )

    # Create indexes for better query performance
    op.create_index('idx_training_jobs_created_by', 'training_jobs', ['created_by'])
    op.create_index('idx_training_jobs_status', 'training_jobs', ['status'])
    op.create_index('idx_training_jobs_task_type', 'training_jobs', ['task_type'])
    op.create_index('idx_trained_models_created_by', 'trained_models', ['created_by'])
    op.create_index('idx_trained_models_task_type', 'trained_models', ['task_type'])
    op.create_index('idx_trained_models_is_active', 'trained_models', ['is_active'])
    op.create_index('idx_training_metrics_job_id', 'training_metrics', ['training_job_id'])
    op.create_index('idx_training_datasets_job_id', 'training_datasets', ['training_job_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_training_datasets_job_id', table_name='training_datasets')
    op.drop_index('idx_training_metrics_job_id', table_name='training_metrics')
    op.drop_index('idx_trained_models_is_active', table_name='trained_models')
    op.drop_index('idx_trained_models_task_type', table_name='trained_models')
    op.drop_index('idx_trained_models_created_by', table_name='trained_models')
    op.drop_index('idx_training_jobs_task_type', table_name='training_jobs')
    op.drop_index('idx_training_jobs_status', table_name='training_jobs')
    op.drop_index('idx_training_jobs_created_by', table_name='training_jobs')

    # Drop tables in reverse order (respecting FK constraints)
    op.drop_table('training_datasets')
    op.drop_table('training_metrics')

    # Drop FK from trained_models to training_jobs before dropping training_jobs
    op.drop_constraint('fk_trained_models_training_job_id', 'trained_models', type_='foreignkey')

    op.drop_table('training_jobs')
    op.drop_table('trained_models')
