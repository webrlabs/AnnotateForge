"""Project routes"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.permissions import ProjectPermissions
from app.models.user import User
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.image import Image
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectMemberCreate, ProjectMemberUpdate, ProjectMemberResponse

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/", response_model=List[ProjectResponse])
def get_projects(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all projects the user can view

    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        db: Database session
        current_user: Current authenticated user

    Returns:
        List of projects (owned, public, or where user is a member)
    """
    # Get member project IDs
    member_project_ids = db.query(ProjectMember.project_id).filter(
        ProjectMember.user_id == current_user.id
    ).subquery()

    # Filter projects: owned by user, public, or user is a member
    projects = db.query(Project).filter(
        or_(
            Project.owner_id == current_user.id,
            Project.is_public == True,
            Project.id.in_(member_project_ids)
        )
    ).offset(skip).limit(limit).all()

    # Add image count, thumbnails, and permission info to each project
    result = []
    for project in projects:
        # Get first 4 thumbnails for preview
        representative_images = db.query(Image.thumbnail_path).filter(
            Image.project_id == project.id
        ).limit(4).all()
        thumbnails = [img[0] for img in representative_images if img[0]]

        # Get member count
        member_count = db.query(func.count(ProjectMember.id)).filter(
            ProjectMember.project_id == project.id
        ).scalar()

        project_dict = {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "classes": project.classes or [],
            "owner_id": project.owner_id,
            "is_public": project.is_public,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "image_count": db.query(func.count(Image.id)).filter(Image.project_id == project.id).scalar(),
            "thumbnails": thumbnails,
            "can_edit": ProjectPermissions.can_edit_project(project, current_user, db),
            "can_manage_members": ProjectPermissions.can_manage_project(project, current_user),
            "member_count": member_count
        }
        result.append(ProjectResponse(**project_dict))

    return result


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project_data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new project

    Args:
        project_data: Project creation data
        db: Database session
        current_user: Current authenticated user

    Returns:
        Created project
    """
    # Create project with current user as owner
    project_dict = project_data.model_dump()
    project_dict['owner_id'] = current_user.id
    project = Project(**project_dict)
    db.add(project)
    db.commit()
    db.refresh(project)

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        classes=project.classes or [],
        owner_id=project.owner_id,
        is_public=project.is_public,
        created_at=project.created_at,
        updated_at=project.updated_at,
        image_count=0,
        thumbnails=[],
        can_edit=True,
        can_manage_members=True,
        member_count=0
    )


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get project by ID

    Args:
        project_id: Project UUID
        db: Database session
        current_user: Current authenticated user

    Returns:
        Project details

    Raises:
        HTTPException: If project not found or no permission
    """
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Check view permission
    ProjectPermissions.require_view_permission(project, current_user, db)

    image_count = db.query(func.count(Image.id)).filter(Image.project_id == project_id).scalar()

    # Get first 4 thumbnails for preview
    representative_images = db.query(Image.thumbnail_path).filter(
        Image.project_id == project_id
    ).limit(4).all()
    thumbnails = [img[0] for img in representative_images if img[0]]

    # Get member count
    member_count = db.query(func.count(ProjectMember.id)).filter(
        ProjectMember.project_id == project.id
    ).scalar()

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        classes=project.classes or [],
        owner_id=project.owner_id,
        is_public=project.is_public,
        created_at=project.created_at,
        updated_at=project.updated_at,
        image_count=image_count,
        thumbnails=thumbnails,
        can_edit=ProjectPermissions.can_edit_project(project, current_user, db),
        can_manage_members=ProjectPermissions.can_manage_project(project, current_user),
        member_count=member_count
    )


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update project settings

    Args:
        project_id: Project UUID
        project_data: Project update data
        db: Database session
        current_user: Current authenticated user

    Returns:
        Updated project

    Raises:
        HTTPException: If project not found or no permission
    """
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Require manage permission (only owner can update project settings)
    ProjectPermissions.require_manage_permission(project, current_user)

    # Update fields
    update_data = project_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)

    image_count = db.query(func.count(Image.id)).filter(Image.project_id == project_id).scalar()

    # Get first 4 thumbnails for preview
    representative_images = db.query(Image.thumbnail_path).filter(
        Image.project_id == project_id
    ).limit(4).all()
    thumbnails = [img[0] for img in representative_images if img[0]]

    # Get member count
    member_count = db.query(func.count(ProjectMember.id)).filter(
        ProjectMember.project_id == project.id
    ).scalar()

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        classes=project.classes or [],
        owner_id=project.owner_id,
        is_public=project.is_public,
        created_at=project.created_at,
        updated_at=project.updated_at,
        image_count=image_count,
        thumbnails=thumbnails,
        can_edit=True,
        can_manage_members=True,
        member_count=member_count
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete project

    Args:
        project_id: Project UUID
        db: Database session
        current_user: Current authenticated user

    Raises:
        HTTPException: If project not found or no permission
    """
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Only owner can delete project
    ProjectPermissions.require_manage_permission(project, current_user)

    db.delete(project)
    db.commit()

    return None


# ===== Project Member Management Routes =====

@router.get("/{project_id}/members", response_model=List[ProjectMemberResponse])
def get_project_members(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all members of a project

    Args:
        project_id: Project UUID
        db: Database session
        current_user: Current authenticated user

    Returns:
        List of project members

    Raises:
        HTTPException: If project not found or no permission
    """
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Only owner can view members list
    ProjectPermissions.require_manage_permission(project, current_user)

    members = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id
    ).all()

    result = []
    for member in members:
        result.append(ProjectMemberResponse(
            id=member.id,
            user_id=member.user_id,
            username=member.user.username,
            email=member.user.email,
            role=member.role,
            created_at=member.created_at
        ))

    return result


@router.post("/{project_id}/members", response_model=ProjectMemberResponse, status_code=status.HTTP_201_CREATED)
def add_project_member(
    project_id: UUID,
    member_data: ProjectMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a member to a project

    Args:
        project_id: Project UUID
        member_data: Member data (user_id and role)
        db: Database session
        current_user: Current authenticated user

    Returns:
        Created project member

    Raises:
        HTTPException: If project not found, no permission, or member already exists
    """
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Only owner can add members
    ProjectPermissions.require_manage_permission(project, current_user)

    # Look up user by ID or email
    if member_data.user_id:
        user = db.query(User).filter(User.id == member_data.user_id).first()
    elif member_data.email:
        user = db.query(User).filter(User.email == member_data.email).first()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either user_id or email must be provided"
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check if already a member
    existing = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user.id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this project"
        )

    # Create member
    member = ProjectMember(
        project_id=project_id,
        user_id=user.id,
        role=member_data.role
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    return ProjectMemberResponse(
        id=member.id,
        user_id=member.user_id,
        username=user.username,
        email=user.email,
        role=member.role,
        created_at=member.created_at
    )


@router.put("/{project_id}/members/{member_id}", response_model=ProjectMemberResponse)
def update_project_member(
    project_id: UUID,
    member_id: UUID,
    member_data: ProjectMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a project member's role

    Args:
        project_id: Project UUID
        member_id: Member UUID
        member_data: Updated role data
        db: Database session
        current_user: Current authenticated user

    Returns:
        Updated project member

    Raises:
        HTTPException: If project or member not found, or no permission
    """
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Only owner can update member roles
    ProjectPermissions.require_manage_permission(project, current_user)

    member = db.query(ProjectMember).filter(
        ProjectMember.id == member_id,
        ProjectMember.project_id == project_id
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project member not found"
        )

    # Update role
    member.role = member_data.role
    db.commit()
    db.refresh(member)

    return ProjectMemberResponse(
        id=member.id,
        user_id=member.user_id,
        username=member.user.username,
        email=member.user.email,
        role=member.role,
        created_at=member.created_at
    )


@router.delete("/{project_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_project_member(
    project_id: UUID,
    member_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove a member from a project

    Args:
        project_id: Project UUID
        member_id: Member UUID
        db: Database session
        current_user: Current authenticated user

    Raises:
        HTTPException: If project or member not found, or no permission
    """
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Only owner can remove members
    ProjectPermissions.require_manage_permission(project, current_user)

    member = db.query(ProjectMember).filter(
        ProjectMember.id == member_id,
        ProjectMember.project_id == project_id
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project member not found"
        )

    db.delete(member)
    db.commit()

    return None
