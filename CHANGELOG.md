# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial public release preparation

## [1.0.0] - 2025-01-XX

### Added
- Multi-shape annotation support (circles, boxes, rectangles, polygons)
- AI-powered labeling with SAM2 and YOLO
- Real-time training monitoring with metrics visualization
- Training job management with Celery background tasks
- Export to YOLO and COCO formats
- Project and image management
- User authentication and authorization
- Docker Compose deployment
- Comprehensive API documentation (Swagger/ReDoc)
- WebSocket support for real-time updates
- Redis caching for improved performance

### Backend Features
- FastAPI REST API
- PostgreSQL database with SQLAlchemy ORM
- Alembic database migrations
- Celery task queue for training jobs
- SAM2 integration for segmentation
- YOLO integration for object detection
- SimpleBlob detector for particle detection
- JWT-based authentication
- CORS support

### Frontend Features
- React 18 + TypeScript
- Material-UI (MUI) v5 components
- Konva.js canvas for annotations
- Zustand state management
- React Query for server state
- Training wizard with step-by-step guidance
- Real-time training progress monitoring
- Interactive metrics charts with Recharts
- Image navigation and management
- Annotation tools (draw, edit, delete)

### Infrastructure
- Docker containerization
- Docker Compose orchestration
- PostgreSQL 15 database
- Redis 7 cache
- Nginx configuration (optional)
- Health checks for all services
- Volume management for persistence

### Documentation
- Comprehensive README
- Development guide (CLAUDE.md)
- Contributing guidelines
- Security policy
- Issue templates
- Pull request template
- MIT License

### Developer Experience
- Hot reload for frontend and backend
- Database migration tools
- Code formatting (Black, Prettier)
- Linting (ESLint)
- Type checking (mypy, TypeScript)
- Development environment setup scripts

## Version History

### Version Numbering

We use [Semantic Versioning](https://semver.org/):
- **Major version** (X.0.0): Breaking changes
- **Minor version** (0.X.0): New features, backwards compatible
- **Patch version** (0.0.X): Bug fixes, backwards compatible

### Categories

- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security vulnerability fixes

---

[Unreleased]: https://github.com/webrlabs/annotateforge/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/webrlabs/annotateforge/releases/tag/v1.0.0
