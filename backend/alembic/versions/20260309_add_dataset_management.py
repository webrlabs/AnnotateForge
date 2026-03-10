"""add dataset versioning, splits, and duplicate detection

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
Create Date: 2026-03-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision = "c8d9e0f1a2b3"
down_revision = "b7c8d9e0f1a2"
branch_labels = None
depends_on = None


def upgrade():
    # Dataset Versions
    op.create_table(
        "dataset_versions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("annotation_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("class_counts", JSONB, nullable=False, server_default="{}"),
        sa.Column("split_config", JSONB, nullable=True),
        sa.Column("parent_version_id", UUID(as_uuid=True), sa.ForeignKey("dataset_versions.id"), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("project_id", "version_number", name="uq_project_version_number"),
    )
    op.create_index("idx_dataset_versions_project_id", "dataset_versions", ["project_id"])

    # Dataset Version Images (frozen snapshots)
    op.create_table(
        "dataset_version_images",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("version_id", UUID(as_uuid=True), sa.ForeignKey("dataset_versions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("image_id", UUID(as_uuid=True), sa.ForeignKey("images.id", ondelete="CASCADE"), nullable=False),
        sa.Column("split", sa.String(10), nullable=False, server_default="train"),
        sa.Column("annotation_snapshot", JSONB, nullable=False, server_default="[]"),
        sa.CheckConstraint("split IN ('train', 'val', 'test')", name="valid_split"),
    )
    op.create_index("idx_dvi_version_id", "dataset_version_images", ["version_id"])
    op.create_index("idx_dvi_image_id", "dataset_version_images", ["image_id"])

    # Dataset Splits (per-project split configuration)
    op.create_table(
        "dataset_splits",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("train_ratio", sa.Float(), nullable=False, server_default="0.7"),
        sa.Column("val_ratio", sa.Float(), nullable=False, server_default="0.15"),
        sa.Column("test_ratio", sa.Float(), nullable=False, server_default="0.15"),
        sa.Column("random_seed", sa.Integer(), nullable=False, server_default="42"),
        sa.Column("stratify_by_class", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("assignments", JSONB, nullable=False, server_default="{}"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Add phash column to images for duplicate detection
    op.add_column("images", sa.Column("phash", sa.String(64), nullable=True))


def downgrade():
    op.drop_column("images", "phash")
    op.drop_table("dataset_splits")
    op.drop_index("idx_dvi_image_id", table_name="dataset_version_images")
    op.drop_index("idx_dvi_version_id", table_name="dataset_version_images")
    op.drop_table("dataset_version_images")
    op.drop_index("idx_dataset_versions_project_id", table_name="dataset_versions")
    op.drop_table("dataset_versions")
