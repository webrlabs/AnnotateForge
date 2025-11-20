# annotateforge - Implementation Guide

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Frontend Components](#frontend-components)
7. [AI Integration](#ai-integration)
8. [Real-Time Collaboration](#real-time-collaboration)
9. [Deployment](#deployment)
10. [Testing](#testing)

---

## Project Overview

**annotateforge** is a modern, web-based image annotation platform designed for teams working on computer vision projects. It provides:

- Multi-shape annotation support (circles, boxes, rectangles, polygons)
- AI-assisted labeling with SimpleBlob, YOLO, and SAM2
- Real-time collaboration for small teams (2-10 users)
- Fast image processing and navigation
- Export to YOLO, COCO, and custom formats

### Key Goals
- Sub-100ms image loading and navigation
- Real-time AI inference feedback
- Intuitive keyboard-driven workflow
- Seamless export to training formats

---

## Technology Stack

### Backend
- **Framework**: FastAPI 0.104+ (Python 3.11+)
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **ML Libraries**:
  - Ultralytics (YOLOv8 + SAM2)
  - OpenCV 4.12+
  - NumPy, PIL
- **Task Queue**: Celery (optional, for batch processing)
- **Authentication**: JWT tokens

### Frontend
- **Framework**: React 18+ with TypeScript 5+
- **Canvas Library**: Konva.js + react-konva
- **UI Components**: Material-UI (MUI) v5
- **State Management**:
  - React Query for server state
  - Zustand for client state
- **HTTP Client**: Axios
- **WebSocket**: Native WebSocket API

### DevOps
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx
- **Storage**: Local filesystem or MinIO (S3-compatible)
- **Monitoring**: Prometheus + Grafana (optional)

---

## Architecture

### System Architecture

```
┌─────────────────────────────────────┐
│         Frontend (React)            │
│  ┌──────────────────────────────┐   │
│  │   ImageCanvas (Konva.js)     │   │
│  │   ToolPanel, ImageBrowser    │   │
│  └──────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │
          REST API + WebSocket
               │
┌──────────────┴──────────────────────┐
│      Backend (FastAPI)              │
│  ┌──────────────────────────────┐   │
│  │   API Routes                 │   │
│  │   - Images, Annotations      │   │
│  │   - Inference, Auth          │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │   ML Services                │   │
│  │   - SAM2, YOLO, SimpleBlob   │   │
│  └──────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        │             │
┌───────▼──────┐ ┌───▼────────┐
│  PostgreSQL  │ │   Redis    │
│  (Data)      │ │  (Cache)   │
└──────────────┘ └────────────┘
        │
┌───────▼──────┐
│  File Storage│
│  (Images)    │
└──────────────┘
```

### Request Flow

**Standard REST Request:**
```
User -> React Component -> API Service -> FastAPI Route ->
Database -> Response -> Update UI
```

**WebSocket Inference Request:**
```
User -> Canvas Click -> WebSocket Send -> FastAPI Handler ->
SAM2/YOLO Service -> Stream Results -> Update Canvas
```

### Data Flow

1. **Image Upload**: User uploads → Backend saves original → Generate thumbnails → Store metadata → Return image_id
2. **Annotation**: User draws shape → Update local state → POST to API → Save to database → Broadcast to other users (WebSocket)
3. **AI Inference**: User clicks/draws → Send prompts via WebSocket → Run inference → Stream masks back → Convert to polygons → User accepts/edits
4. **Collaboration**: User opens image → WebSocket connect → Check Redis presence → Update/add user → Send heartbeat every 5s → Redis maintains presence → Broadcast only on real join/leave/timeout events

---

## Database Schema

### Tables

```sql
-- Projects (datasets/collections)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Images
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_path TEXT NOT NULL,
    thumbnail_path TEXT,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    file_size BIGINT,
    format VARCHAR(10),
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Annotations
CREATE TABLE annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('circle', 'box', 'rectangle', 'polygon')),
    data JSONB NOT NULL,
    confidence FLOAT,
    source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('manual', 'simpleblob', 'yolo', 'sam2')),
    class_label VARCHAR(100),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_circle_data CHECK (
        type != 'circle' OR (
            data ? 'x' AND data ? 'y' AND data ? 'size'
        )
    ),
    CONSTRAINT valid_box_data CHECK (
        type NOT IN ('box', 'rectangle') OR (
            data ? 'corners' AND jsonb_array_length(data->'corners') = 4
        )
    ),
    CONSTRAINT valid_polygon_data CHECK (
        type != 'polygon' OR (
            data ? 'points' AND jsonb_array_length(data->'points') >= 3
        )
    )
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Log (for collaboration tracking)
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NOT NULL,
    changes JSONB,
    ip_address INET,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- NOTE: Image locking has been removed - multiple users can edit simultaneously
-- Presence tracking is handled by Redis instead (see Real-Time Collaboration section)

-- Indexes
CREATE INDEX idx_images_project_id ON images(project_id);
CREATE INDEX idx_annotations_image_id ON annotations(image_id);
CREATE INDEX idx_annotations_type ON annotations(type);
CREATE INDEX idx_annotations_source ON annotations(source);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
```

### JSONB Data Structure Examples

```json
// Circle annotation
{
  "type": "circle",
  "data": {
    "x": 287.5,
    "y": 150.3,
    "size": 45.2
  }
}

// Box/Rectangle annotation
{
  "type": "box",
  "data": {
    "corners": [
      [100, 100],
      [200, 100],
      [200, 200],
      [100, 200]
    ]
  }
}

// Polygon annotation
{
  "type": "polygon",
  "data": {
    "points": [
      [50, 50],
      [100, 30],
      [120, 80],
      [90, 110],
      [40, 100]
    ]
  }
}
```

---

## API Endpoints

### Base URL: `/api/v1`

### Authentication

```http
POST /auth/register
Content-Type: application/json

{
  "username": "user1",
  "email": "user1@example.com",
  "password": "secure_password"
}

Response: 201 Created
{
  "id": "uuid",
  "username": "user1",
  "email": "user1@example.com"
}
```

```http
POST /auth/login
Content-Type: application/json

{
  "username": "user1",
  "password": "secure_password"
}

Response: 200 OK
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

### Projects

```http
GET /projects
Response: 200 OK
[
  {
    "id": "uuid",
    "name": "Project 1",
    "description": "Description",
    "image_count": 150,
    "created_at": "2025-01-10T00:00:00Z"
  }
]

POST /projects
Content-Type: application/json
{
  "name": "New Project",
  "description": "Optional description"
}

Response: 201 Created
{
  "id": "uuid",
  "name": "New Project",
  "description": "Optional description"
}
```

### Images

```http
GET /projects/{project_id}/images
Query params: ?page=1&per_page=50&sort=created_at

Response: 200 OK
{
  "items": [
    {
      "id": "uuid",
      "filename": "image001.png",
      "thumbnail_url": "/storage/thumbnails/uuid.jpg",
      "width": 1920,
      "height": 1080,
      "annotation_count": 25,
      "created_at": "2025-01-10T00:00:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "per_page": 50
}

POST /projects/{project_id}/images
Content-Type: multipart/form-data

file: [binary data]

Response: 201 Created
{
  "id": "uuid",
  "filename": "uploaded_image.png",
  "width": 1920,
  "height": 1080,
  "original_url": "/storage/original/uuid.png",
  "thumbnail_url": "/storage/thumbnails/uuid.jpg"
}

GET /images/{image_id}
Response: 200 OK
{
  "id": "uuid",
  "filename": "image001.png",
  "width": 1920,
  "height": 1080,
  "original_url": "/storage/original/uuid.png",
  "processed_url": "/storage/processed/uuid.png",
  "metadata": {
    "format": "PNG",
    "color_mode": "RGB"
  }
}
```

### Annotations

```http
GET /images/{image_id}/annotations
Response: 200 OK
[
  {
    "id": "uuid",
    "type": "circle",
    "data": {"x": 100, "y": 100, "size": 50},
    "confidence": 0.95,
    "source": "sam2",
    "class_label": "particle",
    "created_at": "2025-01-10T00:00:00Z"
  }
]

POST /images/{image_id}/annotations
Content-Type: application/json
{
  "type": "polygon",
  "data": {
    "points": [[10,10], [20,10], [15,20]]
  },
  "class_label": "particle"
}

Response: 201 Created
{
  "id": "uuid",
  "type": "polygon",
  "data": {"points": [[10,10], [20,10], [15,20]]},
  "created_at": "2025-01-10T00:00:00Z"
}

PUT /annotations/{annotation_id}
Content-Type: application/json
{
  "data": {"points": [[10,10], [25,10], [15,20]]},
  "class_label": "updated_label"
}

Response: 200 OK

DELETE /annotations/{annotation_id}
Response: 204 No Content
```

### Inference

```http
POST /inference/simpleblob
Content-Type: application/json
{
  "image_id": "uuid",
  "params": {
    "min_threshold": 40,
    "max_threshold": 255,
    "min_area": 100,
    "max_area": 1000,
    "filter_by_circularity": true
  }
}

Response: 200 OK
{
  "annotations": [
    {
      "type": "circle",
      "data": {"x": 100, "y": 100, "size": 45.2},
      "confidence": 0.8,
      "source": "simpleblob"
    }
  ]
}

POST /inference/yolo
Content-Type: application/json
{
  "image_id": "uuid",
  "model": "yolov8n.pt",
  "confidence": 0.5
}

Response: 200 OK
{
  "annotations": [
    {
      "type": "box",
      "data": {"corners": [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]},
      "confidence": 0.92,
      "source": "yolo",
      "class_label": "particle"
    }
  ]
}
```

### WebSocket Endpoints

#### Inference WebSocket

```
WS /ws/inference/{session_id}

// Client sends SAM2 request
{
  "type": "sam2_predict",
  "image_id": "uuid",
  "prompts": {
    "points": [[100, 100], [150, 150]],
    "labels": [1, 1],  // 1=positive, 0=negative
    "boxes": null
  }
}

// Server streams responses
{
  "type": "sam2_result",
  "status": "processing",
  "progress": 0.5
}

{
  "type": "sam2_result",
  "status": "complete",
  "annotations": [
    {
      "type": "polygon",
      "data": {"points": [[...], [...], ...]},
      "confidence": 0.95,
      "source": "sam2"
    }
  ]
}
```

#### Collaboration WebSocket

```
WS /api/v1/collaboration/ws/{image_id}?token={jwt_token}

// Client sends heartbeat (every 5 seconds)
{
  "type": "heartbeat"
}

// Client sends explicit leave
{
  "type": "leave"
}

// Client sends ping (every 30 seconds for keep-alive)
{
  "type": "ping"
}

// Server sends active users list
{
  "type": "active_users",
  "users": [
    {
      "user_id": "uuid",
      "username": "user1"
    },
    {
      "user_id": "uuid",
      "username": "user2"
    }
  ]
}

// Server sends pong response
{
  "type": "pong"
}

// Server broadcasts annotation changes
{
  "type": "annotation_created",
  "annotation": { /* annotation object */ },
  "user_id": "uuid"
}

{
  "type": "annotation_updated",
  "annotation": { /* annotation object */ },
  "user_id": "uuid"
}

{
  "type": "annotation_deleted",
  "annotation_id": "uuid",
  "user_id": "uuid"
}
```

### Export

```http
GET /projects/{project_id}/export?format=yolo
Response: 200 OK (ZIP file)

GET /projects/{project_id}/export?format=coco
Response: 200 OK (JSON file)

POST /images/{image_id}/export
Content-Type: application/json
{
  "format": "yolo",
  "include_confidence": true
}

Response: 200 OK
{
  "content": "0 0.5 0.5 0.2 0.2\n1 0.3 0.7 0.15 0.15",
  "format": "yolo"
}
```

---

## Frontend Components

### Directory Structure

```
frontend/src/
├── components/
│   ├── ImageCanvas/
│   │   ├── ImageCanvas.tsx          # Main Konva canvas
│   │   ├── AnnotationLayer.tsx      # Render annotations
│   │   ├── ToolLayer.tsx            # Drawing tools overlay
│   │   └── useCanvasInteraction.ts  # Mouse/keyboard handling
│   ├── ToolPanel/
│   │   ├── ToolPanel.tsx            # Tool selection sidebar
│   │   ├── ShapeTools.tsx           # Circle, box, polygon tools
│   │   ├── AITools.tsx              # SAM2, YOLO, SimpleBlob
│   │   └── ImageProcessor.tsx       # Brightness, contrast controls
│   ├── ImageBrowser/
│   │   ├── ImageBrowser.tsx         # Grid view of images
│   │   ├── ImageCard.tsx            # Individual image card
│   │   └── ImageUpload.tsx          # Drag-drop upload
│   ├── AnnotationList/
│   │   ├── AnnotationList.tsx       # List of annotations
│   │   ├── AnnotationItem.tsx       # Edit/delete controls
│   │   └── ExportDialog.tsx         # Export options
│   ├── Collaboration/
│   │   ├── ActiveUsers.tsx          # Show active users viewing image
│   │   └── LockIndicator.tsx        # DEPRECATED: Locking removed
│   ├── Annotation/
│   │   ├── AnnotationView.tsx       # Main annotation interface
│   │   └── ImageCanvas.tsx          # Konva canvas with collaboration
│   └── Layout/
│       ├── AppBar.tsx               # Top navigation
│       ├── Sidebar.tsx              # Project navigation
│       └── StatusBar.tsx            # Current tool, zoom level
├── hooks/
│   ├── useWebSocket.ts              # WebSocket connection
│   ├── useCollaboration.ts          # Collaboration WebSocket + presence
│   ├── useAnnotations.ts            # CRUD operations
│   ├── useInference.ts              # AI inference
│   ├── useImageProcessor.ts         # Image filters
│   └── useKeyboardShortcuts.ts      # Keyboard handlers
├── services/
│   ├── api.ts                       # Axios API client
│   ├── websocket.ts                 # WebSocket client
│   └── storage.ts                   # IndexedDB for offline
├── store/
│   ├── annotationStore.ts           # Zustand annotation state
│   ├── imageStore.ts                # Current image state
│   └── uiStore.ts                   # UI state (tool, zoom)
├── types/
│   ├── annotation.ts                # Annotation types
│   ├── image.ts                     # Image types
│   └── api.ts                       # API response types
└── utils/
    ├── geometry.ts                  # Shape calculations
    ├── export.ts                    # Export formatters
    └── validation.ts                # Data validation
```

### Key Components

#### ImageCanvas.tsx

```typescript
import { Stage, Layer, Image } from 'react-konva';
import { useImage } from 'react-konva-utils';

export const ImageCanvas: React.FC = () => {
  const { currentImage, annotations } = useImageStore();
  const { currentTool } = useUIStore();
  const [image] = useImage(currentImage?.url);

  const handleMouseDown = (e: KonvaEvent) => {
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;

    switch (currentTool) {
      case 'circle':
        startDrawingCircle(pos);
        break;
      case 'box':
        startDrawingBox(pos);
        break;
      case 'polygon':
        addPolygonPoint(pos);
        break;
      case 'sam2':
        sendSAM2Prompt(pos);
        break;
    }
  };

  return (
    <Stage width={window.innerWidth} height={window.innerHeight}>
      <Layer>
        <Image image={image} />
      </Layer>
      <Layer>
        {annotations.map(ann => (
          <AnnotationShape key={ann.id} annotation={ann} />
        ))}
      </Layer>
    </Stage>
  );
};
```

#### useWebSocket.ts

```typescript
export const useWebSocket = (url: string) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnected(true);
      setSocket(ws);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleMessage(data);
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect logic
    };

    return () => ws.close();
  }, [url]);

  const sendMessage = (message: any) => {
    if (socket && connected) {
      socket.send(JSON.stringify(message));
    }
  };

  return { connected, sendMessage };
};
```

### State Management

```typescript
// annotationStore.ts
import create from 'zustand';

interface AnnotationStore {
  annotations: Annotation[];
  selectedIds: string[];
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, data: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  selectAnnotation: (id: string) => void;
}

export const useAnnotationStore = create<AnnotationStore>((set) => ({
  annotations: [],
  selectedIds: [],
  addAnnotation: (annotation) =>
    set((state) => ({
      annotations: [...state.annotations, annotation],
    })),
  updateAnnotation: (id, data) =>
    set((state) => ({
      annotations: state.annotations.map((ann) =>
        ann.id === id ? { ...ann, ...data } : ann
      ),
    })),
  deleteAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((ann) => ann.id !== id),
      selectedIds: state.selectedIds.filter((sid) => sid !== id),
    })),
  selectAnnotation: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((sid) => sid !== id)
        : [...state.selectedIds, id],
    })),
}));
```

---

## AI Integration

### SAM2 Service

```python
# backend/app/services/sam2_service.py
from ultralytics import SAM
import numpy as np
from typing import List, Tuple

class SAM2Service:
    def __init__(self, model_path: str = "sam2.1_b.pt"):
        """Initialize SAM2 model"""
        self.model = SAM(model_path)

    def predict_with_points(
        self,
        image: np.ndarray,
        points: List[Tuple[int, int]],
        labels: List[int]
    ) -> List[dict]:
        """
        Predict masks from point prompts

        Args:
            image: numpy array (H, W, 3)
            points: list of (x, y) coordinates
            labels: list of 1 (positive) or 0 (negative)

        Returns:
            List of polygon annotations
        """
        results = self.model(image, points=points, labels=labels)

        annotations = []
        for mask in results[0].masks:
            polygon = self._mask_to_polygon(mask.data.numpy())
            annotations.append({
                "type": "polygon",
                "data": {"points": polygon},
                "confidence": float(mask.conf) if hasattr(mask, 'conf') else 0.95,
                "source": "sam2"
            })

        return annotations

    def predict_with_box(
        self,
        image: np.ndarray,
        bbox: Tuple[int, int, int, int]
    ) -> List[dict]:
        """
        Predict mask from bounding box prompt

        Args:
            image: numpy array (H, W, 3)
            bbox: (x1, y1, x2, y2)

        Returns:
            List of polygon annotations
        """
        results = self.model(image, bboxes=[bbox])

        annotations = []
        for mask in results[0].masks:
            polygon = self._mask_to_polygon(mask.data.numpy())
            annotations.append({
                "type": "polygon",
                "data": {"points": polygon},
                "confidence": float(mask.conf) if hasattr(mask, 'conf') else 0.95,
                "source": "sam2"
            })

        return annotations

    def _mask_to_polygon(self, mask: np.ndarray) -> List[List[int]]:
        """Convert binary mask to polygon points"""
        import cv2

        # Find contours
        contours, _ = cv2.findContours(
            mask.astype(np.uint8),
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE
        )

        if not contours:
            return []

        # Get largest contour
        largest = max(contours, key=cv2.contourArea)

        # Simplify polygon
        epsilon = 0.005 * cv2.arcLength(largest, True)
        approx = cv2.approxPolyDP(largest, epsilon, True)

        # Convert to list of [x, y] points
        points = [[int(p[0][0]), int(p[0][1])] for p in approx]

        return points
```

### YOLO Service

```python
# backend/app/services/yolo_service.py
from ultralytics import YOLO
import numpy as np
from typing import List

class YOLOService:
    def __init__(self, model_path: str = "yolov8n.pt"):
        """Initialize YOLO model"""
        self.model = YOLO(model_path)

    def predict(
        self,
        image: np.ndarray,
        confidence: float = 0.5
    ) -> List[dict]:
        """
        Predict objects in image

        Args:
            image: numpy array (H, W, 3)
            confidence: minimum confidence threshold

        Returns:
            List of box annotations
        """
        results = self.model(image, conf=confidence, verbose=False)

        annotations = []
        if len(results) > 0 and len(results[0].boxes) > 0:
            boxes = results[0].boxes
            for box in boxes:
                xyxy = box.xyxy[0].cpu().numpy()
                conf = float(box.conf[0])
                cls = int(box.cls[0])

                # Convert to corner format
                corners = [
                    [float(xyxy[0]), float(xyxy[1])],  # top-left
                    [float(xyxy[2]), float(xyxy[1])],  # top-right
                    [float(xyxy[2]), float(xyxy[3])],  # bottom-right
                    [float(xyxy[0]), float(xyxy[3])],  # bottom-left
                ]

                annotations.append({
                    "type": "box",
                    "data": {"corners": corners},
                    "confidence": conf,
                    "source": "yolo",
                    "class_label": self.model.names[cls]
                })

        return annotations
```

### SimpleBlob Service

```python
# backend/app/services/simpleblob_service.py
import cv2
import numpy as np
from typing import List, Dict

class SimpleBlobService:
    def detect(
        self,
        image: np.ndarray,
        params: Dict
    ) -> List[dict]:
        """
        Detect blobs using OpenCV SimpleBlobDetector

        Args:
            image: grayscale numpy array (H, W)
            params: detection parameters

        Returns:
            List of circle annotations
        """
        # Setup parameters
        detector_params = cv2.SimpleBlobDetector_Params()

        detector_params.blobColor = params.get('blob_color', 255)
        detector_params.minThreshold = params.get('min_threshold', 40)
        detector_params.maxThreshold = params.get('max_threshold', 255)
        detector_params.thresholdStep = params.get('threshold_step', 10)
        detector_params.minDistBetweenBlobs = max(0.01, params.get('min_distance', 0.0))

        detector_params.filterByArea = params.get('filter_by_area', True)
        detector_params.minArea = params.get('min_area', 100)
        detector_params.maxArea = params.get('max_area', 1000)

        detector_params.filterByCircularity = params.get('filter_by_circularity', False)
        detector_params.minCircularity = params.get('min_circularity', 0.1)
        detector_params.maxCircularity = params.get('max_circularity', 1.0)

        detector_params.filterByConvexity = params.get('filter_by_convexity', False)
        detector_params.minConvexity = params.get('min_convexity', 0.87)
        detector_params.maxConvexity = params.get('max_convexity', 1.0)

        detector_params.filterByInertia = params.get('filter_by_inertia', False)
        detector_params.minInertiaRatio = params.get('min_inertia_ratio', 0.01)
        detector_params.maxInertiaRatio = params.get('max_inertia_ratio', 1.0)

        # Create detector
        detector = cv2.SimpleBlobDetector_create(detector_params)

        # Detect keypoints
        keypoints = detector.detect(image)

        # Convert to annotations
        annotations = []
        for kp in keypoints:
            x, y = kp.pt
            size = kp.size

            annotations.append({
                "type": "circle",
                "data": {
                    "x": float(x),
                    "y": float(y),
                    "size": float(size)
                },
                "confidence": 0.8,
                "source": "simpleblob"
            })

        return annotations
```

### Image Processor

```python
# backend/app/services/image_processor.py
import cv2
import numpy as np
from PIL import Image
from io import BytesIO

class ImageProcessor:
    def apply_clahe(
        self,
        image: np.ndarray,
        clip_limit: float = 2.0,
        tile_grid_size: int = 8
    ) -> np.ndarray:
        """Apply Contrast Limited Adaptive Histogram Equalization"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(
            clipLimit=clip_limit,
            tileGridSize=(tile_grid_size, tile_grid_size)
        )
        enhanced = clahe.apply(gray)
        return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)

    def adjust_brightness_contrast(
        self,
        image: np.ndarray,
        brightness: int = 0,
        contrast: int = 0
    ) -> np.ndarray:
        """Adjust brightness and contrast"""
        # Brightness: add value to all pixels
        # Contrast: multiply by factor

        if brightness != 0:
            if brightness > 0:
                shadow = brightness
                highlight = 255
            else:
                shadow = 0
                highlight = 255 + brightness
            alpha_b = (highlight - shadow) / 255
            gamma_b = shadow
            image = cv2.addWeighted(image, alpha_b, image, 0, gamma_b)

        if contrast != 0:
            alpha_c = 131 * (contrast + 127) / (127 * (131 - contrast))
            gamma_c = 127 * (1 - alpha_c)
            image = cv2.addWeighted(image, alpha_c, image, 0, gamma_c)

        return image

    def generate_thumbnail(
        self,
        image: np.ndarray,
        size: int = 256
    ) -> bytes:
        """Generate thumbnail and return as JPEG bytes"""
        # Resize maintaining aspect ratio
        h, w = image.shape[:2]
        if h > w:
            new_h = size
            new_w = int(w * (size / h))
        else:
            new_w = size
            new_h = int(h * (size / w))

        resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)

        # Convert to PIL and save as JPEG
        pil_image = Image.fromarray(cv2.cvtColor(resized, cv2.COLOR_BGR2RGB))
        buffer = BytesIO()
        pil_image.save(buffer, format='JPEG', quality=85)

        return buffer.getvalue()
```

---

## Real-Time Collaboration

annotateforge implements real-time collaboration using **Redis-based persistent presence tracking**. This architecture ensures stable user presence even with unstable WebSocket connections.

### Architecture Overview

**Key Principles:**
1. **Persistent State**: User presence stored in Redis, survives WebSocket disconnections
2. **Event-Driven**: Broadcasts only on actual join/leave/timeout events
3. **Heartbeat-Based**: Clients send heartbeats to maintain presence (not connection-based)
4. **No Locking**: Multiple users can edit annotations simultaneously

**State Storage:**
- Redis Key: `presence:image:{image_id}`
- Value: Hash of `{user_id: json({username, last_seen})}`
- Timeout: 30 seconds without heartbeat

### Backend Implementation

#### Redis Presence Store

```python
# backend/app/services/redis_presence.py
import redis
import json
import time
from typing import List, Tuple

class RedisPresenceStore:
    """
    Store user presence in Redis for persistence across WebSocket reconnections.
    """

    def __init__(self, redis_url: str = "redis://redis:6379/0"):
        self.redis_client = redis.from_url(redis_url, decode_responses=True)
        self.timeout_seconds = 30  # User timeout

    def join_image(self, image_id: str, user_id: str, username: str) -> bool:
        """
        Mark user as viewing an image.

        Returns:
            True if this is a new join (user wasn't present before)
            False if user was already present (reconnection)
        """
        key = f"presence:image:{image_id}"
        was_present = self.redis_client.hexists(key, user_id)

        user_data = {
            "username": username,
            "last_seen": time.time()
        }
        self.redis_client.hset(key, user_id, json.dumps(user_data))
        self.redis_client.expire(key, self.timeout_seconds * 2)

        return not was_present

    def leave_image(self, image_id: str, user_id: str) -> Tuple[bool, str]:
        """
        Mark user as leaving an image.

        Returns:
            (was_present, username)
        """
        key = f"presence:image:{image_id}"
        user_data_str = self.redis_client.hget(key, user_id)

        if not user_data_str:
            return False, None

        user_data = json.loads(user_data_str)
        username = user_data.get("username")
        self.redis_client.hdel(key, user_id)

        return True, username

    def heartbeat(self, image_id: str, user_id: str) -> bool:
        """
        Update user's last_seen timestamp.

        Returns:
            True if user exists, False if not found
        """
        key = f"presence:image:{image_id}"
        user_data_str = self.redis_client.hget(key, user_id)

        if not user_data_str:
            return False

        user_data = json.loads(user_data_str)
        user_data["last_seen"] = time.time()
        self.redis_client.hset(key, user_id, json.dumps(user_data))

        return True

    def get_active_users(self, image_id: str) -> List[dict]:
        """
        Get list of currently active users.
        Automatically removes timed-out users.

        Returns:
            List of {user_id, username} dicts
        """
        key = f"presence:image:{image_id}"
        all_users = self.redis_client.hgetall(key)

        if not all_users:
            return []

        current_time = time.time()
        active_users = []
        expired_users = []

        for user_id, user_data_str in all_users.items():
            user_data = json.loads(user_data_str)
            last_seen = user_data.get("last_seen", 0)

            if current_time - last_seen > self.timeout_seconds:
                expired_users.append(user_id)
            else:
                active_users.append({
                    "user_id": user_id,
                    "username": user_data.get("username")
                })

        # Remove expired users
        if expired_users:
            self.redis_client.hdel(key, *expired_users)

        return active_users
```

#### WebSocket Endpoint

```python
# backend/app/api/routes/collaboration.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.redis_presence import redis_presence
from app.services.connection_manager import manager

@router.websocket("/ws/{image_id}")
async def websocket_collaboration(
    websocket: WebSocket,
    image_id: UUID,
    token: str,
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for real-time collaboration.
    Uses Redis for persistent presence state.
    """
    user = None
    cleanup_task = None

    try:
        # Authenticate user
        user = authenticate_from_token(token, db)

        # Connect WebSocket (for message routing)
        await manager.connect(websocket, str(image_id), str(user.id), user.username)

        # Join image in Redis - persists across reconnections
        is_new_join = redis_presence.join_image(str(image_id), str(user.id), user.username)

        if is_new_join:
            # REAL join - broadcast to others
            await manager.broadcast_to_image(
                str(image_id),
                {
                    "type": "active_users",
                    "users": redis_presence.get_active_users(str(image_id))
                },
                exclude=websocket
            )

        # Send current users to this connection
        active_users = redis_presence.get_active_users(str(image_id))
        await websocket.send_json({"type": "active_users", "users": active_users})

        # Start cleanup task for expired users
        cleanup_task = asyncio.create_task(
            cleanup_expired_users_periodically(str(image_id))
        )

        # Listen for messages
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "heartbeat":
                # Update timestamp - no broadcast
                redis_presence.heartbeat(str(image_id), str(user.id))

            elif message_type == "leave":
                # User explicitly leaving
                was_present, username = redis_presence.leave_image(str(image_id), str(user.id))
                if was_present:
                    await manager.broadcast_to_image(
                        str(image_id),
                        {
                            "type": "active_users",
                            "users": redis_presence.get_active_users(str(image_id))
                        }
                    )

            elif message_type == "ping":
                # Keep-alive (also acts as heartbeat)
                redis_presence.heartbeat(str(image_id), str(user.id))
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    finally:
        if cleanup_task:
            cleanup_task.cancel()

        manager.disconnect(websocket)

        # NOTE: Do NOT remove from Redis here!
        # Presence persists across WebSocket reconnections.
```

#### Connection Manager Updates

```python
# backend/app/services/connection_manager.py

class ConnectionManager:
    """
    Manages WebSocket connections for message routing.
    Does NOT handle presence - that's handled by Redis.
    """

    async def connect(self, websocket, image_id, user_id, username):
        """Connect WebSocket - NO presence broadcast"""
        await websocket.accept()

        if image_id not in self.active_connections:
            self.active_connections[image_id] = set()

        self.active_connections[image_id].add(websocket)
        self.connection_info[websocket] = {
            "image_id": image_id,
            "user_id": user_id,
            "username": username
        }

    def disconnect(self, websocket):
        """Disconnect WebSocket - NO presence broadcast"""
        if websocket not in self.connection_info:
            return

        info = self.connection_info[websocket]
        image_id = info["image_id"]

        if image_id in self.active_connections:
            self.active_connections[image_id].discard(websocket)

        del self.connection_info[websocket]
```

### Frontend Implementation

#### useCollaboration Hook

```typescript
// frontend/src/hooks/useCollaboration.ts
import { useEffect, useRef, useState, useCallback } from 'react';

export const useCollaboration = (options: UseCollaborationOptions) => {
  const { imageId, token } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Stabilize callbacks to prevent reconnections
  const callbacksRef = useRef({ onMessage, onAnnotationCreated, ... });

  useEffect(() => {
    callbacksRef.current = { onMessage, onAnnotationCreated, ... };
  }, [onMessage, onAnnotationCreated, ...]);

  const connect = useCallback(() => {
    if (!token || !imageId) return;

    const wsUrl = `ws://localhost:8000/api/v1/collaboration/ws/${imageId}?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'active_users':
          // Only update if list actually changed
          const newUsers = message.users || [];
          setActiveUsers(prev => {
            if (areUsersEqual(prev, newUsers)) {
              return prev; // Same reference prevents re-renders
            }
            return newUsers;
          });
          break;

        case 'user_joined':
        case 'user_left':
          // IGNORE - these messages are unreliable during reconnects
          // We rely solely on 'active_users' messages
          break;

        case 'annotation_created':
          callbacksRef.current.onAnnotationCreated?.(message.annotation);
          break;

        // ... other message types
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Attempt reconnect with exponential backoff
      // ...
    };

    wsRef.current = ws;
  }, [token, imageId]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      // Send explicit leave message
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'leave' }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();

    // Send leave when tab closes
    const handleBeforeUnload = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'leave' }));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      disconnect();
    };
  }, [connect, disconnect]);

  // Send heartbeat every 5 seconds
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      wsRef.current?.send(JSON.stringify({ type: 'heartbeat' }));
    }, 5000);

    return () => clearInterval(interval);
  }, [isConnected]);

  // Ping every 30 seconds for keep-alive
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      wsRef.current?.send(JSON.stringify({ type: 'ping' }));
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected]);

  return {
    activeUsers,
    isConnected,
    sendMessage,
    reconnect: connect,
  };
};
```

#### ActiveUsers Component

```typescript
// frontend/src/components/Collaboration/ActiveUsers.tsx
import { Avatar, AvatarGroup, Tooltip } from '@mui/material';

export const ActiveUsers: React.FC<ActiveUsersProps> = ({ users, currentUserId }) => {
  if (users.length === 0) return null;

  const MAX_AVATARS = 4;
  const hiddenCount = users.length > MAX_AVATARS ? users.length - MAX_AVATARS : 0;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <PeopleIcon fontSize="small" color="action" />
      <AvatarGroup max={MAX_AVATARS}>
        {users.map((user) => (
          <Tooltip key={user.user_id} title={user.username} arrow>
            <Avatar
              sx={{
                bgcolor: stringToColor(user.username),
                border: user.user_id === currentUserId ? '2px solid #1976d2' : 'none',
              }}
            >
              {getInitials(user.username)}
            </Avatar>
          </Tooltip>
        ))}
      </AvatarGroup>
      {hiddenCount > 0 && (
        <Typography variant="caption" color="text.secondary">
          +{hiddenCount} more
        </Typography>
      )}
    </Box>
  );
};
```

#### Integration in AnnotationView

```typescript
// frontend/src/components/Annotation/AnnotationView.tsx
export const AnnotationView: React.FC = () => {
  const { user } = useAuthStore();
  const { imageId } = useParams();

  // Collaboration
  const { activeUsers, isConnected } = useCollaboration({
    imageId,
    onAnnotationCreated: handleAnnotationCreated,
    onAnnotationUpdated: handleAnnotationUpdated,
    onAnnotationDeleted: handleAnnotationDeleted,
  });

  // Track user changes and show notifications
  const previousActiveUsersRef = useRef<Map<string, string>>(new Map());
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    const currentUserIds = activeUsers.map(u => u.user_id).sort();
    const previousUserIds = Array.from(previousActiveUsersRef.current.keys()).sort();

    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      previousActiveUsersRef.current = new Map(activeUsers.map(u => [u.user_id, u.username]));
      return;
    }

    // Check if actually different
    const hasChanged = currentUserIds.length !== previousUserIds.length ||
                       currentUserIds.some((id, i) => id !== previousUserIds[i]);

    if (!hasChanged) return;

    const currentUsersMap = new Map(activeUsers.map(u => [u.user_id, u.username]));

    // Find users who joined
    currentUsersMap.forEach((username, userId) => {
      if (!previousActiveUsersRef.current.has(userId) && userId !== user?.id) {
        setNotification({ message: `${username} joined`, severity: 'info' });
      }
    });

    // Find users who left
    previousActiveUsersRef.current.forEach((username, userId) => {
      if (!currentUsersMap.has(userId) && userId !== user?.id) {
        setNotification({ message: `${username} left`, severity: 'info' });
      }
    });

    previousActiveUsersRef.current = currentUsersMap;
  }, [activeUsers, user?.id]);

  return (
    <Box>
      {/* Toolbar with active users */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <ActiveUsers users={activeUsers} currentUserId={user?.id} />
      </Box>

      {/* Canvas and other components */}
      <ImageCanvas />
    </Box>
  );
};
```

### How It Works

**Join Flow:**
1. User opens image → WebSocket connects
2. Backend checks Redis: Is user already present?
   - **If NO**: Add to Redis, broadcast `active_users` to others (real join)
   - **If YES**: Update timestamp, NO broadcast (reconnection)
3. Send `active_users` to the new connection

**Heartbeat Flow:**
1. Frontend sends `heartbeat` every 5 seconds
2. Backend updates `last_seen` timestamp in Redis
3. NO broadcast (heartbeats don't trigger notifications)

**Leave Flow:**
1. User closes tab → `beforeunload` sends `leave` message
2. Backend removes user from Redis
3. Broadcast updated `active_users` to all remaining users
4. Frontend detects change and shows notification

**Timeout Flow:**
1. Background task runs every 10 seconds
2. Checks for users with `last_seen > 30 seconds ago`
3. Removes expired users from Redis
4. Broadcasts updated `active_users` if any removed

**Reconnection Flow (THE KEY PART):**
1. WebSocket disconnects (network issue, browser, etc.)
2. User still in Redis (has 30 seconds before timeout)
3. WebSocket reconnects within timeout
4. Backend sees user exists in Redis → NO broadcast
5. Other users never know about the reconnection

### Benefits

✅ **Stable Presence**: Survives WebSocket reconnections
✅ **Event-Driven**: Only broadcasts on real state changes
✅ **No False Notifications**: Reconnections don't trigger join/leave messages
✅ **Timeout Handling**: Automatic cleanup of disconnected users
✅ **Concurrent Editing**: No locking, all users can edit simultaneously

---

## Deployment

### Docker Setup

#### Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Download ML models
RUN python -c "from ultralytics import YOLO, SAM; YOLO('yolov8n.pt'); SAM('sam2.1_b.pt')"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: annotateforge
      POSTGRES_USER: annotateforge
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U annotateforge"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://annotateforge:${POSTGRES_PASSWORD}@postgres:5432/annotateforge
      REDIS_URL: redis://redis:6379/0
      SECRET_KEY: ${SECRET_KEY}
      UPLOAD_DIR: /app/storage
    volumes:
      - ./backend:/app
      - storage_data:/app/storage
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  postgres_data:
  storage_data:
```

### Environment Variables

```bash
# .env
POSTGRES_PASSWORD=your_secure_password_here
SECRET_KEY=your_jwt_secret_key_here
REDIS_URL=redis://redis:6379/0
DATABASE_URL=postgresql://annotateforge:password@postgres:5432/annotateforge

# Storage
UPLOAD_DIR=/app/storage
MAX_UPLOAD_SIZE=100MB

# ML Models
YOLO_MODEL=yolov8n.pt
SAM2_MODEL=sam2.1_b.pt

# Performance
WORKER_COUNT=4
INFERENCE_TIMEOUT=30

# Collaboration
PRESENCE_TIMEOUT_SECONDS=30
HEARTBEAT_INTERVAL_SECONDS=5
CLEANUP_INTERVAL_SECONDS=10
```

### Production Deployment

```bash
# Build and start services
docker-compose up -d

# Run database migrations
docker-compose exec backend alembic upgrade head

# Create admin user
docker-compose exec backend python -m app.cli create-user --admin

# Check logs
docker-compose logs -f backend

# Scale workers
docker-compose up -d --scale backend=3
```

---

## Testing

### Backend Tests

```python
# tests/test_annotations.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_circle_annotation():
    response = client.post(
        "/api/v1/images/test-uuid/annotations",
        json={
            "type": "circle",
            "data": {"x": 100, "y": 100, "size": 50},
            "class_label": "particle"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["type"] == "circle"
    assert data["data"]["x"] == 100

def test_sam2_inference():
    response = client.post(
        "/api/v1/inference/sam2",
        json={
            "image_id": "test-uuid",
            "prompts": {
                "points": [[100, 100]],
                "labels": [1]
            }
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "annotations" in data
    assert len(data["annotations"]) > 0
```

### Frontend Tests

```typescript
// components/ImageCanvas.test.tsx
import { render, fireEvent } from '@testing-library/react';
import { ImageCanvas } from './ImageCanvas';

describe('ImageCanvas', () => {
  it('should create circle annotation on click', () => {
    const { container } = render(<ImageCanvas />);
    const canvas = container.querySelector('canvas');

    // Select circle tool
    fireEvent.click(screen.getByLabelText('Circle Tool'));

    // Click on canvas
    fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(canvas, { clientX: 150, clientY: 150 });

    // Verify annotation created
    expect(screen.getByText('Circle')).toBeInTheDocument();
  });
});
```

### Performance Tests

```python
# tests/test_performance.py
import pytest
import time
from app.services.sam2_service import SAM2Service

def test_sam2_inference_speed():
    service = SAM2Service()
    image = load_test_image()

    start = time.time()
    results = service.predict_with_points(
        image,
        points=[[100, 100]],
        labels=[1]
    )
    duration = time.time() - start

    # Should complete in under 500ms
    assert duration < 0.5
    assert len(results) > 0
```

---

## Development Workflow

1. **Setup**: `docker-compose up -d`
2. **Backend**: Auto-reloads on code changes
3. **Frontend**: Hot module replacement (HMR)
4. **Database**: Alembic migrations for schema changes
5. **Testing**: `pytest` for backend, `npm test` for frontend
6. **Linting**: `black` + `flake8` for Python, `eslint` for TypeScript

---

## Future Enhancements

### Completed Features
- [✓] Real-time collaboration features (Redis-based presence tracking)
- [✓] Multi-user concurrent editing
- [✓] Active user presence indicators

### Planned Features
- [ ] Batch processing pipeline
- [ ] Advanced user roles and permissions
- [ ] Advanced collaboration features:
  - [ ] Live cursor tracking (show other users' cursors)
  - [ ] Live annotation editing indicators (show who's editing what)
  - [ ] Collaborative undo/redo
  - [ ] Annotation conflict resolution
- [ ] Model training integration
- [ ] Advanced analytics dashboard
- [ ] Plugin system for custom tools
- [ ] Version control for annotations
- [ ] Annotation comments and discussions
