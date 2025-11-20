"""Project routes"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.image import Image
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/", response_model=List[ProjectResponse])
def get_projects(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all projects

    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        db: Database session
        current_user: Current authenticated user

    Returns:
        List of projects
    """
    projects = db.query(Project).offset(skip).limit(limit).all()

    # Add image count and thumbnails to each project
    result = []
    for project in projects:
        # Get first 4 thumbnails for preview
        representative_images = db.query(Image.thumbnail_path).filter(
            Image.project_id == project.id
        ).limit(4).all()
        thumbnails = [img[0] for img in representative_images if img[0]]

        project_dict = {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "classes": project.classes or [],
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "image_count": db.query(func.count(Image.id)).filter(Image.project_id == project.id).scalar(),
            "thumbnails": thumbnails
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
    project = Project(**project_data.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        classes=project.classes or [],
        created_at=project.created_at,
        updated_at=project.updated_at,
        image_count=0,
        thumbnails=[]
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
        HTTPException: If project not found
    """
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    image_count = db.query(func.count(Image.id)).filter(Image.project_id == project_id).scalar()

    # Get first 4 thumbnails for preview
    representative_images = db.query(Image.thumbnail_path).filter(
        Image.project_id == project_id
    ).limit(4).all()
    thumbnails = [img[0] for img in representative_images if img[0]]

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        classes=project.classes or [],
        created_at=project.created_at,
        updated_at=project.updated_at,
        image_count=image_count,
        thumbnails=thumbnails
    )


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update project

    Args:
        project_id: Project UUID
        project_data: Project update data
        db: Database session
        current_user: Current authenticated user

    Returns:
        Updated project

    Raises:
        HTTPException: If project not found
    """
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

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

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        classes=project.classes or [],
        created_at=project.created_at,
        updated_at=project.updated_at,
        image_count=image_count,
        thumbnails=thumbnails
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
        HTTPException: If project not found
    """
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    db.delete(project)
    db.commit()

    return None
