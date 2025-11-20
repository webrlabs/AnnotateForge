# YOLO Model Training System - Implementation Plan

## Overview

Add ability to train custom models directly through the annotateforge web interface, with real-time training monitoring and model hosting for inference. Supports three model types:

1. **Classification Models** (YOLOv8-cls): Image-level classification
2. **Detection Models** (YOLOv8): Bounding box object detection
3. **Segmentation Models** (YOLOv8-seg): Instance segmentation with polygons

---

## Requirements Summary

1. **Model Type Selection**: Choose between classification, detection, or segmentation
2. **Multi-Project Data Sources**: Select multiple projects to combine training data
3. **Annotation Type Selection**: Choose which annotation types to include and convert appropriately
4. **Train/Validation Split**: Randomly split images with configurable ratio
5. **Hyperparameter Configuration**: Display and edit training parameters specific to model type
6. **Real-Time Training Monitoring**: Stream training metrics (loss, mAP, accuracy, etc.) via WebSocket
7. **Model Hosting**: Save trained models and make available for inference and annotation assistance
8. **Inference API**: Provide endpoints to use custom trained models

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│              Frontend (React)                        │
│  ┌───────────────────────────────────────────────┐  │
│  │  Training Wizard                              │  │
│  │  - Model Type Selection (cls/det/seg)         │  │
│  │  - Project Selection                          │  │
│  │  - Annotation Type & Class Mapping            │  │
│  │  - Train/Val Split Configuration              │  │
│  │  - Hyperparameter Editor                      │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Training Monitor (WebSocket)                 │  │
│  │  - Live Loss Chart                            │  │
│  │  - Metrics Display (mAP, precision, recall)   │  │
│  │  - Epoch Progress                             │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Model Manager                                │  │
│  │  - List Trained Models                        │  │
│  │  - Model Selection for Inference              │  │
│  │  - Model Performance Stats                    │  │
│  └───────────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────────┘
                   │ REST API + WebSocket
┌──────────────────▼──────────────────────────────────┐
│              Backend (FastAPI)                       │
│  ┌───────────────────────────────────────────────┐  │
│  │  Training API Routes                          │  │
│  │  - POST /training/jobs (create)               │  │
│  │  - GET  /training/jobs (list)                 │  │
│  │  - GET  /training/jobs/{id} (status)          │  │
│  │  - DELETE /training/jobs/{id} (cancel)        │  │
│  │  - WS  /training/ws/{job_id} (monitor)        │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Model API Routes                             │  │
│  │  - GET  /models (list trained models)         │  │
│  │  - GET  /models/{id} (model details)          │  │
│  │  - POST /models/{id}/predict (inference)      │  │
│  │  - DELETE /models/{id} (delete model)         │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Training Service                             │  │
│  │  - Data Preparation                           │  │
│  │  - Annotation Conversion                      │  │
│  │  - Train/Val Split                            │  │
│  │  - YOLO Training Loop                         │  │
│  │  - Metrics Collection                         │  │
│  │  - WebSocket Broadcasting                     │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Background Task Queue (Celery)               │  │
│  │  - Async Training Execution                   │  │
│  │  - Progress Tracking                          │  │
│  │  - Checkpoint Management                      │  │
│  └───────────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼──────┐   ┌─────────▼────────┐
│  PostgreSQL  │   │   Redis          │
│  - Jobs      │   │   - Task Queue   │
│  - Models    │   │   - WS Sessions  │
│  - Metrics   │   │                  │
└──────────────┘   └──────────────────┘
        │
┌───────▼──────────────────────┐
│  File Storage                │
│  - Training Datasets (YOLO)  │
│  - Trained Models (.pt)      │
│  - Training Logs             │
└──────────────────────────────┘
```

---

## Database Schema

### New Tables

```sql
-- Training Jobs
CREATE TABLE training_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(50) NOT NULL CHECK (task_type IN ('classify', 'detect', 'segment')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'preparing', 'training', 'completed', 'failed', 'cancelled')),

    -- Configuration
    config JSONB NOT NULL,  -- Full training configuration

    -- Results
    final_metrics JSONB,  -- Final metrics (varies by task type)
    model_id UUID REFERENCES trained_models(id),
    error_message TEXT,

    -- Progress
    current_epoch INTEGER DEFAULT 0,
    total_epochs INTEGER NOT NULL,
    progress_percent FLOAT DEFAULT 0
);

-- Trained Models
CREATE TABLE trained_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_job_id UUID REFERENCES training_jobs(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(50) NOT NULL CHECK (task_type IN ('classify', 'detect', 'segment')),

    -- Model Info
    model_path TEXT NOT NULL,  -- Path to .pt file
    model_type VARCHAR(50) DEFAULT 'yolov8',  -- yolov8n, yolov8s, yolov8n-cls, yolov8n-seg, etc.
    image_size INTEGER NOT NULL,  -- Training image size (640, 1024, etc.)

    -- Classes
    classes JSONB NOT NULL,  -- {"0": "particle", "1": "defect", ...}
    num_classes INTEGER NOT NULL,

    -- Performance Metrics (varies by task_type)
    -- Classification: top1_accuracy, top5_accuracy
    -- Detection: map50, map50_95, precision, recall
    -- Segmentation: mask_map50, mask_map50_95, box_map50, box_map50_95
    performance_metrics JSONB NOT NULL,

    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,  -- Available for inference

    CONSTRAINT unique_model_name UNIQUE (name)
);

-- Training Metrics (per epoch)
CREATE TABLE training_metrics (
    id SERIAL PRIMARY KEY,
    training_job_id UUID REFERENCES training_jobs(id) ON DELETE CASCADE,
    epoch INTEGER NOT NULL,

    -- Loss metrics (common to all task types)
    train_loss FLOAT,
    val_loss FLOAT,

    -- Task-specific metrics stored as JSONB
    -- Classification: {top1_accuracy, top5_accuracy}
    -- Detection: {box_loss, cls_loss, dfl_loss, precision, recall, map50, map50_95}
    -- Segmentation: {box_loss, cls_loss, dfl_loss, seg_loss, mask_map50, mask_map50_95}
    metrics JSONB NOT NULL,

    -- Time
    epoch_time_seconds FLOAT,
    timestamp TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_epoch_per_job UNIQUE (training_job_id, epoch)
);

-- Training Datasets (cache dataset configurations)
CREATE TABLE training_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_job_id UUID REFERENCES training_jobs(id) ON DELETE CASCADE,

    -- Project sources
    project_ids UUID[] NOT NULL,

    -- Split info
    total_images INTEGER NOT NULL,
    train_images INTEGER NOT NULL,
    val_images INTEGER NOT NULL,

    -- Classes
    class_mapping JSONB NOT NULL,  -- {"particle": 0, "defect": 1}
    annotation_types VARCHAR(50)[] NOT NULL,  -- ['circle', 'box']

    -- Dataset path
    dataset_path TEXT NOT NULL,  -- Path to YOLO format dataset

    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_training_jobs_status ON training_jobs(status);
CREATE INDEX idx_training_jobs_created_by ON training_jobs(created_by);
CREATE INDEX idx_trained_models_active ON trained_models(is_active);
CREATE INDEX idx_training_metrics_job_id ON training_metrics(training_job_id);
```

### Training Configuration JSONB Structure

#### Classification Task

```json
{
  "task_type": "classify",
  "projects": ["uuid1", "uuid2", "uuid3"],
  "class_mapping": {
    "good": 0,
    "defect": 1,
    "uncertain": 2
  },
  "split": {
    "train_ratio": 0.8,
    "val_ratio": 0.2,
    "random_seed": 42
  },
  "hyperparameters": {
    "model": "yolov8n-cls.pt",
    "epochs": 100,
    "batch": 32,
    "imgsz": 224,
    "lr0": 0.01,
    "lrf": 0.01,
    "momentum": 0.937,
    "weight_decay": 0.0005,
    "warmup_epochs": 3,
    "augment": true,
    "optimizer": "auto",
    "dropout": 0.0
  }
}
```

#### Detection Task

```json
{
  "task_type": "detect",
  "projects": ["uuid1", "uuid2", "uuid3"],
  "annotation_types": ["circle", "box", "rectangle"],
  "class_mapping": {
    "particle": 0,
    "defect": 1,
    "background": 2
  },
  "split": {
    "train_ratio": 0.8,
    "val_ratio": 0.2,
    "random_seed": 42
  },
  "hyperparameters": {
    "model": "yolov8n.pt",
    "epochs": 100,
    "batch": 16,
    "imgsz": 640,
    "lr0": 0.01,
    "lrf": 0.01,
    "momentum": 0.937,
    "weight_decay": 0.0005,
    "warmup_epochs": 3,
    "augment": true,
    "optimizer": "auto",
    "iou": 0.7,
    "conf": 0.001
  }
}
```

#### Segmentation Task

```json
{
  "task_type": "segment",
  "projects": ["uuid1", "uuid2", "uuid3"],
  "annotation_types": ["polygon"],
  "class_mapping": {
    "particle": 0,
    "defect": 1
  },
  "split": {
    "train_ratio": 0.8,
    "val_ratio": 0.2,
    "random_seed": 42
  },
  "hyperparameters": {
    "model": "yolov8n-seg.pt",
    "epochs": 100,
    "batch": 16,
    "imgsz": 640,
    "lr0": 0.01,
    "lrf": 0.01,
    "momentum": 0.937,
    "weight_decay": 0.0005,
    "warmup_epochs": 3,
    "augment": true,
    "optimizer": "auto",
    "overlap_mask": true,
    "mask_ratio": 4
  }
}
```

---

## API Endpoints

### Training Jobs

#### Create Training Job

**Detection Example:**
```http
POST /api/v1/training/jobs
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Particle Detection v1",
  "description": "Training on projects A, B, C",
  "task_type": "detect",
  "config": {
    "task_type": "detect",
    "projects": ["uuid1", "uuid2"],
    "annotation_types": ["circle", "box"],
    "class_mapping": {
      "particle": 0,
      "defect": 1
    },
    "split": {
      "train_ratio": 0.8,
      "val_ratio": 0.2,
      "random_seed": 42
    },
    "hyperparameters": {
      "model": "yolov8n.pt",
      "epochs": 100,
      "batch": 16,
      "imgsz": 640
    }
  }
}

Response: 201 Created
{
  "id": "uuid",
  "name": "Particle Detection v1",
  "task_type": "detect",
  "status": "pending",
  "created_at": "2025-01-15T10:00:00Z",
  "total_epochs": 100
}
```

**Classification Example:**
```http
POST /api/v1/training/jobs
{
  "name": "Quality Classification",
  "task_type": "classify",
  "config": {
    "task_type": "classify",
    "projects": ["uuid1", "uuid2"],
    "class_mapping": {
      "good": 0,
      "defect": 1
    },
    "split": {
      "train_ratio": 0.8,
      "val_ratio": 0.2,
      "random_seed": 42
    },
    "hyperparameters": {
      "model": "yolov8n-cls.pt",
      "epochs": 100,
      "batch": 32,
      "imgsz": 224
    }
  }
}
```

**Segmentation Example:**
```http
POST /api/v1/training/jobs
{
  "name": "Particle Segmentation",
  "task_type": "segment",
  "config": {
    "task_type": "segment",
    "projects": ["uuid1", "uuid2"],
    "annotation_types": ["polygon"],
    "class_mapping": {
      "particle": 0
    },
    "split": {
      "train_ratio": 0.8,
      "val_ratio": 0.2,
      "random_seed": 42
    },
    "hyperparameters": {
      "model": "yolov8n-seg.pt",
      "epochs": 100,
      "batch": 16,
      "imgsz": 640
    }
  }
}
```

#### List Training Jobs
```http
GET /api/v1/training/jobs
GET /api/v1/training/jobs?status=training
GET /api/v1/training/jobs?status=completed

Response: 200 OK
[
  {
    "id": "uuid",
    "name": "Particle Detection v1",
    "status": "training",
    "current_epoch": 45,
    "total_epochs": 100,
    "progress_percent": 45.0,
    "created_at": "2025-01-15T10:00:00Z",
    "started_at": "2025-01-15T10:05:00Z"
  }
]
```

#### Get Training Job Details
```http
GET /api/v1/training/jobs/{job_id}

Response: 200 OK
{
  "id": "uuid",
  "name": "Particle Detection v1",
  "description": "Training on projects A, B, C",
  "status": "training",
  "current_epoch": 45,
  "total_epochs": 100,
  "progress_percent": 45.0,
  "config": { /* full config */ },
  "dataset": {
    "total_images": 1000,
    "train_images": 800,
    "val_images": 200,
    "classes": {"particle": 0, "defect": 1}
  },
  "latest_metrics": {
    "epoch": 45,
    "train_box_loss": 0.045,
    "val_box_loss": 0.052,
    "precision": 0.89,
    "recall": 0.85,
    "map50": 0.87,
    "map50_95": 0.65
  },
  "created_at": "2025-01-15T10:00:00Z",
  "started_at": "2025-01-15T10:05:00Z"
}
```

#### Cancel Training Job
```http
DELETE /api/v1/training/jobs/{job_id}

Response: 200 OK
{
  "id": "uuid",
  "status": "cancelled",
  "message": "Training job cancelled successfully"
}
```

#### Training Progress WebSocket
```
WS /api/v1/training/ws/{job_id}?token={jwt_token}

// Server sends real-time updates
{
  "type": "status_change",
  "status": "training",
  "timestamp": "2025-01-15T10:05:00Z"
}

{
  "type": "epoch_start",
  "epoch": 1,
  "total_epochs": 100
}

{
  "type": "epoch_complete",
  "epoch": 1,
  "metrics": {
    "train_box_loss": 0.089,
    "train_cls_loss": 0.067,
    "train_dfl_loss": 0.034,
    "val_box_loss": 0.095,
    "val_cls_loss": 0.072,
    "val_dfl_loss": 0.038,
    "precision": 0.78,
    "recall": 0.71,
    "map50": 0.73,
    "map50_95": 0.51,
    "epoch_time_seconds": 45.2
  }
}

{
  "type": "training_complete",
  "final_metrics": {
    "precision": 0.92,
    "recall": 0.89,
    "map50": 0.91,
    "map50_95": 0.73
  },
  "model_id": "uuid"
}

{
  "type": "training_failed",
  "error": "Out of memory"
}
```

### Trained Models

#### List Trained Models
```http
GET /api/v1/models
GET /api/v1/models?is_active=true

Response: 200 OK
[
  {
    "id": "uuid",
    "name": "Particle Detection v1",
    "description": "Trained on 1000 images",
    "model_type": "yolov8n",
    "num_classes": 2,
    "classes": {"0": "particle", "1": "defect"},
    "map50": 0.91,
    "map50_95": 0.73,
    "precision": 0.92,
    "recall": 0.89,
    "is_active": true,
    "created_at": "2025-01-15T12:00:00Z"
  }
]
```

#### Get Model Details
```http
GET /api/v1/models/{model_id}

Response: 200 OK
{
  "id": "uuid",
  "name": "Particle Detection v1",
  "description": "Trained on 1000 images",
  "training_job_id": "uuid",
  "model_type": "yolov8n",
  "image_size": 640,
  "num_classes": 2,
  "classes": {"0": "particle", "1": "defect"},
  "performance": {
    "map50": 0.91,
    "map50_95": 0.73,
    "precision": 0.92,
    "recall": 0.89
  },
  "training_config": { /* original config */ },
  "is_active": true,
  "created_at": "2025-01-15T12:00:00Z"
}
```

#### Inference with Custom Model

**Classification Model:**
```http
POST /api/v1/models/{model_id}/predict
Content-Type: application/json

{
  "image_id": "uuid"
}

Response: 200 OK
{
  "task_type": "classify",
  "predictions": [
    {
      "class_id": 0,
      "class_label": "good",
      "confidence": 0.95
    },
    {
      "class_id": 1,
      "class_label": "defect",
      "confidence": 0.05
    }
  ],
  "top1_class": "good",
  "top1_confidence": 0.95,
  "model_name": "Quality Classification",
  "inference_time_ms": 12.5
}
```

**Detection Model:**
```http
POST /api/v1/models/{model_id}/predict
Content-Type: application/json

{
  "image_id": "uuid",
  "confidence": 0.5,
  "iou": 0.45
}

Response: 200 OK
{
  "task_type": "detect",
  "annotations": [
    {
      "type": "box",
      "data": {
        "corners": [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
      },
      "confidence": 0.92,
      "source": "custom_model",
      "class_label": "particle",
      "class_id": 0
    }
  ],
  "model_name": "Particle Detection v1",
  "inference_time_ms": 45.2
}
```

**Segmentation Model:**
```http
POST /api/v1/models/{model_id}/predict
Content-Type: application/json

{
  "image_id": "uuid",
  "confidence": 0.5,
  "iou": 0.45
}

Response: 200 OK
{
  "task_type": "segment",
  "annotations": [
    {
      "type": "polygon",
      "data": {
        "points": [[x1,y1], [x2,y2], ..., [xn,yn]]
      },
      "bbox": {
        "corners": [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
      },
      "confidence": 0.89,
      "source": "custom_model",
      "class_label": "particle",
      "class_id": 0
    }
  ],
  "model_name": "Particle Segmentation",
  "inference_time_ms": 67.8
}
```

#### Delete Model
```http
DELETE /api/v1/models/{model_id}

Response: 204 No Content
```

---

## Data Preparation by Task Type

### Classification (YOLOv8-cls)

**Format**: ImageFolder structure
```
dataset/
├── train/
│   ├── good/
│   │   ├── img001.jpg
│   │   ├── img002.jpg
│   │   └── ...
│   ├── defect/
│   │   ├── img010.jpg
│   │   └── ...
│   └── uncertain/
│       └── ...
└── val/
    ├── good/
    ├── defect/
    └── uncertain/
```

**Annotation Requirements**: Image-level class label only
- No annotation shapes needed
- Uses project-level or image-level class labels
- Each image classified into one folder

### Detection (YOLOv8)

**Format**: YOLO detection format
```
dataset/
├── images/
│   ├── train/
│   │   ├── img001.jpg
│   │   └── ...
│   └── val/
│       └── ...
├── labels/
│   ├── train/
│   │   ├── img001.txt  # class_id x_center y_center width height
│   │   └── ...
│   └── val/
│       └── ...
└── data.yaml
```

**Annotation Requirements**: Bounding boxes
- Accepts: circles, boxes, rectangles
- Circles converted to bounding boxes
- Normalized coordinates (0-1)
- Format: `class_id x_center y_center width height`

### Segmentation (YOLOv8-seg)

**Format**: YOLO segmentation format
```
dataset/
├── images/
│   ├── train/
│   │   ├── img001.jpg
│   │   └── ...
│   └── val/
│       └── ...
├── labels/
│   ├── train/
│   │   ├── img001.txt  # class_id x1 y1 x2 y2 ... xn yn
│   │   └── ...
│   └── val/
│       └── ...
└── data.yaml
```

**Annotation Requirements**: Polygons
- Accepts: polygons only
- Normalized coordinates (0-1)
- Format: `class_id x1 y1 x2 y2 x3 y3 ...` (polygon points)
- Minimum 3 points per polygon

---

## Backend Implementation

### Training Service

```python
# backend/app/services/training_service.py
from ultralytics import YOLO
import numpy as np
from pathlib import Path
import yaml
import shutil
from typing import List, Dict, Tuple
import random

class TrainingService:
    def __init__(self, storage_dir: str = "/app/storage/training"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    async def prepare_dataset(
        self,
        job_id: str,
        config: Dict,
        db: Session
    ) -> Tuple[Path, Dict]:
        """
        Prepare dataset from annotateforge annotations based on task type.

        Returns:
            (dataset_path, dataset_info)
        """
        dataset_path = self.storage_dir / job_id
        dataset_path.mkdir(exist_ok=True)

        task_type = config["task_type"]

        # Create directory structure based on task type
        if task_type == "classify":
            # ImageFolder structure
            (dataset_path / "train").mkdir(parents=True, exist_ok=True)
            (dataset_path / "val").mkdir(parents=True, exist_ok=True)
            # Create class folders
            for class_name in config["class_mapping"].keys():
                (dataset_path / "train" / class_name).mkdir(exist_ok=True)
                (dataset_path / "val" / class_name).mkdir(exist_ok=True)
        else:
            # YOLO detection/segmentation structure
            (dataset_path / "images" / "train").mkdir(parents=True, exist_ok=True)
            (dataset_path / "images" / "val").mkdir(parents=True, exist_ok=True)
            (dataset_path / "labels" / "train").mkdir(parents=True, exist_ok=True)
            (dataset_path / "labels" / "val").mkdir(parents=True, exist_ok=True)

        # Get all images from selected projects
        project_ids = config["projects"]
        class_mapping = config["class_mapping"]

        images = []
        for project_id in project_ids:
            project_images = db.query(Image).filter(
                Image.project_id == project_id
            ).all()
            images.extend(project_images)

        # Random split
        random.seed(config["split"]["random_seed"])
        random.shuffle(images)

        train_ratio = config["split"]["train_ratio"]
        split_idx = int(len(images) * train_ratio)
        train_images = images[:split_idx]
        val_images = images[split_idx:]

        # Process images based on task type
        if task_type == "classify":
            await self._process_classification_images(
                train_images,
                dataset_path / "train",
                class_mapping,
                db
            )
            await self._process_classification_images(
                val_images,
                dataset_path / "val",
                class_mapping,
                db
            )
        elif task_type == "detect":
            annotation_types = config["annotation_types"]
            await self._process_detection_images(
                train_images,
                dataset_path / "images" / "train",
                dataset_path / "labels" / "train",
                annotation_types,
                class_mapping,
                db
            )
            await self._process_detection_images(
                val_images,
                dataset_path / "images" / "val",
                dataset_path / "labels" / "val",
                annotation_types,
                class_mapping,
                db
            )
        elif task_type == "segment":
            annotation_types = config["annotation_types"]
            await self._process_segmentation_images(
                train_images,
                dataset_path / "images" / "train",
                dataset_path / "labels" / "train",
                annotation_types,
                class_mapping,
                db
            )
            await self._process_segmentation_images(
                val_images,
                dataset_path / "images" / "val",
                dataset_path / "labels" / "val",
                annotation_types,
                class_mapping,
                db
            )

        # Create data.yaml (not needed for classification)
        if task_type != "classify":
            data_yaml = {
                "path": str(dataset_path),
                "train": "images/train",
                "val": "images/val",
                "nc": len(class_mapping),
                "names": {v: k for k, v in class_mapping.items()}  # {0: "particle", 1: "defect"}
            }

            with open(dataset_path / "data.yaml", "w") as f:
                yaml.dump(data_yaml, f)

        dataset_info = {
            "total_images": len(images),
            "train_images": len(train_images),
            "val_images": len(val_images),
            "classes": class_mapping
        }

        return dataset_path, dataset_info

    async def _process_classification_images(
        self,
        images: List[Image],
        base_dir: Path,
        class_mapping: Dict[str, int],
        db: Session
    ):
        """Process images for classification (ImageFolder structure)"""
        for image in images:
            # Determine class from image metadata or project
            # For simplicity, using image metadata "class" field
            image_class = image.metadata.get("class", "unknown")

            if image_class not in class_mapping:
                continue

            # Copy image to class folder
            src_path = Path(image.original_path)
            class_dir = base_dir / image_class
            dst_path = class_dir / f"{image.id}.jpg"
            shutil.copy(src_path, dst_path)

    async def _process_detection_images(
        self,
        images: List[Image],
        img_dir: Path,
        label_dir: Path,
        annotation_types: List[str],
        class_mapping: Dict[str, int],
        db: Session
    ):
        """Process images for detection (YOLO bbox format)"""
        for image in images:
            # Copy image
            src_path = Path(image.original_path)
            dst_path = img_dir / f"{image.id}.jpg"
            shutil.copy(src_path, dst_path)

            # Get annotations
            annotations = db.query(Annotation).filter(
                Annotation.image_id == image.id,
                Annotation.type.in_(annotation_types)
            ).all()

            # Convert to YOLO detection format
            yolo_lines = []
            for ann in annotations:
                if ann.class_label not in class_mapping:
                    continue

                class_id = class_mapping[ann.class_label]
                bbox = self._annotation_to_bbox(ann, image.width, image.height)

                if bbox:
                    # YOLO format: class_id x_center y_center width height (normalized)
                    x_center, y_center, width, height = bbox
                    yolo_lines.append(
                        f"{class_id} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}\n"
                    )

            # Write label file
            label_path = label_dir / f"{image.id}.txt"
            with open(label_path, "w") as f:
                f.writelines(yolo_lines)

    async def _process_segmentation_images(
        self,
        images: List[Image],
        img_dir: Path,
        label_dir: Path,
        annotation_types: List[str],
        class_mapping: Dict[str, int],
        db: Session
    ):
        """Process images for segmentation (YOLO polygon format)"""
        for image in images:
            # Copy image
            src_path = Path(image.original_path)
            dst_path = img_dir / f"{image.id}.jpg"
            shutil.copy(src_path, dst_path)

            # Get annotations (polygons only)
            annotations = db.query(Annotation).filter(
                Annotation.image_id == image.id,
                Annotation.type.in_(annotation_types)
            ).all()

            # Convert to YOLO segmentation format
            yolo_lines = []
            for ann in annotations:
                if ann.class_label not in class_mapping:
                    continue

                if ann.type != "polygon":
                    continue

                class_id = class_mapping[ann.class_label]
                normalized_points = self._normalize_polygon_points(
                    ann.data["points"],
                    image.width,
                    image.height
                )

                # YOLO format: class_id x1 y1 x2 y2 x3 y3 ...
                points_str = " ".join([f"{x:.6f} {y:.6f}" for x, y in normalized_points])
                yolo_lines.append(f"{class_id} {points_str}\n")

            # Write label file
            label_path = label_dir / f"{image.id}.txt"
            with open(label_path, "w") as f:
                f.writelines(yolo_lines)

    def _normalize_polygon_points(
        self,
        points: List[List[float]],
        img_width: int,
        img_height: int
    ) -> List[Tuple[float, float]]:
        """Normalize polygon points to [0, 1]"""
        normalized = []
        for x, y in points:
            norm_x = x / img_width
            norm_y = y / img_height
            normalized.append((norm_x, norm_y))
        return normalized

    def _annotation_to_bbox(
        self,
        annotation: Annotation,
        img_width: int,
        img_height: int
    ) -> Tuple[float, float, float, float]:
        """
        Convert annotation to normalized YOLO bbox format.

        Returns:
            (x_center, y_center, width, height) normalized to [0, 1]
        """
        ann_type = annotation.type
        data = annotation.data

        if ann_type == "circle":
            # Circle: convert to bounding box
            x = data["x"]
            y = data["y"]
            size = data["size"]

            x_min = x - size
            y_min = y - size
            x_max = x + size
            y_max = y + size

        elif ann_type == "box" or ann_type == "rectangle":
            # Box: get min/max from corners
            corners = data["corners"]
            x_coords = [c[0] for c in corners]
            y_coords = [c[1] for c in corners]

            x_min = min(x_coords)
            y_min = min(y_coords)
            x_max = max(x_coords)
            y_max = max(y_coords)

        elif ann_type == "polygon":
            # Polygon: get bounding box from points
            points = data["points"]
            x_coords = [p[0] for p in points]
            y_coords = [p[1] for p in points]

            x_min = min(x_coords)
            y_min = min(y_coords)
            x_max = max(x_coords)
            y_max = max(y_coords)

        else:
            return None

        # Convert to YOLO format (normalized center + size)
        width = x_max - x_min
        height = y_max - y_min
        x_center = x_min + width / 2
        y_center = y_min + height / 2

        # Normalize
        x_center_norm = x_center / img_width
        y_center_norm = y_center / img_height
        width_norm = width / img_width
        height_norm = height / img_height

        return x_center_norm, y_center_norm, width_norm, height_norm

    async def train_model(
        self,
        job_id: str,
        dataset_path: Path,
        config: Dict,
        db: Session,
        progress_callback=None
    ):
        """
        Train YOLO model and stream progress.

        Args:
            job_id: Training job ID
            dataset_path: Path to prepared dataset
            config: Training configuration
            db: Database session
            progress_callback: Callback for progress updates
        """
        hyperparams = config["hyperparameters"]

        # Load base model
        model = YOLO(hyperparams.get("model", "yolov8n.pt"))

        # Training callback to capture metrics
        def on_epoch_end(trainer):
            """Called at the end of each epoch"""
            metrics = trainer.metrics

            epoch_metrics = {
                "epoch": trainer.epoch + 1,
                "train_box_loss": float(metrics.get("train/box_loss", 0)),
                "train_cls_loss": float(metrics.get("train/cls_loss", 0)),
                "train_dfl_loss": float(metrics.get("train/dfl_loss", 0)),
                "val_box_loss": float(metrics.get("val/box_loss", 0)),
                "val_cls_loss": float(metrics.get("val/cls_loss", 0)),
                "val_dfl_loss": float(metrics.get("val/dfl_loss", 0)),
                "precision": float(metrics.get("metrics/precision(B)", 0)),
                "recall": float(metrics.get("metrics/recall(B)", 0)),
                "map50": float(metrics.get("metrics/mAP50(B)", 0)),
                "map50_95": float(metrics.get("metrics/mAP50-95(B)", 0)),
            }

            # Save to database
            metric_record = TrainingMetric(
                training_job_id=job_id,
                **epoch_metrics
            )
            db.add(metric_record)
            db.commit()

            # Send progress update via callback
            if progress_callback:
                progress_callback({
                    "type": "epoch_complete",
                    "epoch": trainer.epoch + 1,
                    "metrics": epoch_metrics
                })

        # Add callback
        model.add_callback("on_train_epoch_end", on_epoch_end)

        # Train
        results = model.train(
            data=str(dataset_path / "data.yaml"),
            epochs=hyperparams.get("epochs", 100),
            batch=hyperparams.get("batch", 16),
            imgsz=hyperparams.get("imgsz", 640),
            lr0=hyperparams.get("lr0", 0.01),
            lrf=hyperparams.get("lrf", 0.01),
            momentum=hyperparams.get("momentum", 0.937),
            weight_decay=hyperparams.get("weight_decay", 0.0005),
            warmup_epochs=hyperparams.get("warmup_epochs", 3),
            augment=hyperparams.get("augment", True),
            optimizer=hyperparams.get("optimizer", "auto"),
            device=hyperparams.get("device", "cuda:0"),
            project=str(self.storage_dir),
            name=job_id,
            exist_ok=True
        )

        # Return model path and final metrics
        model_path = self.storage_dir / job_id / "weights" / "best.pt"

        final_metrics = {
            "precision": float(results.results_dict.get("metrics/precision(B)", 0)),
            "recall": float(results.results_dict.get("metrics/recall(B)", 0)),
            "map50": float(results.results_dict.get("metrics/mAP50(B)", 0)),
            "map50_95": float(results.results_dict.get("metrics/mAP50-95(B)", 0)),
        }

        return model_path, final_metrics
```

### Celery Task

```python
# backend/app/tasks/training_tasks.py
from celery import shared_task
from app.services.training_service import TrainingService
from app.core.database import SessionLocal
from app.models.training import TrainingJob, TrainedModel
from app.services.connection_manager import manager
import asyncio

@shared_task(bind=True)
def train_yolo_model(self, job_id: str):
    """
    Background task to train YOLO model.
    """
    db = SessionLocal()
    training_service = TrainingService()

    try:
        # Get job
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if not job:
            return

        # Update status
        job.status = "preparing"
        db.commit()

        # Broadcast status change
        asyncio.run(broadcast_training_update(job_id, {
            "type": "status_change",
            "status": "preparing"
        }))

        # Prepare dataset
        dataset_path, dataset_info = asyncio.run(
            training_service.prepare_dataset(job_id, job.config, db)
        )

        # Save dataset info
        dataset_record = TrainingDataset(
            training_job_id=job_id,
            project_ids=job.config["projects"],
            total_images=dataset_info["total_images"],
            train_images=dataset_info["train_images"],
            val_images=dataset_info["val_images"],
            class_mapping=dataset_info["classes"],
            annotation_types=job.config["annotation_types"],
            dataset_path=str(dataset_path)
        )
        db.add(dataset_record)
        db.commit()

        # Update status
        job.status = "training"
        job.started_at = datetime.utcnow()
        db.commit()

        asyncio.run(broadcast_training_update(job_id, {
            "type": "status_change",
            "status": "training"
        }))

        # Progress callback
        def progress_callback(data):
            # Update job progress
            if data["type"] == "epoch_complete":
                job.current_epoch = data["epoch"]
                job.progress_percent = (data["epoch"] / job.total_epochs) * 100
                db.commit()

            # Broadcast to WebSocket
            asyncio.run(broadcast_training_update(job_id, data))

        # Train model
        model_path, final_metrics = asyncio.run(
            training_service.train_model(
                job_id,
                dataset_path,
                job.config,
                db,
                progress_callback
            )
        )

        # Save trained model
        trained_model = TrainedModel(
            training_job_id=job_id,
            name=job.name,
            description=job.description,
            model_path=str(model_path),
            model_type=job.config["hyperparameters"]["model"],
            image_size=job.config["hyperparameters"]["imgsz"],
            classes=job.config["class_mapping"],
            num_classes=len(job.config["class_mapping"]),
            map50=final_metrics["map50"],
            map50_95=final_metrics["map50_95"],
            precision=final_metrics["precision"],
            recall=final_metrics["recall"],
            created_by=job.created_by,
            is_active=True
        )
        db.add(trained_model)
        db.commit()

        # Update job
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        job.final_metrics = final_metrics
        job.model_id = trained_model.id
        job.progress_percent = 100
        db.commit()

        # Broadcast completion
        asyncio.run(broadcast_training_update(job_id, {
            "type": "training_complete",
            "final_metrics": final_metrics,
            "model_id": str(trained_model.id)
        }))

    except Exception as e:
        # Handle error
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = datetime.utcnow()
        db.commit()

        asyncio.run(broadcast_training_update(job_id, {
            "type": "training_failed",
            "error": str(e)
        }))

    finally:
        db.close()


async def broadcast_training_update(job_id: str, data: dict):
    """Broadcast training update via WebSocket"""
    await manager.broadcast_to_image(
        f"training_{job_id}",
        data
    )
```

---

## Frontend Implementation

### Training Wizard Component

```typescript
// frontend/src/components/Training/TrainingWizard.tsx
import React, { useState } from 'react';
import {
  Stepper,
  Step,
  StepLabel,
  Button,
  Box,
  Typography
} from '@mui/material';

const steps = [
  'Model Type',
  'Select Projects',
  'Configure Annotations',
  'Train/Val Split',
  'Hyperparameters',
  'Review & Start'
];

export const TrainingWizard: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [config, setConfig] = useState({
    task_type: 'detect', // 'classify', 'detect', or 'segment'
    projects: [],
    annotation_types: [],
    class_mapping: {},
    split: { train_ratio: 0.8, val_ratio: 0.2, random_seed: 42 },
    hyperparameters: {
      model: 'yolov8n.pt',
      epochs: 100,
      batch: 16,
      imgsz: 640,
      lr0: 0.01,
      lrf: 0.01,
      momentum: 0.937,
      weight_decay: 0.0005,
      warmup_epochs: 3,
      augment: true,
      optimizer: 'auto'
    }
  });

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    const response = await trainingAPI.createJob({
      name: `Training Job ${new Date().toISOString()}`,
      config
    });

    // Navigate to training monitor
    navigate(`/training/${response.data.id}`);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Stepper activeStep={activeStep}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ mt: 4 }}>
        {activeStep === 0 && (
          <ModelTypeSelector
            selected={config.task_type}
            onChange={(taskType) => {
              // Update model type and reset hyperparameters to defaults
              const defaultModels = {
                classify: 'yolov8n-cls.pt',
                detect: 'yolov8n.pt',
                segment: 'yolov8n-seg.pt'
              };
              setConfig({
                ...config,
                task_type: taskType,
                hyperparameters: {
                  ...config.hyperparameters,
                  model: defaultModels[taskType]
                }
              });
            }}
          />
        )}

        {activeStep === 1 && (
          <ProjectSelector
            selected={config.projects}
            onChange={(projects) => setConfig({ ...config, projects })}
          />
        )}

        {activeStep === 2 && (
          <AnnotationTypeSelector
            taskType={config.task_type}  // Pass task type to show relevant options
            selected={config.annotation_types}
            classMapping={config.class_mapping}
            onChange={(types, mapping) =>
              setConfig({ ...config, annotation_types: types, class_mapping: mapping })
            }
          />
        )}

        {activeStep === 3 && (
          <SplitConfiguration
            split={config.split}
            onChange={(split) => setConfig({ ...config, split })}
          />
        )}

        {activeStep === 4 && (
          <HyperparameterEditor
            taskType={config.task_type}  // Pass task type to show relevant params
            params={config.hyperparameters}
            onChange={(params) =>
              setConfig({ ...config, hyperparameters: params })
            }
          />
        )}

        {activeStep === 5 && (
          <TrainingReview config={config} />
        )}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
        >
          Back
        </Button>
        <Box sx={{ flex: '1 1 auto' }} />
        {activeStep === steps.length - 1 ? (
          <Button variant="contained" onClick={handleSubmit}>
            Start Training
          </Button>
        ) : (
          <Button onClick={handleNext}>
            Next
          </Button>
        )}
      </Box>
    </Box>
  );
};
```

### Training Monitor Component

```typescript
// frontend/src/components/Training/TrainingMonitor.tsx
import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Grid
} from '@mui/material';
import { Line } from 'react-chartjs-2';
import { useTrainingWebSocket } from '@/hooks/useTrainingWebSocket';

export const TrainingMonitor: React.FC<{ jobId: string }> = ({ jobId }) => {
  const { status, currentEpoch, totalEpochs, metrics, isConnected } =
    useTrainingWebSocket(jobId);

  const [lossHistory, setLossHistory] = useState({
    epochs: [],
    train_loss: [],
    val_loss: []
  });

  const [mapHistory, setMapHistory] = useState({
    epochs: [],
    map50: [],
    map50_95: []
  });

  useEffect(() => {
    if (metrics) {
      setLossHistory((prev) => ({
        epochs: [...prev.epochs, metrics.epoch],
        train_loss: [...prev.train_loss, metrics.train_box_loss],
        val_loss: [...prev.val_loss, metrics.val_box_loss]
      }));

      setMapHistory((prev) => ({
        epochs: [...prev.epochs, metrics.epoch],
        map50: [...prev.map50, metrics.map50],
        map50_95: [...prev.map50_95, metrics.map50_95]
      }));
    }
  }, [metrics]);

  const progress = (currentEpoch / totalEpochs) * 100;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Training Monitor
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6">
              Epoch {currentEpoch} / {totalEpochs}
            </Typography>
            <Typography variant="h6">
              {status}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} />
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Loss Over Time
              </Typography>
              <Line
                data={{
                  labels: lossHistory.epochs,
                  datasets: [
                    {
                      label: 'Train Loss',
                      data: lossHistory.train_loss,
                      borderColor: 'rgb(75, 192, 192)',
                      tension: 0.1
                    },
                    {
                      label: 'Val Loss',
                      data: lossHistory.val_loss,
                      borderColor: 'rgb(255, 99, 132)',
                      tension: 0.1
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  scales: {
                    y: {
                      beginAtZero: true
                    }
                  }
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                mAP Over Time
              </Typography>
              <Line
                data={{
                  labels: mapHistory.epochs,
                  datasets: [
                    {
                      label: 'mAP@0.5',
                      data: mapHistory.map50,
                      borderColor: 'rgb(54, 162, 235)',
                      tension: 0.1
                    },
                    {
                      label: 'mAP@0.5:0.95',
                      data: mapHistory.map50_95,
                      borderColor: 'rgb(153, 102, 255)',
                      tension: 0.1
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 1
                    }
                  }
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        {metrics && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Current Metrics (Epoch {currentEpoch})
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={3}>
                    <Typography variant="body2" color="text.secondary">
                      Precision
                    </Typography>
                    <Typography variant="h5">
                      {(metrics.precision * 100).toFixed(2)}%
                    </Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <Typography variant="body2" color="text.secondary">
                      Recall
                    </Typography>
                    <Typography variant="h5">
                      {(metrics.recall * 100).toFixed(2)}%
                    </Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <Typography variant="body2" color="text.secondary">
                      mAP@0.5
                    </Typography>
                    <Typography variant="h5">
                      {(metrics.map50 * 100).toFixed(2)}%
                    </Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <Typography variant="body2" color="text.secondary">
                      mAP@0.5:0.95
                    </Typography>
                    <Typography variant="h5">
                      {(metrics.map50_95 * 100).toFixed(2)}%
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};
```

### useTrainingWebSocket Hook

```typescript
// frontend/src/hooks/useTrainingWebSocket.ts
import { useEffect, useRef, useState } from 'react';

export const useTrainingWebSocket = (jobId: string) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState('pending');
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [totalEpochs, setTotalEpochs] = useState(0);
  const [metrics, setMetrics] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const wsUrl = `ws://localhost:8000/api/v1/training/ws/${jobId}?token=${token}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'status_change':
          setStatus(data.status);
          break;

        case 'epoch_start':
          setCurrentEpoch(data.epoch);
          setTotalEpochs(data.total_epochs);
          break;

        case 'epoch_complete':
          setCurrentEpoch(data.epoch);
          setMetrics(data.metrics);
          break;

        case 'training_complete':
          setStatus('completed');
          setMetrics(data.final_metrics);
          break;

        case 'training_failed':
          setStatus('failed');
          console.error('Training failed:', data.error);
          break;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [jobId]);

  return {
    status,
    currentEpoch,
    totalEpochs,
    metrics,
    isConnected
  };
};
```

---

## Implementation Phases

### Phase 1: Database & API Foundation (Week 1)
- [ ] Create database tables for training jobs, models, metrics
- [ ] Implement basic training job CRUD API endpoints
- [ ] Implement model listing/details API endpoints
- [ ] Set up Celery for background tasks

### Phase 2: Training Service (Week 2)
- [ ] Implement dataset preparation (annotation conversion to YOLO)
- [ ] Implement train/val split logic
- [ ] Create training service with YOLO integration
- [ ] Add metrics collection and database storage
- [ ] Test training pipeline with sample data

### Phase 3: WebSocket Streaming (Week 3)
- [ ] Implement training progress WebSocket endpoint
- [ ] Add callbacks to stream epoch metrics
- [ ] Test real-time updates with frontend

### Phase 4: Frontend - Training Wizard (Week 4)
- [ ] Build project selection component
- [ ] Build annotation type/class mapping selector
- [ ] Build split configuration component
- [ ] Build hyperparameter editor
- [ ] Connect wizard to API

### Phase 5: Frontend - Training Monitor (Week 5)
- [ ] Build training monitor component
- [ ] Add real-time charts (loss, mAP)
- [ ] Add metrics display
- [ ] Implement WebSocket connection

### Phase 6: Model Management (Week 6)
- [ ] Build model listing interface
- [ ] Add model selection for inference
- [ ] Integrate custom models into annotation tools
- [ ] Add model performance comparison

### Phase 7: Testing & Polish (Week 7)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] Documentation updates

---

## Key Design Decisions

### 1. **Why Celery for Background Tasks?**
- Training can take hours - must run asynchronously
- Celery provides task queue, retries, and monitoring
- Can scale to multiple workers for parallel training jobs

### 2. **Why Store Metrics Per Epoch?**
- Enables historical analysis and charting
- Can resume training from checkpoints
- Helps debug training issues

### 3. **Why Convert to YOLO Format?**
- YOLO requires specific directory structure and label format
- Conversion happens once, training uses optimized format
- Cached datasets can be reused

### 4. **Why WebSocket for Progress?**
- Real-time updates without polling
- Efficient for streaming metrics every epoch
- Better UX with live charts

### 5. **Why Allow Multiple Projects?**
- Users may have related datasets across projects
- Combining data improves model generalization
- Flexibility for advanced users

---

## Task Type Comparison Summary

| Feature | Classification | Detection | Segmentation |
|---------|---------------|-----------|--------------|
| **Purpose** | Classify entire images | Detect objects with bounding boxes | Segment objects with precise masks |
| **Use Cases** | Quality control (good/bad), Defect detection, Image categorization | Particle detection, Object counting, Bounding box localization | Precise particle outlines, Cell segmentation, Instance segmentation |
| **Input Annotations** | Image-level class labels | Circles, boxes, rectangles | Polygons |
| **Output Format** | Class probabilities | Bounding boxes with class | Polygon masks with class |
| **Dataset Format** | ImageFolder (class subdirectories) | YOLO bbox format | YOLO segmentation format |
| **Model Type** | YOLOv8-cls | YOLOv8 | YOLOv8-seg |
| **Base Models** | yolov8n-cls.pt, yolov8s-cls.pt, etc. | yolov8n.pt, yolov8s.pt, etc. | yolov8n-seg.pt, yolov8s-seg.pt, etc. |
| **Metrics** | Top-1 accuracy, Top-5 accuracy | Precision, Recall, mAP@0.5, mAP@0.5:0.95 | Box mAP, Mask mAP |
| **Typical Image Size** | 224x224 | 640x640 | 640x640 |
| **Inference Speed** | Fastest | Fast | Moderate |
| **Annotation Effort** | Minimal (just class label) | Moderate (draw boxes) | High (draw polygons) |

### When to Use Each Type

**Classification:**
- Whole-image decisions needed (good/defect, pass/fail)
- No location information required
- Fastest inference
- Example: Quality inspection, material classification

**Detection:**
- Need object locations (bounding boxes)
- Count objects
- Speed is important
- Example: Particle counting, defect localization

**Segmentation:**
- Need precise object boundaries
- Overlapping objects
- Accurate size/shape measurements
- Example: Cell analysis, precise particle measurement

---

## Future Enhancements

### Model Training
- [ ] **Transfer Learning**: Fine-tune from existing custom models
- [ ] **Model Comparison**: Side-by-side comparison of trained models
- [ ] **Auto-Hyperparameter Tuning**: Grid search or Bayesian optimization
- [ ] **Distributed Training**: Multi-GPU support
- [ ] **Model Export**: Export to ONNX, TensorRT for deployment
- [ ] **Augmentation Preview**: Show augmented training samples
- [ ] **Class Imbalance Handling**: Auto-balance or weighted loss
- [ ] **Active Learning**: Suggest which images to label next
- [ ] **Model Versioning**: Track model lineage and experiments
- [ ] **Training Templates**: Save common configurations

### Multi-Task Models
- [ ] **Detection + Segmentation**: Train models that output both boxes and masks
- [ ] **Pose Estimation**: YOLOv8-pose support for keypoint detection
- [ ] **Oriented Bounding Boxes**: YOLOv8-obb for rotated object detection
