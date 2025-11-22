"""Permission checking utilities for projects"""
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.project import Project
from app.models.project_member import ProjectMember, MemberRole
from app.models.user import User


class ProjectPermissions:
    """Permission checker for project operations"""

    @staticmethod
    def can_view_project(project: Project, user: User, db: Session) -> bool:
        """
        Check if user can view a project.

        Rules:
        - Owner can always view
        - Public projects can be viewed by any authenticated user
        - Private projects can only be viewed by owner and members
        """
        # Owner can always view
        if project.owner_id == user.id:
            return True

        # Public projects are viewable by anyone
        if project.is_public:
            return True

        # Check if user is a member
        member = db.query(ProjectMember).filter(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user.id
        ).first()

        return member is not None

    @staticmethod
    def can_edit_project(project: Project, user: User, db: Session) -> bool:
        """
        Check if user can edit a project (annotations, images, etc.).

        Rules:
        - Owner can always edit
        - Members with EDITOR role can edit
        - Public projects can be viewed but not edited by non-members
        """
        # Owner can always edit
        if project.owner_id == user.id:
            return True

        # Check member role
        member = db.query(ProjectMember).filter(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user.id
        ).first()

        if member and member.role == MemberRole.EDITOR:
            return True

        return False

    @staticmethod
    def can_manage_project(project: Project, user: User) -> bool:
        """
        Check if user can manage project settings and members.

        Rules:
        - Only owner can manage project
        """
        return project.owner_id == user.id

    @staticmethod
    def require_view_permission(project: Project, user: User, db: Session):
        """Raise HTTPException if user cannot view project"""
        if not ProjectPermissions.can_view_project(project, user, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view this project"
            )

    @staticmethod
    def require_edit_permission(project: Project, user: User, db: Session):
        """Raise HTTPException if user cannot edit project"""
        if not ProjectPermissions.can_edit_project(project, user, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to edit this project"
            )

    @staticmethod
    def require_manage_permission(project: Project, user: User):
        """Raise HTTPException if user cannot manage project"""
        if not ProjectPermissions.can_manage_project(project, user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the project owner can manage settings and members"
            )

    @staticmethod
    def get_user_role(project: Project, user: User, db: Session) -> str:
        """Get user's role in the project (owner, editor, viewer, or none)"""
        if project.owner_id == user.id:
            return "owner"

        member = db.query(ProjectMember).filter(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user.id
        ).first()

        if member:
            return member.role.value

        if project.is_public:
            return "viewer"

        return "none"
