"""Annotation template routes"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.template import AnnotationTemplate
from app.schemas.template import TemplateCreate, TemplateUpdate, TemplateResponse

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/projects/{project_id}/templates", response_model=List[TemplateResponse])
def get_project_templates(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all annotation templates for a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    templates = db.query(AnnotationTemplate).filter(
        AnnotationTemplate.project_id == project_id
    ).order_by(AnnotationTemplate.created_at.desc()).all()
    return templates


@router.post("/projects/{project_id}/templates", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    project_id: UUID,
    template_data: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create an annotation template from provided annotations"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    template = AnnotationTemplate(
        project_id=project_id,
        name=template_data.name,
        description=template_data.description,
        annotations=template_data.annotations,
        created_by=current_user.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single annotation template"""
    template = db.query(AnnotationTemplate).filter(AnnotationTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: UUID,
    template_data: TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an annotation template"""
    template = db.query(AnnotationTemplate).filter(AnnotationTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    update_data = template_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an annotation template"""
    template = db.query(AnnotationTemplate).filter(AnnotationTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    db.delete(template)
    db.commit()
