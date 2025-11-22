"""add_project_permissions

Revision ID: add_project_permissions
Revises: 4fc9d3676121
Create Date: 2025-11-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'add_project_permissions'
down_revision: Union[str, None] = '4fc9d3676121'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add owner_id and is_public columns to projects table
    op.add_column('projects', sa.Column('owner_id', UUID(as_uuid=True), nullable=True))
    op.add_column('projects', sa.Column('is_public', sa.Boolean(), nullable=False, server_default='false'))

    # Create foreign key constraint for owner_id
    op.create_foreign_key('fk_projects_owner_id', 'projects', 'users', ['owner_id'], ['id'])

    # Create index on owner_id for faster queries
    op.create_index('idx_projects_owner_id', 'projects', ['owner_id'])

    # Create project_members table
    op.create_table(
        'project_members',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
    )

    # Create indexes for project_members
    op.create_index('idx_project_members_project_id', 'project_members', ['project_id'])
    op.create_index('idx_project_members_user_id', 'project_members', ['user_id'])

    # Create unique constraint to prevent duplicate memberships
    op.create_unique_constraint('uq_project_members_project_user', 'project_members', ['project_id', 'user_id'])


def downgrade() -> None:
    # Drop project_members table and its indexes
    op.drop_constraint('uq_project_members_project_user', 'project_members', type_='unique')
    op.drop_index('idx_project_members_user_id', table_name='project_members')
    op.drop_index('idx_project_members_project_id', table_name='project_members')
    op.drop_table('project_members')

    # Drop columns from projects table
    op.drop_index('idx_projects_owner_id', table_name='projects')
    op.drop_constraint('fk_projects_owner_id', 'projects', type_='foreignkey')
    op.drop_column('projects', 'is_public')
    op.drop_column('projects', 'owner_id')
