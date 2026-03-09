"""add line annotation type

Revision ID: 8f3a2b1c4d5e
Revises: 0def7bb27116
Create Date: 2026-03-07

"""
from alembic import op
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = "8f3a2b1c4d5e"
down_revision = "add_project_permissions"
branch_labels = None
depends_on = None


def upgrade():
    # Drop old constraint and add new one with 'line' type
    op.execute(text(
        "ALTER TABLE annotations DROP CONSTRAINT IF EXISTS valid_type"
    ))
    op.execute(text(
        "ALTER TABLE annotations ADD CONSTRAINT valid_type "
        "CHECK (type IN ('circle', 'box', 'rectangle', 'polygon', 'line'))"
    ))


def downgrade():
    op.execute(text(
        "ALTER TABLE annotations DROP CONSTRAINT IF EXISTS valid_type"
    ))
    op.execute(text(
        "ALTER TABLE annotations ADD CONSTRAINT valid_type "
        "CHECK (type IN ('circle', 'box', 'rectangle', 'polygon'))"
    ))
