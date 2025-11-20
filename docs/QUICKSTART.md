# annotateforge - Quick Start Guide

This guide will get you up and running with annotateforge in 5 minutes.

## Prerequisites

- Docker and Docker Compose installed
- 8GB+ RAM available
- 10GB free disk space

## Step 1: Start the Application

```bash
# Navigate to the project directory
cd label-flow

# Start all services
docker-compose up -d
```

## Step 2: Wait for Services (First Time Only)

The first time you start annotateforge, it will:
1. Download Docker images (~2-3 minutes)
2. Download ML models (SAM2 ~150MB, YOLO ~6MB)
3. Initialize the database

**Monitor the startup:**
```bash
docker-compose logs -f backend
```

Wait until you see: `Application startup complete`

## Step 3: Create Admin User

```bash
docker-compose exec backend python -c "
from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

db = SessionLocal()
try:
    admin = User(
        username='admin',
        email='admin@annotateforge.com',
        hashed_password=get_password_hash('admin'),
        is_admin=True
    )
    db.add(admin)
    db.commit()
    print('✅ Admin user created!')
    print('   Username: admin')
    print('   Password: admin')
except Exception as e:
    print(f'❌ Error: {e}')
    print('   (User may already exist)')
finally:
    db.close()
"
```

## Step 4: Access the Application

Open your browser and go to:

**Frontend:** http://localhost:3000

**Login with:**
- Username: `admin`
- Password: `admin`

**API Documentation:** http://localhost:8000/docs

## Verify Installation

### Check All Services are Running

```bash
docker-compose ps
```

You should see:
- ✅ annotateforge-backend - Up
- ✅ annotateforge-frontend - Up
- ✅ annotateforge-postgres - Up (healthy)
- ✅ annotateforge-redis - Up (healthy)

### Test the API

```bash
# Health check
curl http://localhost:8000/health

# Expected response: {"status":"healthy"}
```

### Test the Frontend

1. Go to http://localhost:3000
2. You should see the login page
3. Enter: username=`admin`, password=`admin`
4. You should be redirected to the dashboard

## Common Issues

### Port Already in Use

If port 3000 or 8000 is already in use:

```bash
# Stop the conflicting service or change ports in .env
FRONTEND_PORT=3001
BACKEND_PORT=8001

# Restart
docker-compose down
docker-compose up -d
```

### Backend Won't Start

```bash
# View backend logs
docker-compose logs backend

# Common fixes:
# 1. Database not ready - wait 30 seconds and check again
# 2. Port conflict - change BACKEND_PORT in .env
# 3. Model download failed - check internet connection
```

### Can't Login

```bash
# Recreate admin user
docker-compose exec backend python -c "
from app.core.database import SessionLocal
from app.models.user import User

db = SessionLocal()
admin = db.query(User).filter(User.username == 'admin').first()
if admin:
    print('Admin user exists')
    print(f'  Username: {admin.username}')
    print(f'  Email: {admin.email}')
else:
    print('Admin user not found - run create admin script')
db.close()
"
```

## Next Steps

### 1. Create a Project

Use the API to create your first project:

```bash
# Get access token first
TOKEN=$(curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.access_token')

# Create project
curl -X POST http://localhost:8000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My First Project","description":"Test project"}'
```

### 2. Upload Images

```bash
# Upload an image (replace PROJECT_ID and path to your image)
curl -X POST http://localhost:8000/api/v1/images/projects/PROJECT_ID/images \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/your/image.jpg"
```

### 3. Run AI Inference

```bash
# SimpleBlob detection
curl -X POST http://localhost:8000/api/v1/inference/simpleblob \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "image_id": "YOUR_IMAGE_ID",
    "params": {
      "min_area": 100,
      "max_area": 1000
    }
  }'
```

## Stopping the Application

```bash
# Stop all services
docker-compose down

# Stop and remove all data (WARNING: deletes database!)
docker-compose down -v
```

## Development Mode

### Backend Development

```bash
# Backend auto-reloads on code changes
# Just edit files in backend/app/

# View logs
docker-compose logs -f backend
```

### Frontend Development

```bash
# Frontend auto-reloads on code changes
# Just edit files in frontend/src/

# View logs
docker-compose logs -f frontend
```

## Useful Commands

```bash
# View all logs
docker-compose logs -f

# Restart a service
docker-compose restart backend

# Rebuild after dependency changes
docker-compose up -d --build backend

# Access backend shell
docker-compose exec backend bash

# Access database
docker-compose exec postgres psql -U annotateforge -d annotateforge
```

## Resources

- **Full Documentation**: See `README.md`
- **Development Guide**: See `CLAUDE.md`
- **Implementation Details**: See `IMPLEMENTATION.md`
- **API Documentation**: http://localhost:8000/docs
- **Alternative API Docs**: http://localhost:8000/redoc

## Support

If you encounter any issues:

1. Check the logs: `docker-compose logs -f`
2. Verify services are healthy: `docker-compose ps`
3. Review the troubleshooting section in `README.md`
4. Check that Docker has enough resources (8GB+ RAM)

---

**You're all set!** 🎉

annotateforge is now running and ready for image annotation.
