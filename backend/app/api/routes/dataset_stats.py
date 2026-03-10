"""Dataset statistics routes"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, cast, Date
from typing import List, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.image import Image
from app.models.annotation import Annotation

router = APIRouter(prefix="/stats", tags=["statistics"])


@router.get("/projects/{project_id}")
def get_project_stats(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get comprehensive statistics for a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Total images
    total_images = db.query(func.count(Image.id)).filter(Image.project_id == project_id).scalar()

    # Image IDs for this project
    image_ids_subquery = db.query(Image.id).filter(Image.project_id == project_id).subquery()

    # Total annotations
    total_annotations = (
        db.query(func.count(Annotation.id))
        .filter(Annotation.image_id.in_(db.query(image_ids_subquery)))
        .scalar()
    )

    # Annotated images (images with at least one annotation)
    annotated_images = (
        db.query(func.count(distinct(Annotation.image_id)))
        .filter(Annotation.image_id.in_(db.query(image_ids_subquery)))
        .scalar()
    )

    # Annotations by type
    by_type_rows = (
        db.query(Annotation.type, func.count(Annotation.id))
        .filter(Annotation.image_id.in_(db.query(image_ids_subquery)))
        .group_by(Annotation.type)
        .all()
    )
    annotations_by_type = {row[0]: row[1] for row in by_type_rows}

    # Annotations by source
    by_source_rows = (
        db.query(Annotation.source, func.count(Annotation.id))
        .filter(Annotation.image_id.in_(db.query(image_ids_subquery)))
        .group_by(Annotation.source)
        .all()
    )
    annotations_by_source = {row[0]: row[1] for row in by_source_rows}

    # Annotations by class
    by_class_rows = (
        db.query(
            func.coalesce(Annotation.class_label, "unlabeled"),
            func.count(Annotation.id),
        )
        .filter(Annotation.image_id.in_(db.query(image_ids_subquery)))
        .group_by(func.coalesce(Annotation.class_label, "unlabeled"))
        .all()
    )
    annotations_by_class = {row[0]: row[1] for row in by_class_rows}

    # Average annotations per image (only annotated images)
    avg_annotations = round(total_annotations / annotated_images, 1) if annotated_images > 0 else 0

    # Per-annotator counts
    by_annotator_rows = (
        db.query(Annotation.created_by, func.count(Annotation.id))
        .filter(Annotation.image_id.in_(db.query(image_ids_subquery)))
        .filter(Annotation.created_by.isnot(None))
        .group_by(Annotation.created_by)
        .all()
    )
    annotations_by_annotator = {str(row[0]): row[1] for row in by_annotator_rows}

    return {
        "total_images": total_images,
        "annotated_images": annotated_images,
        "unannotated_images": total_images - annotated_images,
        "total_annotations": total_annotations,
        "annotations_by_type": annotations_by_type,
        "annotations_by_source": annotations_by_source,
        "annotations_by_class": annotations_by_class,
        "avg_annotations_per_image": avg_annotations,
        "annotations_by_annotator": annotations_by_annotator,
        "project_classes": project.classes or [],
    }


@router.get("/projects/{project_id}/classes")
def get_class_distribution(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed class distribution for a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    image_ids_subquery = db.query(Image.id).filter(Image.project_id == project_id).subquery()

    # Per-class stats: count, unique image count, avg confidence
    class_rows = (
        db.query(
            func.coalesce(Annotation.class_label, "unlabeled"),
            func.count(Annotation.id),
            func.count(distinct(Annotation.image_id)),
            func.avg(Annotation.confidence),
            func.min(Annotation.confidence),
            func.max(Annotation.confidence),
        )
        .filter(Annotation.image_id.in_(db.query(image_ids_subquery)))
        .group_by(func.coalesce(Annotation.class_label, "unlabeled"))
        .all()
    )

    classes = []
    for row in class_rows:
        classes.append({
            "class_label": row[0],
            "annotation_count": row[1],
            "image_count": row[2],
            "avg_confidence": round(row[3], 3) if row[3] is not None else None,
            "min_confidence": round(row[4], 3) if row[4] is not None else None,
            "max_confidence": round(row[5], 3) if row[5] is not None else None,
        })

    # Sort by annotation count descending
    classes.sort(key=lambda x: x["annotation_count"], reverse=True)

    return {"classes": classes, "project_classes": project.classes or []}


@router.get("/projects/{project_id}/timeline")
def get_annotation_timeline(
    project_id: UUID,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get annotation creation timeline for last N days."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    image_ids_subquery = db.query(Image.id).filter(Image.project_id == project_id).subquery()
    since = datetime.utcnow() - timedelta(days=days)

    timeline_rows = (
        db.query(
            cast(Annotation.created_at, Date),
            func.count(Annotation.id),
        )
        .filter(Annotation.image_id.in_(db.query(image_ids_subquery)))
        .filter(Annotation.created_at >= since)
        .group_by(cast(Annotation.created_at, Date))
        .order_by(cast(Annotation.created_at, Date))
        .all()
    )

    timeline = [
        {"date": row[0].isoformat(), "count": row[1]}
        for row in timeline_rows
    ]

    return {"timeline": timeline, "days": days}


@router.get("/projects/{project_id}/coverage")
def get_annotation_coverage(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get annotation coverage stats - which images are annotated and how densely."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Per-image annotation count distribution
    image_ids_subquery = db.query(Image.id).filter(Image.project_id == project_id).subquery()

    per_image_counts = (
        db.query(
            Annotation.image_id,
            func.count(Annotation.id).label("count"),
        )
        .filter(Annotation.image_id.in_(db.query(image_ids_subquery)))
        .group_by(Annotation.image_id)
        .all()
    )

    total_images = db.query(func.count(Image.id)).filter(Image.project_id == project_id).scalar()
    counts = [row[1] for row in per_image_counts]

    if counts:
        distribution = {
            "min": min(counts),
            "max": max(counts),
            "avg": round(sum(counts) / len(counts), 1),
            "median": sorted(counts)[len(counts) // 2],
        }
    else:
        distribution = {"min": 0, "max": 0, "avg": 0, "median": 0}

    # Bucket distribution
    buckets = {"0": 0, "1-5": 0, "6-10": 0, "11-20": 0, "21-50": 0, "50+": 0}
    annotated_ids = {row[0] for row in per_image_counts}
    buckets["0"] = total_images - len(annotated_ids)
    for c in counts:
        if c <= 5:
            buckets["1-5"] += 1
        elif c <= 10:
            buckets["6-10"] += 1
        elif c <= 20:
            buckets["11-20"] += 1
        elif c <= 50:
            buckets["21-50"] += 1
        else:
            buckets["50+"] += 1

    return {
        "total_images": total_images,
        "annotated_images": len(annotated_ids),
        "distribution": distribution,
        "buckets": buckets,
    }
