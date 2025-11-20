# Training System Usage Guide

## Overview

annotateforge now includes a complete training system that allows you to train custom YOLO models (YOLOv8) using your labeled data. The system supports three types of models:

1. **Classification (YOLOv8-cls)**: Image-level classification
2. **Detection (YOLOv8)**: Object detection with bounding boxes
3. **Segmentation (YOLOv8-seg)**: Instance segmentation with polygons

## Setup

### 1. Install Dependencies

**Backend:**
```bash
cd backend
pip install -r requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install
```

### 2. Run Database Migration

```bash
cd backend
docker-compose exec backend alembic upgrade head
```

### 3. Start Celery Worker

The training system uses Celery for background task processing. Start the Celery worker:

```bash
cd backend
celery -A celery_worker.celery_app worker --loglevel=info --queues=training
```

For development, you can run it in a separate terminal or use a process manager like `supervisord`.

### 4. Start the Application

Start backend and frontend as usual:

```bash
# Backend
cd backend
docker-compose up -d

# Frontend
cd frontend
npm run dev
```

## Using the Training System

### 1. Prepare Your Data

Before training, ensure you have:
- At least one project with images
- Images with annotations
- Annotations with class labels assigned

### 2. Create a Training Job

1. Navigate to **Training** in the top navigation
2. Click **+ New Training Job**
3. Follow the wizard steps:

#### Step 1: Task Type
- Enter a job name (required)
- Optionally add a description
- Select task type (classify, detect, or segment)

#### Step 2: Projects
- Select one or more projects to use for training data
- Multiple projects will be combined into a single dataset

#### Step 3: Classes
- Add classes by clicking "+ Add Class"
- Classes will be automatically assigned integer IDs (0, 1, 2, ...)
- For detect/segment tasks, select which annotation types to include

#### Step 4: Configuration
- **Model**: Choose YOLOv8 variant (n=nano, s=small, m=medium, l=large, x=extra large)
- **Epochs**: Number of training epochs (default: 100)
- **Batch Size**: Batch size for training (default: 16)
- **Image Size**: Input image size (224/384 for classify, 640/1280 for detect/segment)
- **Initial Learning Rate**: Starting learning rate (default: 0.01)
- **Train Ratio**: Percentage of images for training vs validation (default: 80/20)
- **Random Seed**: Seed for reproducible splits (default: 42)
- **Device**: Optional device specification (cpu, 0, 1, etc.)

#### Step 5: Review
- Review all configuration
- Click **Start Training** to begin

### 3. Monitor Training Progress

After creating a job, you'll be redirected to the training monitor:

- **Progress Bar**: Shows current epoch and overall progress
- **Status Badge**: Shows current status (pending, preparing, training, completed, failed, cancelled)
- **Live Updates**: WebSocket connection provides real-time updates
- **Metrics Chart**: Line chart showing train/val loss over time
- **Latest Metrics**: Current epoch metrics
- **Dataset Info**: Information about the prepared dataset

### 4. Manage Trained Models

Once training completes successfully:

1. Navigate to **Models** in the top navigation
2. View all your trained models
3. **Activate** a model to make it the default for that task type
4. **View Details** to see full configuration and metrics
5. **Delete** models you no longer need

## Model Types Explained

### Classification

- **Input**: Images with class labels
- **Output**: Predicted class for each image
- **Use Case**: Categorizing images (good/defect, cat/dog, etc.)
- **Metrics**: Top-1 accuracy, Top-5 accuracy
- **Annotation Requirements**: Image-level class label only

### Detection

- **Input**: Images with bounding boxes and class labels
- **Output**: Bounding boxes with class predictions
- **Use Case**: Finding objects in images (particles, defects, etc.)
- **Metrics**: Precision, Recall, mAP@50, mAP@50-95
- **Annotation Requirements**: Circles, boxes, or rectangles (converted to bboxes)

### Segmentation

- **Input**: Images with polygon annotations and class labels
- **Output**: Instance masks with class predictions
- **Use Case**: Precise object boundaries (cell segmentation, etc.)
- **Metrics**: Box mAP, Mask mAP
- **Annotation Requirements**: Polygons only

## Training Job Statuses

- **Pending**: Job created, waiting to start
- **Preparing**: Dataset is being prepared (fetching images, creating labels)
- **Training**: Model is currently training
- **Completed**: Training finished successfully
- **Failed**: Training encountered an error
- **Cancelled**: Training was cancelled by user

## Tips and Best Practices

### Dataset Preparation

1. **Minimum Data**: Have at least 100 images per class for meaningful results
2. **Balanced Classes**: Try to have similar numbers of images for each class
3. **Quality over Quantity**: Well-labeled data is more valuable than poorly labeled data
4. **Train/Val Split**: Use 80/20 or 70/30 split for most cases

### Model Selection

- **YOLOv8n**: Fastest, smallest, good for prototyping or real-time applications
- **YOLOv8s**: Good balance of speed and accuracy
- **YOLOv8m**: Better accuracy, still reasonably fast
- **YOLOv8l/x**: Best accuracy, slower inference

### Hyperparameters

- **Epochs**: Start with 100, increase if underfitting, decrease if overfitting
- **Batch Size**: Larger is better for speed, but limited by GPU memory (16 is safe)
- **Learning Rate**: Usually don't need to change from 0.01
- **Image Size**: Larger = better accuracy but slower (640 is good default for detect/segment)

### Monitoring Training

- Watch the loss curves - they should decrease over time
- If val_loss increases while train_loss decreases, you're overfitting
- If both losses are high and not decreasing, try:
  - More training data
  - More epochs
  - Different learning rate
  - Larger model

## Troubleshooting

### Training Job Fails Immediately

- Check that selected projects have images with annotations
- Ensure annotation types match task type (polygons for segment, etc.)
- Check backend logs for detailed error messages

### Training Job Stuck in "Preparing"

- Check Celery worker is running
- Check backend logs for errors
- Verify database migration completed successfully

### Out of Memory Errors

- Reduce batch size
- Use smaller model variant (e.g., yolov8n instead of yolov8m)
- Reduce image size
- Close other GPU applications

### Poor Model Performance

- Increase training data quantity
- Improve annotation quality
- Train for more epochs
- Use larger model
- Check class balance

## API Usage

For programmatic access, the training system provides REST and WebSocket APIs:

### REST Endpoints

```python
# Create training job
POST /api/v1/training/jobs
{
  "name": "My Training Job",
  "task_type": "detect",
  "config": { ... }
}

# Get job status
GET /api/v1/training/jobs/{job_id}

# List all jobs
GET /api/v1/training/jobs?status=completed&task_type=detect

# Cancel/delete job
DELETE /api/v1/training/jobs/{job_id}

# List trained models
GET /api/v1/training/models?task_type=detect&is_active=true

# Activate model
PATCH /api/v1/training/models/{model_id}/activate
```

### WebSocket

```javascript
const ws = new WebSocket('ws://localhost:8000/api/v1/training/ws/{job_id}?token={token}');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'status_change':
      console.log('Status:', message.status);
      break;
    case 'epoch_complete':
      console.log('Epoch:', message.epoch, 'Metrics:', message.metrics);
      break;
    case 'training_complete':
      console.log('Training done!', 'Model ID:', message.model_id);
      break;
  }
};
```

## Next Steps

After training a model successfully:

1. Use it for inference on new images (coming soon)
2. Export the model weights for deployment
3. Fine-tune the model on additional data
4. Compare multiple models to find the best one

For questions or issues, check the main IMPLEMENTATION.md documentation or create an issue on GitHub.
