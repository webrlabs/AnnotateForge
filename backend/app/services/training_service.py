"""Training service for YOLO model training"""
import os
import shutil
import yaml
import logging
from typing import List, Dict, Any, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from datetime import datetime
from pathlib import Path
import random

from app.models.training import TrainingJob, TrainedModel, TrainingMetric, TrainingDataset
from app.models.image import Image
from app.models.annotation import Annotation
from app.models.project import Project
from app.services.export_service import ExportService

logger = logging.getLogger(__name__)


class TrainingService:
    """Service for training YOLO models"""

    def __init__(self, db: Session, storage_dir: str = "/app/storage"):
        self.db = db
        self.storage_dir = storage_dir
        self.export_service = ExportService()
        self.training_dir = "/app/training"
        os.makedirs(self.training_dir, exist_ok=True)

    def train(self, job: TrainingJob) -> Dict[str, Any]:
        """
        Train a model based on training job configuration

        Args:
            job: TrainingJob instance

        Returns:
            dict: Training results including model_id and metrics
        """
        try:
            # Update status
            job.status = "preparing"
            job.progress_percent = 5.0
            self.db.commit()

            # Step 1: Prepare dataset
            logger.info(f"Preparing dataset for job {job.id}")
            dataset_info = self._prepare_dataset(job)

            job.progress_percent = 20.0
            self.db.commit()

            # Step 2: Train model
            logger.info(f"Training {job.task_type} model for job {job.id}")
            job.status = "training"
            self.db.commit()

            model_path, metrics = self._train_model(job, dataset_info)

            job.progress_percent = 95.0
            self.db.commit()

            # Step 3: Save trained model
            logger.info(f"Saving trained model for job {job.id}")
            trained_model = self._save_trained_model(job, dataset_info, model_path, metrics)

            # Update job as completed
            job.status = "completed"
            job.completed_at = datetime.utcnow()
            job.final_metrics = metrics
            job.model_id = trained_model.id
            job.progress_percent = 100.0
            self.db.commit()

            logger.info(f"Training job {job.id} completed successfully")

            return {
                "model_id": str(trained_model.id),
                "final_metrics": metrics
            }

        except Exception as e:
            logger.error(f"Training failed for job {job.id}: {e}")
            job.status = "failed"
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            self.db.commit()
            raise

    def _prepare_dataset(self, job: TrainingJob) -> Dict[str, Any]:
        """
        Prepare dataset for training

        Args:
            job: TrainingJob instance

        Returns:
            dict: Dataset information including paths and statistics
        """
        config = job.config
        task_type = job.task_type

        # Create dataset directory
        dataset_dir = os.path.join(self.training_dir, str(job.id))
        os.makedirs(dataset_dir, exist_ok=True)

        # Fetch images and annotations from selected projects
        project_ids = [UUID(p) for p in config['projects']]
        images = self.db.query(Image).filter(Image.project_id.in_(project_ids)).all()

        if not images:
            raise ValueError("No images found in selected projects")

        # Fetch annotations
        image_ids = [img.id for img in images]
        annotations = self.db.query(Annotation).filter(Annotation.image_id.in_(image_ids)).all()

        # Group annotations by image
        annotations_by_image = {}
        for ann in annotations:
            if ann.image_id not in annotations_by_image:
                annotations_by_image[ann.image_id] = []
            annotations_by_image[ann.image_id].append(ann)

        # Filter images that have annotations
        images_with_annotations = [
            img for img in images if img.id in annotations_by_image
        ]

        if not images_with_annotations:
            raise ValueError("No images with annotations found")

        # Check minimum dataset size
        MIN_DATASET_SIZE = 10
        if len(images_with_annotations) < MIN_DATASET_SIZE:
            raise ValueError(
                f"Insufficient images for training. Found {len(images_with_annotations)} images with annotations, "
                f"but minimum {MIN_DATASET_SIZE} images required. Please add more annotated images to your dataset."
            )

        # Split into train/val
        split_config = config.get('split', {'train_ratio': 0.8, 'val_ratio': 0.2, 'random_seed': 42})
        train_images, val_images = self._split_dataset(
            images_with_annotations,
            split_config['train_ratio'],
            split_config['random_seed']
        )

        logger.info(f"📊 Dataset split: {len(train_images)} train, {len(val_images)} val images")
        logger.info(f"📦 Preparing {task_type} dataset with {len(config.get('class_mapping', {}))} classes...")

        # Prepare dataset based on task type
        if task_type == "classify":
            dataset_info = self._prepare_classification_dataset(
                dataset_dir, train_images, val_images, annotations_by_image, config
            )
        elif task_type == "detect":
            dataset_info = self._prepare_detection_dataset(
                dataset_dir, train_images, val_images, annotations_by_image, config
            )
        elif task_type == "segment":
            dataset_info = self._prepare_segmentation_dataset(
                dataset_dir, train_images, val_images, annotations_by_image, config
            )
        else:
            raise ValueError(f"Unknown task type: {task_type}")

        # Save dataset metadata
        dataset_record = TrainingDataset(
            training_job_id=job.id,
            project_ids=[str(p) for p in project_ids],
            total_images=len(images_with_annotations),
            train_images=len(train_images),
            val_images=len(val_images),
            class_mapping=config['class_mapping'],
            annotation_types=config.get('annotation_types', []),
            dataset_path=dataset_dir
        )
        self.db.add(dataset_record)
        self.db.commit()

        return dataset_info

    def _split_dataset(self, images: List[Image], train_ratio: float, seed: int) -> Tuple[List[Image], List[Image]]:
        """Split images into train and validation sets"""
        random.seed(seed)
        shuffled = images.copy()
        random.shuffle(shuffled)

        split_idx = int(len(shuffled) * train_ratio)
        # Ensure at least 1 image in training set and 1 in validation set
        split_idx = max(1, min(split_idx, len(shuffled) - 1))

        train = shuffled[:split_idx]
        val = shuffled[split_idx:]

        return train, val

    def _prepare_classification_dataset(
        self,
        dataset_dir: str,
        train_images: List[Image],
        val_images: List[Image],
        annotations_by_image: Dict[UUID, List[Annotation]],
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Prepare dataset for classification (ImageFolder structure)

        Structure:
        dataset/
          train/
            class_0/
            class_1/
          val/
            class_0/
            class_1/
        """
        class_mapping = config['class_mapping']

        # Create directory structure
        for split in ['train', 'val']:
            for class_name in class_mapping.keys():
                class_dir = os.path.join(dataset_dir, split, class_name)
                os.makedirs(class_dir, exist_ok=True)

        # Copy images to class directories
        for split, images in [('train', train_images), ('val', val_images)]:
            for img in images:
                # Get image class from annotations
                anns = annotations_by_image.get(img.id, [])
                if not anns or not anns[0].class_label:
                    continue

                class_label = anns[0].class_label
                if class_label not in class_mapping:
                    continue

                # Copy image to class directory
                # Handle path conversion: /storage/... -> /app/storage/...
                if img.original_path.startswith("/storage/"):
                    src_path = img.original_path.replace("/storage/", self.storage_dir + "/")
                else:
                    src_path = img.original_path

                dst_path = os.path.join(dataset_dir, split, class_label, img.filename)

                if os.path.exists(src_path):
                    shutil.copy2(src_path, dst_path)
                else:
                    logger.warning(f"Image not found: {src_path} (original: {img.original_path})")

        return {
            "dataset_dir": dataset_dir,
            "num_classes": len(class_mapping),
            "classes": list(class_mapping.keys())
        }

    def _prepare_detection_dataset(
        self,
        dataset_dir: str,
        train_images: List[Image],
        val_images: List[Image],
        annotations_by_image: Dict[UUID, List[Annotation]],
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Prepare dataset for detection (YOLO format)

        Structure:
        dataset/
          images/
            train/
            val/
          labels/
            train/
            val/
          data.yaml
        """
        class_mapping = config['class_mapping']
        annotation_types = config.get('annotation_types', ['circle', 'box', 'rectangle', 'polygon'])

        # Create directory structure
        for split in ['train', 'val']:
            os.makedirs(os.path.join(dataset_dir, 'images', split), exist_ok=True)
            os.makedirs(os.path.join(dataset_dir, 'labels', split), exist_ok=True)

        # Process images and create label files
        for split, images in [('train', train_images), ('val', val_images)]:
            for img in images:
                # Copy image
                # Handle path conversion: /storage/... -> /app/storage/...
                if img.original_path.startswith("/storage/"):
                    src_path = img.original_path.replace("/storage/", self.storage_dir + "/")
                else:
                    src_path = img.original_path

                dst_path = os.path.join(dataset_dir, 'images', split, img.filename)

                if os.path.exists(src_path):
                    shutil.copy2(src_path, dst_path)
                else:
                    # Try alternative path formats
                    alt_paths = [
                        os.path.join(self.storage_dir, img.filename),
                        os.path.join(self.storage_dir, os.path.basename(img.original_path)),
                    ]
                    copied = False
                    for alt_path in alt_paths:
                        if os.path.exists(alt_path):
                            shutil.copy2(alt_path, dst_path)
                            copied = True
                            break
                    if not copied:
                        logger.error(f"Image not found: {img.filename} (tried {src_path})")

                # Create label file
                anns = annotations_by_image.get(img.id, [])
                lines = []

                for ann in anns:
                    # Filter by annotation type
                    if ann.type not in annotation_types:
                        continue

                    # Skip if no class label
                    if not ann.class_label:
                        logger.warning(f"Annotation {ann.id} in {img.filename} has no class_label - skipping")
                        continue

                    if ann.class_label not in class_mapping:
                        logger.warning(f"Annotation {ann.id} in {img.filename} has unknown class '{ann.class_label}' - skipping")
                        continue

                    class_id = class_mapping[ann.class_label]

                    # Convert to bounding box
                    x_center, y_center, width, height = self.export_service.annotation_to_bbox(
                        {'type': ann.type, 'data': ann.data},
                        img.width,
                        img.height
                    )

                    lines.append(f"{class_id} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}")

                # Write label file
                label_path = os.path.join(
                    dataset_dir, 'labels', split,
                    os.path.splitext(img.filename)[0] + '.txt'
                )
                with open(label_path, 'w') as f:
                    f.write('\n'.join(lines))

        # Create data.yaml
        data_yaml = {
            'path': dataset_dir,
            'train': 'images/train',
            'val': 'images/val',
            'nc': len(class_mapping),
            'names': list(class_mapping.keys())
        }

        yaml_path = os.path.join(dataset_dir, 'data.yaml')
        with open(yaml_path, 'w') as f:
            yaml.dump(data_yaml, f)

        return {
            "dataset_dir": dataset_dir,
            "data_yaml": yaml_path,
            "num_classes": len(class_mapping),
            "classes": list(class_mapping.keys())
        }

    def _prepare_segmentation_dataset(
        self,
        dataset_dir: str,
        train_images: List[Image],
        val_images: List[Image],
        annotations_by_image: Dict[UUID, List[Annotation]],
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Prepare dataset for segmentation (YOLO format with polygons)

        Structure:
        dataset/
          images/
            train/
            val/
          labels/
            train/
            val/
          data.yaml
        """
        class_mapping = config['class_mapping']
        annotation_types = config.get('annotation_types', ['polygon'])

        # Create directory structure
        for split in ['train', 'val']:
            os.makedirs(os.path.join(dataset_dir, 'images', split), exist_ok=True)
            os.makedirs(os.path.join(dataset_dir, 'labels', split), exist_ok=True)

        # Process images and create label files
        for split, images in [('train', train_images), ('val', val_images)]:
            for img in images:
                # Copy image
                # Handle path conversion: /storage/... -> /app/storage/...
                if img.original_path.startswith("/storage/"):
                    src_path = img.original_path.replace("/storage/", self.storage_dir + "/")
                else:
                    src_path = img.original_path

                dst_path = os.path.join(dataset_dir, 'images', split, img.filename)

                if os.path.exists(src_path):
                    shutil.copy2(src_path, dst_path)
                else:
                    logger.warning(f"Image not found: {src_path} (original: {img.original_path})")

                # Create label file
                anns = annotations_by_image.get(img.id, [])
                lines = []

                for ann in anns:
                    # Filter by annotation type
                    if ann.type not in annotation_types:
                        continue

                    # Skip if no class label
                    if not ann.class_label:
                        logger.warning(f"Annotation {ann.id} in {img.filename} has no class_label - skipping")
                        continue

                    if ann.class_label not in class_mapping:
                        logger.warning(f"Annotation {ann.id} in {img.filename} has unknown class '{ann.class_label}' - skipping")
                        continue

                    class_id = class_mapping[ann.class_label]

                    # Convert to polygon
                    polygon = self.export_service.annotation_to_polygon(
                        {'type': ann.type, 'data': ann.data},
                        img.width,
                        img.height
                    )

                    # Format: class_id x1 y1 x2 y2 ...
                    coords_str = ' '.join([f"{coord:.6f}" for coord in polygon])
                    lines.append(f"{class_id} {coords_str}")

                # Write label file
                label_path = os.path.join(
                    dataset_dir, 'labels', split,
                    os.path.splitext(img.filename)[0] + '.txt'
                )
                with open(label_path, 'w') as f:
                    f.write('\n'.join(lines))

        # Create data.yaml
        data_yaml = {
            'path': dataset_dir,
            'train': 'images/train',
            'val': 'images/val',
            'nc': len(class_mapping),
            'names': list(class_mapping.keys())
        }

        yaml_path = os.path.join(dataset_dir, 'data.yaml')
        with open(yaml_path, 'w') as f:
            yaml.dump(data_yaml, f)

        return {
            "dataset_dir": dataset_dir,
            "data_yaml": yaml_path,
            "num_classes": len(class_mapping),
            "classes": list(class_mapping.keys())
        }

    def _train_model(self, job: TrainingJob, dataset_info: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """
        Train the model using Ultralytics

        Args:
            job: TrainingJob instance
            dataset_info: Dataset information from preparation

        Returns:
            Tuple of (model_path, metrics)
        """
        from ultralytics import YOLO
        from app.models.training import TrainingMetric
        import time

        config = job.config
        hyperparameters = config['hyperparameters']
        task_type = job.task_type

        # Check if this is a restart from a previous model
        resume_from_model = config.get('resume_from_model')

        if resume_from_model and os.path.exists(resume_from_model):
            # Continue training from the previous model
            model_name = resume_from_model
            logger.info(f"📦 Loading previous model for continuation: {model_name}")
        else:
            # Start from base pretrained model
            model_name = hyperparameters.get('model', 'yolov8n.pt')
            logger.info(f"📦 Loading base model: {model_name}")

        # Load model
        model = YOLO(model_name)

        # Callback to track epoch metrics
        epoch_start_time = None

        def on_train_epoch_start(trainer):
            nonlocal epoch_start_time
            epoch_start_time = time.time()
            epoch = trainer.epoch + 1
            total_epochs = trainer.epochs
            logger.info(f"Starting epoch {epoch}/{total_epochs}...")

        def on_train_epoch_end(trainer):
            nonlocal epoch_start_time
            try:
                epoch = trainer.epoch + 1  # YOLO uses 0-indexed epochs
                total_epochs = trainer.epochs

                # Update job progress
                job.current_epoch = epoch
                job.progress_percent = 20.0 + (70.0 * epoch / total_epochs)  # 20-90% range for training
                self.db.commit()

                # Extract metrics from trainer
                metrics_data = {}

                # Try to get training loss from trainer.loss_items (available during training)
                if hasattr(trainer, 'loss_items') and trainer.loss_items is not None:
                    try:
                        loss_items = trainer.loss_items
                        if len(loss_items) >= 3:
                            metrics_data['box_loss'] = float(loss_items[0])
                            metrics_data['cls_loss'] = float(loss_items[1])
                            metrics_data['dfl_loss'] = float(loss_items[2])
                    except Exception as e:
                        logger.warning(f"Could not extract loss_items: {e}")

                # Extract validation metrics from trainer.validator
                # Note: YOLO doesn't provide validation losses, only performance metrics (mAP, precision, recall)
                if hasattr(trainer, 'validator') and trainer.validator:
                    try:
                        validator = trainer.validator
                        if hasattr(validator, 'metrics') and validator.metrics:
                            val_metrics = validator.metrics
                            if hasattr(val_metrics, 'results_dict') and val_metrics.results_dict:
                                vrd = val_metrics.results_dict

                                # Extract performance metrics from validator
                                if 'metrics/precision(B)' in vrd:
                                    metrics_data['precision'] = float(vrd['metrics/precision(B)'])
                                if 'metrics/recall(B)' in vrd:
                                    metrics_data['recall'] = float(vrd['metrics/recall(B)'])
                                if 'metrics/mAP50(B)' in vrd:
                                    metrics_data['map50'] = float(vrd['metrics/mAP50(B)'])
                                if 'metrics/mAP50-95(B)' in vrd:
                                    metrics_data['map'] = float(vrd['metrics/mAP50-95(B)'])
                    except Exception as e:
                        logger.warning(f"Could not extract validation metrics: {e}", exc_info=True)

                # Calculate epoch time
                epoch_time = time.time() - epoch_start_time if epoch_start_time else None

                # Create training metric record
                train_loss = metrics_data.get('box_loss', 0) + metrics_data.get('cls_loss', 0) + metrics_data.get('dfl_loss', 0)
                # Note: YOLO doesn't provide validation losses, so val_loss will always be None
                # Validation performance is measured via mAP, precision, and recall instead
                val_loss = metrics_data.get('val_box_loss', 0) + metrics_data.get('val_cls_loss', 0) + metrics_data.get('val_dfl_loss', 0)

                metric_record = TrainingMetric(
                    training_job_id=job.id,
                    epoch=epoch,
                    train_loss=train_loss if train_loss > 0 else None,
                    val_loss=val_loss if val_loss > 0 else None,
                    metrics=metrics_data,
                    epoch_time_seconds=epoch_time
                )
                self.db.add(metric_record)
                self.db.commit()

                # Log epoch completion with key metrics
                summary = f"Epoch {epoch}/{total_epochs} completed in {epoch_time:.1f}s"
                if train_loss > 0:
                    summary += f" | Train Loss: {train_loss:.4f}"
                if val_loss > 0:
                    summary += f" | Val Loss: {val_loss:.4f}"
                if 'map' in metrics_data:
                    summary += f" | mAP: {metrics_data['map']:.4f}"
                if 'precision' in metrics_data:
                    summary += f" | Precision: {metrics_data['precision']:.4f}"
                if 'recall' in metrics_data:
                    summary += f" | Recall: {metrics_data['recall']:.4f}"
                logger.info(summary)

            except Exception as e:
                logger.error(f"Error saving epoch metrics: {e}", exc_info=True)

        # Add callbacks to model
        model.add_callback("on_train_epoch_start", on_train_epoch_start)
        model.add_callback("on_train_epoch_end", on_train_epoch_end)

        # Training parameters
        train_params = {
            'data': dataset_info.get('data_yaml', dataset_info['dataset_dir']),
            'epochs': hyperparameters.get('epochs', 100),
            'batch': hyperparameters.get('batch', 16),
            'imgsz': hyperparameters.get('imgsz', 640),
            'lr0': hyperparameters.get('lr0', 0.01),
            'lrf': hyperparameters.get('lrf', 0.01),
            'momentum': hyperparameters.get('momentum', 0.937),
            'weight_decay': hyperparameters.get('weight_decay', 0.0005),
            'warmup_epochs': hyperparameters.get('warmup_epochs', 3),
            'augment': hyperparameters.get('augment', True),
            'optimizer': hyperparameters.get('optimizer', 'auto'),
            'project': os.path.join(self.training_dir, 'runs'),
            'name': str(job.id),
            'exist_ok': True,
            'verbose': True,
        }

        # Note: We're not using YOLO's built-in 'resume' parameter here
        # because we're already loading the previous model weights via YOLO(model_path)
        # The 'resume' parameter in YOLO is for resuming interrupted training from last.pt,
        # but we want to start fresh training with the previous model as initialization

        # Add device if specified
        if 'device' in hyperparameters and hyperparameters['device']:
            train_params['device'] = hyperparameters['device']

        # Add task-specific parameters
        if task_type == 'detect':
            train_params['iou'] = hyperparameters.get('iou', 0.7)
            train_params['conf'] = hyperparameters.get('conf', 0.001)
        elif task_type == 'segment':
            train_params['overlap_mask'] = hyperparameters.get('overlap_mask', True)
            train_params['mask_ratio'] = hyperparameters.get('mask_ratio', 4)
        elif task_type == 'classify':
            train_params['dropout'] = hyperparameters.get('dropout', 0.0)

        # Train model
        logger.info(f"🚀 Starting training: {train_params['epochs']} epochs, batch size {train_params['batch']}, image size {train_params['imgsz']}")
        results = model.train(**train_params)

        # Get best model path
        model_path = os.path.join(train_params['project'], train_params['name'], 'weights', 'best.pt')

        # Extract final metrics
        metrics = self._extract_metrics(results, task_type)

        logger.info(f"✅ Training completed! Best model saved to: {model_path}")

        return model_path, metrics

    def _extract_metrics(self, results: Any, task_type: str) -> Dict[str, Any]:
        """Extract metrics from training results"""
        metrics = {}

        if task_type == 'classify':
            metrics = {
                'top1_accuracy': float(results.results_dict.get('metrics/accuracy_top1', 0)),
                'top5_accuracy': float(results.results_dict.get('metrics/accuracy_top5', 0)),
            }
        elif task_type == 'detect':
            metrics = {
                'precision': float(results.results_dict.get('metrics/precision(B)', 0)),
                'recall': float(results.results_dict.get('metrics/recall(B)', 0)),
                'mAP50': float(results.results_dict.get('metrics/mAP50(B)', 0)),
                'mAP50-95': float(results.results_dict.get('metrics/mAP50-95(B)', 0)),
            }
        elif task_type == 'segment':
            metrics = {
                'box_precision': float(results.results_dict.get('metrics/precision(B)', 0)),
                'box_recall': float(results.results_dict.get('metrics/recall(B)', 0)),
                'box_mAP50': float(results.results_dict.get('metrics/mAP50(B)', 0)),
                'box_mAP50-95': float(results.results_dict.get('metrics/mAP50-95(B)', 0)),
                'mask_precision': float(results.results_dict.get('metrics/precision(M)', 0)),
                'mask_recall': float(results.results_dict.get('metrics/recall(M)', 0)),
                'mask_mAP50': float(results.results_dict.get('metrics/mAP50(M)', 0)),
                'mask_mAP50-95': float(results.results_dict.get('metrics/mAP50-95(M)', 0)),
            }

        return metrics

    def _save_trained_model(
        self,
        job: TrainingJob,
        dataset_info: Dict[str, Any],
        model_path: str,
        metrics: Dict[str, Any]
    ) -> TrainedModel:
        """Save trained model to database"""
        config = job.config
        hyperparameters = config['hyperparameters']

        # Refresh job to ensure we have the latest data including created_by
        self.db.refresh(job)

        # Generate unique model name
        base_name = job.name
        model_name = base_name
        counter = 1

        # Check if name already exists and make it unique
        while self.db.query(TrainedModel).filter(TrainedModel.name == model_name).first():
            from datetime import datetime
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            model_name = f"{base_name}_{timestamp}"

            # If timestamp version also exists, add counter
            if self.db.query(TrainedModel).filter(TrainedModel.name == model_name).first():
                model_name = f"{base_name}_{timestamp}_{counter}"
                counter += 1
            else:
                break

        # Create model record
        model = TrainedModel(
            training_job_id=job.id,
            name=model_name,
            description=job.description,
            task_type=job.task_type,
            model_path=model_path,
            model_type='yolov8',
            image_size=hyperparameters.get('imgsz', 640),
            num_classes=dataset_info['num_classes'],
            classes=config['class_mapping'],
            performance_metrics=metrics,
            created_by=job.created_by,
            is_active=True
        )

        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)

        logger.info(f"Saved trained model {model.id} with name '{model_name}' for user {model.created_by}")

        return model
