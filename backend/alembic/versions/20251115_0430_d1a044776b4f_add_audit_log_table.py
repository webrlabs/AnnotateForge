"""add_audit_log_table

Revision ID: d1a044776b4f
Revises: a0ec147819fe
Create Date: 2025-11-15 04:30:53.905762

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET


# revision identifiers, used by Alembic.
revision: str = 'd1a044776b4f'
down_revision: Union[str, None] = 'a0ec147819fe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create audit_log table
    op.create_table(
        'audit_log',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('user_id', UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('resource_type', sa.String(length=50), nullable=False),
        sa.Column('resource_id', UUID(as_uuid=True), nullable=False),
        sa.Column('changes', JSONB, nullable=True),
        sa.Column('ip_address', INET, nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], )
    )

    # Create indexes
    op.create_index('idx_audit_log_user_id', 'audit_log', ['user_id'])
    op.create_index('idx_audit_log_timestamp', 'audit_log', ['timestamp'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_audit_log_timestamp', table_name='audit_log')
    op.drop_index('idx_audit_log_user_id', table_name='audit_log')

    # Drop table
    op.drop_table('audit_log')
