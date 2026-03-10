"""add annotation_templates table

Revision ID: b7c8d9e0f1a2
Revises: 9a4b3c2d5e6f
Create Date: 2026-03-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision = "b7c8d9e0f1a2"
down_revision = "9a4b3c2d5e6f"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "annotation_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("annotations", JSONB, nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_annotation_templates_project_id", "annotation_templates", ["project_id"])


def downgrade():
    op.drop_index("idx_annotation_templates_project_id", table_name="annotation_templates")
    op.drop_table("annotation_templates")
