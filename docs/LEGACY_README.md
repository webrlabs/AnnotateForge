# annotateforge 🏷️

> Fast, AI-powered image annotation for computer vision teams

annotateforge is a modern, web-based image annotation platform that combines manual labeling tools with AI-assisted suggestions from SAM2, YOLO, and OpenCV.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![React](https://img.shields.io/badge/react-18+-61dafb.svg)

---

## ✨ Features

- 🎨 **Multi-Shape Annotations**: Circles, boxes, rectangles, and polygons
- 🤖 **AI-Assisted Labeling**: SAM2, YOLO, and SimpleBlob detection
- ⚡ **Fast Performance**: Sub-100ms image navigation
- 👥 **Multi-User Support**: Real-time collaboration for teams
- 📊 **Export Formats**: YOLO, COCO, JSON, CSV
- ⌨️ **Keyboard Shortcuts**: Efficient workflow matching desktop tools
- 🎛️ **Image Processing**: Brightness, contrast, CLAHE enhancement
- 📱 **Responsive Design**: Works on desktop and tablets

---

## 🚀 Quick Start

### Prerequisites

**For HPC Deployment (Recommended for H100/A100 GPUs):**
- Python 3.11+
- CUDA 12.1+ with NVIDIA H100/A100/V100
- 32GB+ RAM (64GB recommended for SAM2)
- PostgreSQL 15+ and Redis 7+ (or conda installation)
- See [**HPC-DEPLOYMENT.md**](./HPC-DEPLOYMENT.md) for complete guide

**For Docker Deployment:**
- Docker & Docker Compose
- 8GB+ RAM (16GB recommended for SAM2)
- NVIDIA GPU (optional, for faster AI inference)

### Installation

#### Option 1: HPC Deployment (No Docker)

```bash
# 1. Load required modules
module load python/3.11 cuda/12.1 nodejs/18

# 2. Create conda environment
conda env create -f environment.yaml
conda activate annotateforge

# 3. Install PyTorch with CUDA support
pip install torch==2.1.0 --index-url https://download.pytorch.org/whl/cu121

# 4. Set up environment variables
cp .env.example .env
# Edit .env with your HPC configuration

# 5. Start services
./manage.sh start

# 6. Access the application
# Frontend: http://your-hpc-node:3000
# Backend API: http://your-hpc-node:8000
# API Docs: http://your-hpc-node:8000/docs
```

**See [HPC-DEPLOYMENT.md](./HPC-DEPLOYMENT.md) for detailed HPC setup instructions.**

#### Option 2: Docker Deployment

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/annotateforge.git
cd annotateforge

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# 3. Start the application
docker-compose up -d

# 4. Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs

# 5. Create admin user
docker-compose exec backend python -m app.cli create-user --admin
```

---

## 📖 Documentation

- [**HPC-DEPLOYMENT.md**](./HPC-DEPLOYMENT.md) - **HPC deployment guide (no Docker, H100 GPUs)**
- [**IMPLEMENTATION.md**](./IMPLEMENTATION.md) - Complete technical specification
- [**CLAUDE.md**](./CLAUDE.md) - Development guide for AI-assisted coding
- [**docker-compose.yml**](./docker-compose.yml) - Docker deployment configuration
- [**API Documentation**](http://localhost:8000/docs) - Interactive API docs (when running)

---

## 🎯 Usage

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `G` | Pan/Grab tool |
| `C` | Circle tool |
| `B` | Box tool |
| `P` | Polygon tool |
| `Delete` | Remove selected annotation |
| `Esc` | Clear selection / Cancel tool |
| `Ctrl+S` | Save annotations |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `+/-` | Zoom in/out |

### Annotation Workflow

1. **Upload Images**: Drag and drop or click to upload
2. **Select Tool**: Choose manual tool (C/B/P) or AI tool (SAM2/YOLO)
3. **Create Annotations**:
   - **Manual**: Click/drag to draw shapes
   - **AI-Assisted**: Click for SAM2 prompts or run YOLO detection
4. **Edit**: Drag vertices to adjust shapes
5. **Export**: Download annotations in your preferred format

---

## 🤖 AI Features

### SAM2 (Segment Anything Model 2)

- **Point Prompts**: Click to segment objects
- **Box Prompts**: Draw box, get precise polygon
- **Iterative Refinement**: Add positive/negative points to refine

### YOLO Detection

- **Auto-Detection**: Detect all objects in image
- **Custom Models**: Load your own trained YOLO models
- **Confidence Filtering**: Adjust detection threshold

### SimpleBlob Detection

- **Fast Baseline**: Quick particle/blob detection
- **Configurable**: Adjust size, circularity, convexity filters

---

## 🏗️ Architecture

```
┌─────────────┐
│   React     │  Frontend (Konva.js canvas)
│  Frontend   │
└──────┬──────┘
       │
   REST + WebSocket
       │
┌──────┴──────┐
│   FastAPI   │  Backend (Python)
│   Backend   │
└──────┬──────┘
       │
   ┌───┴────┐
   │        │
┌──┴──┐  ┌─┴───┐
│ PG  │  │Redis│  Database & Cache
└─────┘  └─────┘
```

**Tech Stack**:
- Frontend: React 18 + TypeScript + Konva.js + MUI
- Backend: FastAPI + PostgreSQL + Redis
- ML: Ultralytics (SAM2, YOLO), OpenCV

---

## 🛠️ Development

### Setup Development Environment

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Run tests
docker-compose exec backend pytest
docker-compose exec frontend npm test

# Format code
docker-compose exec backend black app/
docker-compose exec frontend npm run format
```

### Project Structure

```
annotateforge/
├── backend/          # FastAPI application
│   ├── app/
│   │   ├── api/      # API routes
│   │   ├── services/ # Business logic
│   │   └── models/   # Database models
│   └── tests/
├── frontend/         # React application
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   └── tests/
├── docker-compose.yml
├── IMPLEMENTATION.md
├── CLAUDE.md
└── README.md
```

### Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'feat: add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

See [CLAUDE.md](./CLAUDE.md) for detailed development guidelines.

---

## 📊 Performance

- **Image Loading**: <100ms for typical images
- **AI Inference** (with H100 GPU):
  - SAM2: <200ms per mask (H100), <500ms (A100/V100)
  - YOLO: <20ms per image (H100), <50ms (A100/V100)
  - SimpleBlob: <20ms (CPU)
- **Concurrent Users**: Supports 2-10 users
- **Image Size**: Handles 4K+ images via tiling
- **Batch Processing**: 100+ images/minute with H100

---

## 🔒 Security

- JWT-based authentication
- HTTPS/TLS encryption
- Input validation and sanitization
- SQL injection prevention (ORM-only)
- Rate limiting on API endpoints
- CORS configuration

---

## 📦 Deployment

### HPC Deployment (Recommended for H100/A100)

For HPC environments with H100 GPUs where Docker is not available:

```bash
# See complete guide in HPC-DEPLOYMENT.md

# Quick start:
conda env create -f environment.yaml
conda activate annotateforge
pip install torch==2.1.0 --index-url https://download.pytorch.org/whl/cu121

# Start services
./manage.sh start

# Or submit SLURM job
sbatch annotateforge-job.slurm
```

**See [HPC-DEPLOYMENT.md](./HPC-DEPLOYMENT.md) for complete HPC setup guide.**

### Docker Compose (Development)

```bash
docker-compose up -d
```

### Production Deployment (Docker)

```bash
# Set production environment
export ENVIRONMENT=production

# Use production docker-compose
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose exec backend alembic upgrade head

# Set up HTTPS with Let's Encrypt (Nginx)
docker-compose exec nginx certbot --nginx -d yourdomain.com
```

See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for detailed deployment instructions.

---

## 🐛 Troubleshooting

### Common Issues

**HPC Deployment:**

See [**HPC-DEPLOYMENT.md - Troubleshooting**](./HPC-DEPLOYMENT.md#troubleshooting) for:
- GPU not detected
- CUDA version mismatches
- Module loading errors
- Port conflicts
- SLURM job issues

**Docker Deployment:**

**Database connection errors:**
```bash
docker-compose restart postgres
docker-compose logs postgres
```

**SAM2 model download fails:**
```bash
docker-compose exec backend python -c "from ultralytics import SAM; SAM('sam2.1_b.pt')"
```

**Frontend not updating:**
```bash
docker-compose restart frontend
# Hard refresh browser: Ctrl+Shift+R
```

See [CLAUDE.md](./CLAUDE.md#troubleshooting) for more solutions.

---

## 📄 Export Formats

### YOLO Format

```
# class_id x_center y_center width height (normalized 0-1)
0 0.500000 0.500000 0.200000 0.200000
0 0.300000 0.700000 0.150000 0.150000
```

### COCO Format

```json
{
  "images": [...],
  "annotations": [...],
  "categories": [...]
}
```

### JSON Format

```json
[
  {
    "type": "circle",
    "data": {"x": 100, "y": 100, "size": 50},
    "confidence": 0.95,
    "source": "sam2"
  }
]
```

---

## 🗺️ Roadmap

- [x] Core annotation tools (circle, box, polygon)
- [x] SAM2 integration
- [x] YOLO integration
- [x] SimpleBlob detection
- [x] Image processing tools
- [x] Multi-user support
- [ ] Mobile app (React Native)
- [ ] Batch processing pipeline
- [ ] Model training integration
- [ ] Advanced analytics dashboard
- [ ] Plugin system
- [ ] Cloud deployment (AWS/GCP)

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built on top of the excellent [particle-object-detector](https://github.com/yourusername/particle-object-detector)
- Powered by [Ultralytics](https://github.com/ultralytics/ultralytics)
- SAM2 by [Facebook Research](https://github.com/facebookresearch/sam2)
- Inspired by [LabelImg](https://github.com/heartexlabs/labelImg) and [CVAT](https://github.com/opencv/cvat)

---

## 📧 Contact

- **Issues**: [GitHub Issues](https://github.com/yourusername/annotateforge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/annotateforge/discussions)

---

## ⭐ Star History

If you find annotateforge useful, please consider giving it a star! ⭐

---

Made with ❤️ for the computer vision community
