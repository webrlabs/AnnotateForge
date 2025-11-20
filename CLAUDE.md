# AnnotateForge - Claude Development Guide

This guide provides context and conventions for AI-assisted development of AnnotateForge using Claude or similar AI assistants.

---

## Project Context

### What is AnnotateForge?

AnnotateForge is a modern, web-based image annotation platform for computer vision teams. It enables efficient labeling of particles, objects, and regions in images using manual tools and AI-assisted suggestions.

**Key Features:**
- Multi-shape annotations (circles, boxes, rectangles, polygons)
- AI-powered labeling (SAM2, YOLO, SimpleBlob)
- Real-time collaboration for small teams
- Fast image processing and navigation
- Export to YOLO, COCO formats

**Technology Stack:**
- **Backend**: FastAPI (Python 3.11+)
- **Frontend**: React 18 + TypeScript + Konva.js
- **Database**: PostgreSQL 15+
- **Cache**: Redis
- **ML**: Ultralytics (SAM2, YOLO), OpenCV

---

## Project Goals

1. **Speed**: Sub-100ms image loading and navigation
2. **Accuracy**: AI-assisted labeling with SAM2 for precise masks
3. **Usability**: Keyboard-driven workflow matching Qt label_tool
4. **Collaboration**: Support 2-10 concurrent users
5. **Export**: Seamless export to training formats

---

## Code Style and Conventions

### Python (Backend)

**Style Guide**: PEP 8 with Black formatting

```python
# Good example
async def get_annotations(
    image_id: UUID,
    db: Session = Depends(get_db)
) -> List[AnnotationResponse]:
    """
    Retrieve all annotations for an image.

    Args:
        image_id: UUID of the image
        db: Database session

    Returns:
        List of annotations with full data
    """
    annotations = await db.query(Annotation).filter(
        Annotation.image_id == image_id
    ).all()
    return annotations
```

**Naming Conventions:**
- Functions: `snake_case`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Private methods: `_leading_underscore`

**Type Hints**: Always use type hints for function signatures

```python
def process_image(image: np.ndarray, params: Dict[str, Any]) -> np.ndarray:
    pass
```

**Async/Await**: Use async for I/O operations

```python
# Database operations
async def create_annotation(annotation: AnnotationCreate) -> Annotation:
    pass

# Not async - CPU-bound ML inference
def run_sam2_inference(image: np.ndarray) -> List[dict]:
    pass
```

### TypeScript (Frontend)

**Style Guide**: Airbnb + Prettier

```typescript
// Good example
interface AnnotationData {
  type: 'circle' | 'box' | 'polygon';
  data: CircleData | BoxData | PolygonData;
  confidence?: number;
}

export const AnnotationShape: React.FC<AnnotationShapeProps> = ({
  annotation,
  isSelected,
  onSelect,
}) => {
  const handleClick = useCallback(() => {
    onSelect(annotation.id);
  }, [annotation.id, onSelect]);

  return (
    <Shape
      {...getShapeProps(annotation)}
      onClick={handleClick}
      fill={isSelected ? 'red' : 'blue'}
    />
  );
};
```

**Naming Conventions:**
- Components: `PascalCase`
- Hooks: `useCamelCase`
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Types/Interfaces: `PascalCase`

**Component Structure:**
1. Imports
2. Type definitions
3. Component declaration
4. Hooks
5. Event handlers
6. Render logic
7. Exports

### File Organization

```
backend/app/
├── api/          # API routes
├── services/     # Business logic
├── models/       # Database models
├── schemas/      # Pydantic schemas
└── core/         # Configuration, dependencies

frontend/src/
├── components/   # React components
├── hooks/        # Custom hooks
├── services/     # API clients
├── store/        # State management
├── types/        # TypeScript types
└── utils/        # Helper functions
```

---

## Development Patterns

### Backend Patterns

#### 1. Route Definition

```python
# app/api/routes/annotations.py
from fastapi import APIRouter, Depends, HTTPException
from typing import List
from uuid import UUID

router = APIRouter(prefix="/annotations", tags=["annotations"])

@router.get("/{annotation_id}", response_model=AnnotationResponse)
async def get_annotation(
    annotation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get annotation by ID"""
    annotation = await db.get(Annotation, annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
    return annotation
```

#### 2. Service Layer

```python
# app/services/annotation_service.py
class AnnotationService:
    def __init__(self, db: Session):
        self.db = db

    async def create(self, data: AnnotationCreate) -> Annotation:
        """Create new annotation"""
        annotation = Annotation(**data.dict())
        self.db.add(annotation)
        await self.db.commit()
        await self.db.refresh(annotation)
        return annotation

    async def get_by_image(self, image_id: UUID) -> List[Annotation]:
        """Get all annotations for an image"""
        return await self.db.query(Annotation).filter(
            Annotation.image_id == image_id
        ).all()
```

#### 3. WebSocket Handler

```python
# app/api/websocket.py
@app.websocket("/ws/inference/{session_id}")
async def inference_websocket(
    websocket: WebSocket,
    session_id: str
):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()

            if data["type"] == "sam2_predict":
                # Run inference
                results = await run_sam2_inference(data)

                # Stream progress
                await websocket.send_json({
                    "type": "progress",
                    "value": 0.5
                })

                # Send results
                await websocket.send_json({
                    "type": "sam2_result",
                    "data": results
                })

    except WebSocketDisconnect:
        print(f"Client disconnected: {session_id}")
```

### Frontend Patterns

#### 1. Component with Hooks

```typescript
// components/ImageCanvas/ImageCanvas.tsx
export const ImageCanvas: React.FC = () => {
  const { currentImage } = useImageStore();
  const { annotations, addAnnotation } = useAnnotationStore();
  const { currentTool } = useUIStore();

  const [image] = useImage(currentImage?.url);

  const handleMouseDown = useCallback((e: KonvaEvent) => {
    const pos = getPointerPosition(e);
    if (!pos) return;

    switch (currentTool) {
      case 'circle':
        startDrawingCircle(pos);
        break;
      case 'box':
        startDrawingBox(pos);
        break;
    }
  }, [currentTool]);

  useKeyboardShortcuts({
    'c': () => setTool('circle'),
    'b': () => setTool('box'),
    'Delete': () => deleteSelected(),
  });

  return (
    <Stage width={width} height={height}>
      <Layer>
        <Image image={image} />
      </Layer>
      <Layer>
        {annotations.map(ann => (
          <AnnotationShape
            key={ann.id}
            annotation={ann}
          />
        ))}
      </Layer>
    </Stage>
  );
};
```

#### 2. Custom Hook

```typescript
// hooks/useWebSocket.ts
export const useWebSocket = (url: string) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected');

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setSocket(ws);
      setStatus('connected');
    };

    ws.onclose = () => {
      setStatus('disconnected');
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        setSocket(null);
      }, 3000);
    };

    return () => {
      ws.close();
    };
  }, [url]);

  const sendMessage = useCallback((message: any) => {
    if (socket && status === 'connected') {
      socket.send(JSON.stringify(message));
    }
  }, [socket, status]);

  return { status, sendMessage };
};
```

#### 3. API Service

```typescript
// services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const annotationAPI = {
  getAll: (imageId: string) =>
    api.get<Annotation[]>(`/images/${imageId}/annotations`),

  create: (imageId: string, data: AnnotationCreate) =>
    api.post<Annotation>(`/images/${imageId}/annotations`, data),

  update: (annotationId: string, data: AnnotationUpdate) =>
    api.put<Annotation>(`/annotations/${annotationId}`, data),

  delete: (annotationId: string) =>
    api.delete(`/annotations/${annotationId}`),
};
```

---

## Testing Requirements

### Backend Tests

**Location**: `backend/tests/`

**Required Coverage**: >80%

```python
# tests/test_annotations.py
import pytest
from fastapi.testclient import TestClient

def test_create_circle_annotation(client: TestClient, auth_headers):
    response = client.post(
        "/api/v1/images/test-uuid/annotations",
        json={
            "type": "circle",
            "data": {"x": 100, "y": 100, "size": 50}
        },
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["type"] == "circle"
    assert "id" in data

def test_sam2_inference_performance(sam2_service):
    """SAM2 should complete in under 500ms"""
    import time
    image = load_test_image()

    start = time.time()
    results = sam2_service.predict_with_points(
        image, points=[[100, 100]], labels=[1]
    )
    duration = time.time() - start

    assert duration < 0.5
    assert len(results) > 0
```

### Frontend Tests

**Location**: `frontend/src/__tests__/`

**Tools**: Jest + React Testing Library

```typescript
// __tests__/ImageCanvas.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ImageCanvas } from '../components/ImageCanvas';

describe('ImageCanvas', () => {
  it('should create circle on drag', async () => {
    const { container } = render(<ImageCanvas />);
    const canvas = container.querySelector('canvas');

    fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 150, clientY: 150 });
    fireEvent.mouseUp(canvas, { clientX: 150, clientY: 150 });

    await waitFor(() => {
      expect(screen.getByTestId('circle-annotation')).toBeInTheDocument();
    });
  });
});
```

---

## Git Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates
- `test/description` - Test additions

### Commit Messages

Follow Conventional Commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples:**

```
feat(frontend): add polygon drawing tool

Implement polygon annotation tool with vertex editing.
Users can click to add points and press Enter to complete.

Closes #42
```

```
fix(backend): resolve SAM2 memory leak

SAM2 models were not being released after inference.
Added explicit cleanup in finally block.

Fixes #87
```

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Screenshots (if applicable)
[Add screenshots here]

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests pass locally
- [ ] Documentation updated
```

---

## Common Tasks

### Starting Development Environment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down

# Rebuild after dependency changes
docker-compose up -d --build
```

### Database Migrations

```bash
# Create new migration
docker-compose exec backend alembic revision --autogenerate -m "Add user table"

# Apply migrations
docker-compose exec backend alembic upgrade head

# Rollback migration
docker-compose exec backend alembic downgrade -1
```

### Adding New Dependencies

**Backend:**
```bash
# Add to requirements.txt
echo "new-package==1.0.0" >> backend/requirements.txt

# Rebuild container
docker-compose up -d --build backend
```

**Frontend:**
```bash
# Inside frontend container
docker-compose exec frontend npm install new-package

# Or rebuild
docker-compose up -d --build frontend
```

### Running Tests

```bash
# Backend tests
docker-compose exec backend pytest

# Frontend tests
docker-compose exec frontend npm test

# Coverage report
docker-compose exec backend pytest --cov=app --cov-report=html
```

### Code Formatting

```bash
# Backend (Black + isort)
docker-compose exec backend black app/
docker-compose exec backend isort app/

# Frontend (Prettier + ESLint)
docker-compose exec frontend npm run lint
docker-compose exec frontend npm run format
```

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

**Symptom**: `connection refused` or `could not connect`

**Solutions:**
```bash
# Check postgres is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart postgres
docker-compose restart postgres
```

#### 2. SAM2/YOLO Model Download Fails

**Symptom**: Model download hangs or fails

**Solutions:**
```bash
# Manually download models
docker-compose exec backend python -c "from ultralytics import SAM; SAM('sam2.1_b.pt')"

# Check disk space
df -h

# Check network connectivity
docker-compose exec backend ping -c 4 github.com
```

#### 3. Frontend Hot Reload Not Working

**Symptom**: Changes not reflected in browser

**Solutions:**
```bash
# Restart frontend container
docker-compose restart frontend

# Check for compilation errors
docker-compose logs frontend

# Clear browser cache
# Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
```

#### 4. WebSocket Connection Drops

**Symptom**: Real-time inference stops working

**Solutions:**
```typescript
// Add reconnection logic
useEffect(() => {
  const connect = () => {
    const ws = new WebSocket(url);
    ws.onclose = () => {
      console.log('Disconnected, reconnecting...');
      setTimeout(connect, 3000);
    };
  };
  connect();
}, []);
```

#### 5. High Memory Usage

**Symptom**: Docker containers using too much RAM

**Solutions:**
```yaml
# docker-compose.yml - Add memory limits
services:
  backend:
    mem_limit: 4g
    memswap_limit: 4g
```

```python
# Backend - Release models after inference
def run_inference():
    model = SAM('sam2.1_b.pt')
    try:
        results = model(image)
        return results
    finally:
        del model
        torch.cuda.empty_cache()  # If using GPU
```

---

## Performance Optimization

### Backend Optimization

1. **Cache Inference Results**

```python
# Use Redis for caching
from redis import Redis
import pickle

cache = Redis.from_url(settings.REDIS_URL)

def cached_inference(image_id: str, prompts: dict):
    cache_key = f"sam2:{image_id}:{hash(str(prompts))}"

    # Check cache
    cached = cache.get(cache_key)
    if cached:
        return pickle.loads(cached)

    # Run inference
    results = sam2_service.predict(image, prompts)

    # Cache for 1 hour
    cache.setex(cache_key, 3600, pickle.dumps(results))

    return results
```

2. **Async Database Queries**

```python
# Use async SQLAlchemy
from sqlalchemy.ext.asyncio import AsyncSession

async def get_annotations(image_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(Annotation).filter(Annotation.image_id == image_id)
    )
    return result.scalars().all()
```

3. **Batch Processing**

```python
# Process multiple images in parallel
from concurrent.futures import ThreadPoolExecutor

def batch_inference(image_ids: List[UUID]):
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = executor.map(run_inference, image_ids)
    return list(results)
```

### Frontend Optimization

1. **Lazy Load Annotations**

```typescript
// Only load annotations for visible images
const { data: annotations } = useQuery(
  ['annotations', currentImageId],
  () => annotationAPI.getAll(currentImageId),
  { enabled: !!currentImageId }
);
```

2. **Virtualized Image List**

```typescript
// Use react-window for large lists
import { FixedSizeGrid } from 'react-window';

<FixedSizeGrid
  columnCount={4}
  columnWidth={256}
  height={window.innerHeight}
  rowCount={Math.ceil(images.length / 4)}
  rowHeight={256}
  width={window.innerWidth}
>
  {ImageCell}
</FixedSizeGrid>
```

3. **Debounce Expensive Operations**

```typescript
// Debounce SAM2 requests
import { useDebouncedCallback } from 'use-debounce';

const debouncedSAM2 = useDebouncedCallback(
  (prompts) => {
    sendSAM2Request(prompts);
  },
  300
);
```

---

## Security Considerations

### Authentication

```python
# Use JWT tokens with expiration
from datetime import datetime, timedelta
import jwt

def create_access_token(user_id: UUID) -> str:
    payload = {
        "user_id": str(user_id),
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
```

### Input Validation

```python
# Always validate user input
from pydantic import BaseModel, Field, validator

class AnnotationCreate(BaseModel):
    type: Literal["circle", "box", "polygon"]
    data: dict

    @validator('data')
    def validate_data(cls, v, values):
        annotation_type = values.get('type')
        if annotation_type == 'circle':
            required = ['x', 'y', 'size']
            if not all(k in v for k in required):
                raise ValueError(f"Circle requires: {required}")
        return v
```

### SQL Injection Prevention

```python
# Use SQLAlchemy ORM, never raw SQL with user input
# Good
annotations = db.query(Annotation).filter(
    Annotation.image_id == image_id
).all()

# Bad - vulnerable to SQL injection
# annotations = db.execute(f"SELECT * FROM annotations WHERE image_id = '{image_id}'")
```

---

## Deployment Checklist

- [ ] Set strong `SECRET_KEY` in production
- [ ] Use HTTPS (TLS certificates)
- [ ] Enable CORS with specific origins
- [ ] Set up database backups
- [ ] Configure Redis persistence
- [ ] Add rate limiting to API endpoints
- [ ] Set up logging and monitoring
- [ ] Use environment variables for secrets
- [ ] Enable database connection pooling
- [ ] Configure firewall rules
- [ ] Set up health check endpoints
- [ ] Create deployment documentation

---

## API Development Guidelines

### Endpoint Design

1. **Use RESTful conventions**
   - `GET` for retrieval
   - `POST` for creation
   - `PUT` for full updates
   - `PATCH` for partial updates
   - `DELETE` for deletion

2. **Use plural nouns for resources**
   - `/api/v1/annotations` (good)
   - `/api/v1/annotation` (bad)

3. **Version your API**
   - `/api/v1/...`
   - Allows breaking changes in v2

4. **Return appropriate status codes**
   - `200 OK` - Success
   - `201 Created` - Resource created
   - `204 No Content` - Success, no body
   - `400 Bad Request` - Invalid input
   - `401 Unauthorized` - Not authenticated
   - `403 Forbidden` - Not authorized
   - `404 Not Found` - Resource not found
   - `500 Internal Server Error` - Server error

---

## Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [Konva.js Documentation](https://konvajs.org/)
- [Ultralytics Documentation](https://docs.ultralytics.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

## Questions to Ask Claude

When working with Claude on this project, here are helpful prompts:

**For new features:**
> "I want to add [feature description] to LabelFlow. Based on the existing architecture in IMPLEMENTATION.md, what components need to be created or modified?"

**For debugging:**
> "I'm seeing [error message] when [action]. Can you help debug this? Here's the relevant code: [paste code]"

**For code review:**
> "Can you review this code for [component name]? Check for: 1) adherence to project patterns, 2) performance issues, 3) security concerns."

**For testing:**
> "Generate unit tests for [function/component] that cover edge cases and follow the testing patterns in CLAUDE.md."

**For optimization:**
> "This [operation] is slow. Based on the performance optimization section in CLAUDE.md, what improvements can we make?"

---

## Project Philosophy

1. **User First**: Prioritize responsiveness and keyboard shortcuts
2. **AI-Assisted**: Use AI to accelerate labeling, not replace human judgment
3. **Keep It Simple**: Start with core features, add complexity only when needed
4. **Test Early**: Write tests alongside features
5. **Document As You Go**: Update docs when adding features
6. **Performance Matters**: Optimize for the common case (small teams, <10K images)

Happy coding! 🚀
