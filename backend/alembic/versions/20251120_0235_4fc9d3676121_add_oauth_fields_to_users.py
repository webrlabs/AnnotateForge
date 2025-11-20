"""Add OAuth fields to users

Revision ID: 4fc9d3676121
Revises: 0def7bb27116
Create Date: 2025-11-20 02:35:18.474001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '4fc9d3676121'
down_revision: Union[str, None] = '0def7bb27116'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add OAuth fields to users table
    op.add_column('users', sa.Column('oauth_provider', sa.String(length=50), nullable=True))
    op.add_column('users', sa.Column('oauth_id', sa.String(length=255), nullable=True))
    op.alter_column('users', 'hashed_password',
               existing_type=sa.VARCHAR(length=255),
               nullable=True)


def downgrade() -> None:
    # Remove OAuth fields from users table
    op.alter_column('users', 'hashed_password',
               existing_type=sa.VARCHAR(length=255),
               nullable=False)
    op.drop_column('users', 'oauth_id')
    op.drop_column('users', 'oauth_provider')
