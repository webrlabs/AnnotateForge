# AnnotateForge - Modern Image Annotation Platform

AnnotateForge is a web-based image annotation platform designed for computer vision teams. It provides efficient labeling of particles, objects, and regions in images using manual tools and AI-assisted suggestions.

[annotation tool](./screenshots/annotation_tool.png)

## Features

- **Multi-shape Annotations**: Circles, boxes, rectangles, and polygons
- **AI-Powered Labeling**: SAM2, YOLO, and SimpleBlob detection
- **Real-time Collaboration**: Support for small teams (2-10 users)
- **Fast Image Processing**: Sub-100ms image loading and navigation
- **Export Formats**: YOLO and COCO formats
- **Modern Stack**: FastAPI backend + React frontend with TypeScript

## Technology Stack

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **ML**: Ultralytics (SAM2, YOLO), OpenCV

### Frontend
- **Framework**: React 18 + TypeScript
- **UI**: Material-UI (MUI) v5
- **Canvas**: Konva.js for image annotation
- **State Management**: Zustand
- **API Client**: Axios + React Query

## Quick Start

### Option 1: Docker (Recommended)

#### Prerequisites

- Docker and Docker Compose
- At least 8GB RAM (16GB recommended for ML models)
- 10GB free disk space

#### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/webrlabs/annotateforge.git
   cd annotateforge
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Edit .env file** with your secure passwords:
   ```bash
   # IMPORTANT: Change these values!
   POSTGRES_PASSWORD=your_secure_postgres_password
   SECRET_KEY=your_jwt_secret_key_minimum_32_characters
   ```

4. **Start the application**
   ```bash
   docker-compose up -d
   ```

5. **Wait for services to start** (first time may take 5-10 minutes to download ML models)
   ```bash
   docker-compose logs -f
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### First Time Setup

1. **Create admin user**
   ```bash
   docker-compose exec backend python -c "
   from app.core.database import SessionLocal
   from app.models.user import User
   from app.core.security import get_password_hash

   db = SessionLocal()
   admin = User(
       username='admin',
       email='admin@annotateforge.com',
       hashed_password=get_password_hash('admin'),
       is_admin=True
   )
   db.add(admin)
   db.commit()
   print('Admin user created: username=admin, password=admin')
   "
   ```

2. **Login to the application**
   - Go to http://localhost:3000
   - Username: `admin`
   - Password: `admin`

### Option 2: HPC/Native Installation (No Docker)

For HPC systems or environments where Docker is not available:

```bash
# 1. Check your environment
./check-hpc-env.sh

# 2. Load required modules (adjust for your HPC)
module load python/3.11 nodejs/18 postgresql/15 redis/7

# 3. Run automated installer
./install-hpc.sh

# 4. Configure backend/.env with database and Redis details

# 5. Initialize database
cd backend && source ../venv/bin/activate && alembic upgrade head && cd ..

# 6. Create admin user
python3 create-admin.py

# 7. Start the application
./start-annotateforge.sh
```

**For detailed HPC instructions, see:**
- `HPC-QUICKSTART.md` - Quick start guide
- `HPC_SETUP.md` - Complete setup documentation

## Development

### Backend Development

```bash
# Install dependencies
cd backend
pip install -r requirements.txt

# Run database migrations
docker-compose exec backend alembic upgrade head

# Create new migration
docker-compose exec backend alembic revision --autogenerate -m "description"

# Run tests
docker-compose exec backend pytest

# Format code
docker-compose exec backend black app/
docker-compose exec backend isort app/
```

### Frontend Development

```bash
# Install dependencies
cd frontend
npm install

# Run development server (outside Docker)
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Format code
npm run format
```

## Project Structure

```
annotateforge/
├── backend/
│   ├── app/
│   │   ├── api/          # API routes
│   │   ├── core/         # Configuration, database, security
│   │   ├── models/       # Database models
│   │   ├── schemas/      # Pydantic schemas
│   │   └── services/     # Business logic (SAM2, YOLO, etc.)
│   ├── alembic/          # Database migrations
│   ├── tests/            # Backend tests
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── services/     # API services
│   │   ├── store/        # Zustand state management
│   │   ├── types/        # TypeScript types
│   │   └── utils/        # Utility functions
│   └── package.json
├── scripts/              # Database initialization scripts
├── storage/              # Image storage (created at runtime)
├── docker-compose.yml
└── .env
```

## API Documentation

Once the backend is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Key Endpoints

**Authentication:**
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login and get JWT token
- `GET /api/v1/auth/me` - Get current user info

**Projects:**
- `GET /api/v1/projects` - List all projects
- `POST /api/v1/projects` - Create new project
- `GET /api/v1/projects/{id}` - Get project details
- `PUT /api/v1/projects/{id}` - Update project
- `DELETE /api/v1/projects/{id}` - Delete project

**Images:**
- `GET /api/v1/images/projects/{project_id}/images` - List project images
- `POST /api/v1/images/projects/{project_id}/images` - Upload image
- `GET /api/v1/images/{id}` - Get image details
- `DELETE /api/v1/images/{id}` - Delete image

**Annotations:**
- `GET /api/v1/annotations/images/{image_id}/annotations` - List image annotations
- `POST /api/v1/annotations/images/{image_id}/annotations` - Create annotation
- `PUT /api/v1/annotations/{id}` - Update annotation
- `DELETE /api/v1/annotations/{id}` - Delete annotation

**AI Inference:**
- `POST /api/v1/inference/simpleblob` - Run SimpleBlob detection
- `POST /api/v1/inference/yolo` - Run YOLO object detection
- `POST /api/v1/inference/sam2` - Run SAM2 segmentation
- `WS /ws/inference/{session_id}` - WebSocket for real-time SAM2

## Configuration

### Environment Variables

See `.env.example` for all available configuration options:

- **POSTGRES_PASSWORD**: PostgreSQL password
- **SECRET_KEY**: JWT secret key (minimum 32 characters)
- **YOLO_MODEL**: YOLO model to use (default: yolov8n.pt)
- **SAM2_MODEL**: SAM2 model to use (default: sam2.1_b.pt)
- **CORS_ORIGINS**: Allowed CORS origins
- **DEBUG**: Enable debug mode (true/false)

### ML Models

The application automatically downloads these models on first start:
- **YOLOv8n** (~6MB) - Fast object detection
- **SAM2.1 Base** (~150MB) - Segment Anything Model 2

To use different models, update the environment variables:
```bash
YOLO_MODEL=yolov8s.pt  # Small model
SAM2_MODEL=sam2.1_l.pt  # Large model
```

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Model Download Fails

```bash
# Manually download models
docker-compose exec backend python -c "
from ultralytics import SAM, YOLO
SAM('sam2.1_b.pt')
YOLO('yolov8n.pt')
"
```

### Frontend Not Loading

```bash
# Rebuild frontend
docker-compose up -d --build frontend

# Check frontend logs
docker-compose logs frontend
```

### Port Already in Use

If ports 3000 or 8000 are already in use, change them in `.env`:
```bash
FRONTEND_PORT=3001
BACKEND_PORT=8001
```

## Performance Optimization

### Backend
- Adjust worker count: `WORKER_COUNT=8`
- Increase database pool: `DATABASE_POOL_SIZE=40`
- Enable Redis caching for inference results

### Frontend
- Use production build: `npm run build`
- Enable gzip compression in nginx
- Implement lazy loading for images

## Security Best Practices

1. **Change default passwords** in `.env` file
2. **Use strong SECRET_KEY** (generate with `openssl rand -hex 32`)
3. **Enable HTTPS** in production with proper SSL certificates
4. **Restrict CORS_ORIGINS** to your actual frontend domain
5. **Keep dependencies updated**: `pip list --outdated`
6. **Enable rate limiting** for API endpoints in production

## Contributing

See `CLAUDE.md` for development guidelines and coding conventions.

## License

MIT License - see LICENSE file for details

## Support

- Documentation: See `CLAUDE.md` and `IMPLEMENTATION.md`
- Issues: Create an issue on GitHub
- API Docs: http://localhost:8000/docs

## Roadmap

- [ ] Batch image processing
- [ ] Advanced user roles and permissions
- [ ] Cloud storage integration (AWS S3, GCS)
- [ ] Mobile app support
- [ ] Real-time collaboration features
- [ ] Custom model training integration
- [ ] Analytics dashboard

---

**Built with Claude Code** - AI-assisted development
