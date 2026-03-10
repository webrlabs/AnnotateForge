"""Dataset versioning and split management routes"""
import random
from collections import defaultdict
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
from app.models.annotation import Annotation
from app.models.dataset_version import DatasetVersion, DatasetVersionImage, DatasetSplit
from app.schemas.dataset import (
    DatasetVersionCreate, DatasetVersionResponse, VersionDiffResponse,
    SplitConfigUpdate, SplitResponse, SplitPreviewResponse,
    DuplicateGroup, DuplicateResponse, DuplicateDeleteRequest,
)

router = APIRouter(prefix="/datasets", tags=["datasets"])


# ============================================================
# Dataset Versioning
# ============================================================

@router.post("/versions/{project_id}", response_model=DatasetVersionResponse, status_code=status.HTTP_201_CREATED)
def create_version(
    project_id: UUID,
    data: DatasetVersionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a frozen snapshot of the current project annotations."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Get next version number
    max_version = (
        db.query(func.max(DatasetVersion.version_number))
        .filter(DatasetVersion.project_id == project_id)
        .scalar()
    )
    version_number = (max_version or 0) + 1

    # Get all images and annotations
    images = db.query(Image).filter(Image.project_id == project_id).all()
    image_ids = [img.id for img in images]

    annotations = (
        db.query(Annotation)
        .filter(Annotation.image_id.in_(image_ids))
        .all()
    ) if image_ids else []

    # Build per-image annotation map
    ann_by_image = defaultdict(list)
    class_counts = defaultdict(int)
    for ann in annotations:
        ann_by_image[ann.image_id].append({
            "id": str(ann.id),
            "type": ann.type,
            "data": ann.data,
            "class_label": ann.class_label,
            "confidence": ann.confidence,
            "source": ann.source,
        })
        label = ann.class_label or "unlabeled"
        class_counts[label] += 1

    # Get split assignments if they exist
    split = db.query(DatasetSplit).filter(DatasetSplit.project_id == project_id).first()
    split_assignments = split.assignments if split else {}

    # Create version
    version = DatasetVersion(
        project_id=project_id,
        version_number=version_number,
        name=data.name,
        description=data.description,
        image_count=len(images),
        annotation_count=len(annotations),
        class_counts=dict(class_counts),
        split_config=data.split_config,
        created_by=current_user.id,
    )
    db.add(version)
    db.flush()

    # Create version images with frozen annotation snapshots
    for img in images:
        img_split = split_assignments.get(str(img.id), "train")
        dvi = DatasetVersionImage(
            version_id=version.id,
            image_id=img.id,
            split=img_split,
            annotation_snapshot=ann_by_image.get(img.id, []),
        )
        db.add(dvi)

    db.commit()
    db.refresh(version)
    return version


@router.get("/versions/{project_id}", response_model=List[DatasetVersionResponse])
def list_versions(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all dataset versions for a project."""
    versions = (
        db.query(DatasetVersion)
        .filter(DatasetVersion.project_id == project_id)
        .order_by(DatasetVersion.version_number.desc())
        .all()
    )
    return versions


@router.get("/versions/{project_id}/{version_id}", response_model=DatasetVersionResponse)
def get_version(
    project_id: UUID,
    version_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific dataset version."""
    version = (
        db.query(DatasetVersion)
        .filter(DatasetVersion.id == version_id, DatasetVersion.project_id == project_id)
        .first()
    )
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    return version


@router.delete("/versions/{project_id}/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_version(
    project_id: UUID,
    version_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a dataset version."""
    version = (
        db.query(DatasetVersion)
        .filter(DatasetVersion.id == version_id, DatasetVersion.project_id == project_id)
        .first()
    )
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    db.delete(version)
    db.commit()


@router.get("/versions/{project_id}/{version_a_id}/diff/{version_b_id}", response_model=VersionDiffResponse)
def diff_versions(
    project_id: UUID,
    version_a_id: UUID,
    version_b_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compare two dataset versions."""
    version_a = db.query(DatasetVersion).filter(DatasetVersion.id == version_a_id).first()
    version_b = db.query(DatasetVersion).filter(DatasetVersion.id == version_b_id).first()

    if not version_a or not version_b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    # Get image sets
    images_a = {str(dvi.image_id) for dvi in version_a.images}
    images_b = {str(dvi.image_id) for dvi in version_b.images}

    # Count annotations
    ann_count_a = sum(len(dvi.annotation_snapshot) for dvi in version_a.images)
    ann_count_b = sum(len(dvi.annotation_snapshot) for dvi in version_b.images)

    # Class changes
    class_changes = {}
    all_classes = set(version_a.class_counts.keys()) | set(version_b.class_counts.keys())
    for cls in all_classes:
        class_changes[cls] = {
            "a": version_a.class_counts.get(cls, 0),
            "b": version_b.class_counts.get(cls, 0),
        }

    return VersionDiffResponse(
        version_a=version_a,
        version_b=version_b,
        images_added=len(images_b - images_a),
        images_removed=len(images_a - images_b),
        annotations_added=max(0, ann_count_b - ann_count_a),
        annotations_removed=max(0, ann_count_a - ann_count_b),
        class_changes=class_changes,
    )


# ============================================================
# Train/Val/Test Split Management
# ============================================================

@router.get("/splits/{project_id}", response_model=SplitResponse)
def get_split(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current split configuration for a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    split = db.query(DatasetSplit).filter(DatasetSplit.project_id == project_id).first()
    if not split:
        # Return defaults
        return SplitResponse(
            id="00000000-0000-0000-0000-000000000000",
            project_id=project_id,
            train_ratio=0.7,
            val_ratio=0.15,
            test_ratio=0.15,
            random_seed=42,
            stratify_by_class=True,
            assignments={},
            updated_at=None,
            summary={"train": 0, "val": 0, "test": 0},
        )

    # Calculate summary from assignments
    summary = {"train": 0, "val": 0, "test": 0}
    for s in split.assignments.values():
        if s in summary:
            summary[s] += 1

    response = SplitResponse.model_validate(split)
    response.summary = summary
    return response


@router.put("/splits/{project_id}", response_model=SplitResponse)
def update_split(
    project_id: UUID,
    data: SplitConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update split configuration and reassign images."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Validate ratios sum to ~1.0
    total = data.train_ratio + data.val_ratio + data.test_ratio
    if abs(total - 1.0) > 0.01:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ratios must sum to 1.0, got {total:.2f}"
        )

    # Get or create split
    split = db.query(DatasetSplit).filter(DatasetSplit.project_id == project_id).first()
    if not split:
        split = DatasetSplit(project_id=project_id)
        db.add(split)

    split.train_ratio = data.train_ratio
    split.val_ratio = data.val_ratio
    split.test_ratio = data.test_ratio
    split.random_seed = data.random_seed
    split.stratify_by_class = data.stratify_by_class

    # Perform the split
    assignments = _compute_split_assignments(
        db, project_id, data.train_ratio, data.val_ratio, data.test_ratio,
        data.random_seed, data.stratify_by_class,
    )
    split.assignments = assignments

    db.commit()
    db.refresh(split)

    summary = {"train": 0, "val": 0, "test": 0}
    for s in assignments.values():
        if s in summary:
            summary[s] += 1

    response = SplitResponse.model_validate(split)
    response.summary = summary
    return response


@router.post("/splits/{project_id}/reshuffle", response_model=SplitResponse)
def reshuffle_split(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-randomize the split with a new random seed."""
    split = db.query(DatasetSplit).filter(DatasetSplit.project_id == project_id).first()
    if not split:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No split configured. Create one first.")

    # New seed
    split.random_seed = random.randint(1, 999999)

    assignments = _compute_split_assignments(
        db, project_id, split.train_ratio, split.val_ratio, split.test_ratio,
        split.random_seed, split.stratify_by_class,
    )
    split.assignments = assignments

    db.commit()
    db.refresh(split)

    summary = {"train": 0, "val": 0, "test": 0}
    for s in assignments.values():
        if s in summary:
            summary[s] += 1

    response = SplitResponse.model_validate(split)
    response.summary = summary
    return response


@router.get("/splits/{project_id}/preview", response_model=SplitPreviewResponse)
def preview_split(
    project_id: UUID,
    train_ratio: float = 0.7,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42,
    stratify: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Preview split distribution without applying."""
    assignments = _compute_split_assignments(
        db, project_id, train_ratio, val_ratio, test_ratio, seed, stratify,
    )

    summary = {"train": 0, "val": 0, "test": 0}
    for s in assignments.values():
        if s in summary:
            summary[s] += 1

    # Per-class breakdown
    images = db.query(Image).filter(Image.project_id == project_id).all()
    image_ids = [img.id for img in images]
    annotations = (
        db.query(Annotation.image_id, Annotation.class_label)
        .filter(Annotation.image_id.in_(image_ids))
        .all()
    ) if image_ids else []

    # Map image -> primary class (most common label)
    img_classes = defaultdict(lambda: defaultdict(int))
    for ann in annotations:
        label = ann.class_label or "unlabeled"
        img_classes[str(ann.image_id)][label] += 1

    per_class = defaultdict(lambda: {"train": 0, "val": 0, "test": 0})
    for img_id_str, split_name in assignments.items():
        for cls in img_classes.get(img_id_str, {"unlabeled": 1}):
            per_class[cls][split_name] += 1

    return SplitPreviewResponse(
        train_count=summary["train"],
        val_count=summary["val"],
        test_count=summary["test"],
        per_class=dict(per_class),
    )


def _compute_split_assignments(
    db: Session,
    project_id: UUID,
    train_ratio: float,
    val_ratio: float,
    test_ratio: float,
    seed: int,
    stratify: bool,
) -> dict:
    """Compute train/val/test assignments for all project images."""
    images = db.query(Image).filter(Image.project_id == project_id).all()
    if not images:
        return {}

    image_ids = [img.id for img in images]

    if stratify:
        # Get primary class per image
        annotations = (
            db.query(Annotation.image_id, Annotation.class_label)
            .filter(Annotation.image_id.in_(image_ids))
            .all()
        )

        img_class_counts = defaultdict(lambda: defaultdict(int))
        for ann in annotations:
            label = ann.class_label or "unlabeled"
            img_class_counts[ann.image_id][label] += 1

        # Assign primary class = most frequent label
        img_primary_class = {}
        for img_id, counts in img_class_counts.items():
            img_primary_class[img_id] = max(counts, key=counts.get)

        # Group images by class
        class_groups = defaultdict(list)
        for img in images:
            cls = img_primary_class.get(img.id, "unannotated")
            class_groups[cls].append(str(img.id))

        # Split each class group
        rng = random.Random(seed)
        assignments = {}
        for cls, ids in class_groups.items():
            rng.shuffle(ids)
            n = len(ids)
            n_train = max(1, round(n * train_ratio))
            n_val = max(0, round(n * val_ratio))
            # test gets the rest
            for i, img_id in enumerate(ids):
                if i < n_train:
                    assignments[img_id] = "train"
                elif i < n_train + n_val:
                    assignments[img_id] = "val"
                else:
                    assignments[img_id] = "test"
    else:
        # Simple random split
        rng = random.Random(seed)
        ids = [str(img.id) for img in images]
        rng.shuffle(ids)
        n = len(ids)
        n_train = round(n * train_ratio)
        n_val = round(n * val_ratio)

        assignments = {}
        for i, img_id in enumerate(ids):
            if i < n_train:
                assignments[img_id] = "train"
            elif i < n_train + n_val:
                assignments[img_id] = "val"
            else:
                assignments[img_id] = "test"

    return assignments


# ============================================================
# Duplicate Detection
# ============================================================

@router.post("/duplicates/{project_id}", response_model=DuplicateResponse)
def find_duplicates(
    project_id: UUID,
    threshold: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Find duplicate/near-duplicate images using perceptual hashing."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    images = db.query(Image).filter(Image.project_id == project_id).all()
    if not images:
        return DuplicateResponse(total_groups=0, total_duplicates=0, groups=[])

    # Compute phashes for images that don't have one yet
    try:
        import imagehash
        from PIL import Image as PILImage
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="imagehash and Pillow packages required for duplicate detection"
        )

    from app.core.config import settings

    for img in images:
        if not img.phash:
            try:
                filepath = img.original_path.replace("/storage/", settings.UPLOAD_DIR + "/")
                pil_img = PILImage.open(filepath)
                img.phash = str(imagehash.phash(pil_img))
            except Exception:
                img.phash = None

    db.commit()

    # Compare phashes — O(n^2) but fine for typical project sizes
    from itertools import combinations

    images_with_hash = [img for img in images if img.phash]
    groups_map = {}  # representative_id -> [images]
    assigned = set()

    for img_a, img_b in combinations(images_with_hash, 2):
        try:
            hash_a = imagehash.hex_to_hash(img_a.phash)
            hash_b = imagehash.hex_to_hash(img_b.phash)
            distance = hash_a - hash_b
        except Exception:
            continue

        if distance <= threshold:
            # Find or create group
            group_key = None
            for key in [img_a.id, img_b.id]:
                if key in assigned:
                    # Find which group it belongs to
                    for gk, members in groups_map.items():
                        if any(m["id"] == str(key) for m in members):
                            group_key = gk
                            break
                    break

            if group_key is None:
                group_key = img_a.id
                groups_map[group_key] = [_image_to_dict(img_a)]
                assigned.add(img_a.id)

            # Add img_b if not already in group
            if img_b.id not in assigned:
                groups_map[group_key].append(_image_to_dict(img_b))
                assigned.add(img_b.id)

    groups = []
    for members in groups_map.values():
        if len(members) >= 2:
            groups.append(DuplicateGroup(
                images=members,
                similarity=1.0,  # simplified — all above threshold
            ))

    total_dupes = sum(len(g.images) - 1 for g in groups)
    return DuplicateResponse(total_groups=len(groups), total_duplicates=total_dupes, groups=groups)


@router.delete("/duplicates/{project_id}", status_code=status.HTTP_200_OK)
def delete_duplicates(
    project_id: UUID,
    data: DuplicateDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete selected duplicate images."""
    deleted = 0
    for image_id in data.image_ids:
        img = db.query(Image).filter(Image.id == image_id, Image.project_id == project_id).first()
        if img:
            db.delete(img)
            deleted += 1
    db.commit()
    return {"deleted": deleted}


def _image_to_dict(img: Image) -> dict:
    return {
        "id": str(img.id),
        "filename": img.filename,
        "thumbnail_path": img.thumbnail_path,
        "phash": img.phash,
        "width": img.width,
        "height": img.height,
    }
