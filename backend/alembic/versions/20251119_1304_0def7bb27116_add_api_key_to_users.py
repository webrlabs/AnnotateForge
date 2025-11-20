"""Add api_key to users

Revision ID: 0def7bb27116
Revises: 0a8e091d3b52
Create Date: 2025-11-19 13:04:56.657111

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0def7bb27116'
down_revision: Union[str, None] = '0a8e091d3b52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add api_key column to users table
    op.add_column('users', sa.Column('api_key', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_users_api_key'), 'users', ['api_key'], unique=True)


def downgrade() -> None:
    # Remove api_key column from users table
    op.drop_index(op.f('ix_users_api_key'), table_name='users')
    op.drop_column('users', 'api_key')
