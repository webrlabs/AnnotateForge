# annotateforge HPC Deployment Guide

> Deployment instructions for HPC environments without Docker (optimized for H100 GPUs)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Running Services](#running-services)
6. [GPU Configuration](#gpu-configuration)
7. [Process Management](#process-management)
8. [Database Setup](#database-setup)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **OS**: Linux (RHEL, Ubuntu, or similar)
- **Python**: 3.11+
- **Node.js**: 18+
- **GPU**: NVIDIA H100 (or A100/V100)
- **CUDA**: 12.1+
- **RAM**: 32GB+ (64GB recommended for SAM2)
- **Storage**: 100GB+ for models and data

### Required Services

You'll need access to (either HPC-provided or self-hosted):
- PostgreSQL 15+
- Redis 7+
- Nginx (for production)

### Check HPC Available Services

```bash
# Check if PostgreSQL is available
module avail postgres

# Check if Redis is available
module avail redis

# Check CUDA version
nvidia-smi
nvcc --version
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  HPC Login Node (Frontend Build)               │
└─────────────────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────┐
│  HPC Compute Node (Backend + Services)         │
│                                                 │
│  ┌──────────────┐  ┌──────────────┐           │
│  │   FastAPI    │  │  PostgreSQL  │           │
│  │   Backend    │  │   Database   │           │
│  │  (Port 8000) │  │  (Port 5432) │           │
│  └──────┬───────┘  └──────────────┘           │
│         │                                       │
│  ┌──────┴───────┐  ┌──────────────┐           │
│  │    Redis     │  │   Nginx      │           │
│  │ (Port 6379)  │  │  (Port 80)   │           │
│  └──────────────┘  └──────────────┘           │
│                                                 │
│  GPU: H100 (CUDA 12.1+)                        │
└─────────────────────────────────────────────────┘
```

**Deployment Strategy:**
- Frontend: Build static files on login node, serve via Nginx
- Backend: Run on compute node with GPU access
- Database: Use HPC-provided PostgreSQL or run on compute node
- Redis: Use HPC-provided Redis or run on compute node

---

## Installation

### 1. Create Project Directory

```bash
# Navigate to your workspace
cd $HOME/projects  # or /scratch/$USER
mkdir annotateforge
cd annotateforge
```

### 2. Clone/Create Project Structure

```bash
# Create directory structure
mkdir -p backend/app/{api,services,models,core}
mkdir -p frontend/src/{components,hooks,services,store}
mkdir -p scripts
mkdir -p storage/{uploads,models}
mkdir -p logs
```

### 3. Set Up Backend Environment

```bash
# Load required modules (adjust for your HPC)
module load python/3.11
module load cuda/12.1
module load gcc/11.2

# Create conda environment
conda create -n annotateforge python=3.11 -y
conda activate annotateforge

# Install dependencies
pip install fastapi==0.104.1 \
    uvicorn[standard]==0.24.0 \
    sqlalchemy==2.0.23 \
    asyncpg==0.29.0 \
    alembic==1.12.1 \
    redis==5.0.1 \
    python-multipart==0.0.6 \
    python-jose[cryptography]==3.3.0 \
    passlib[bcrypt]==1.7.4 \
    opencv-python==4.12.0.90 \
    numpy==1.26.2 \
    pillow==10.1.0 \
    pydantic==2.5.0 \
    pydantic-settings==2.1.0 \
    websockets==12.0

# Install ML libraries with CUDA support
pip install torch==2.1.0 --index-url https://download.pytorch.org/whl/cu121
pip install ultralytics==8.3.226

# Verify GPU access
python -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
python -c "import torch; print(f'GPU count: {torch.cuda.device_count()}')"
```

### 4. Set Up Frontend Environment

```bash
# Load Node.js module
module load nodejs/18

# Navigate to frontend directory
cd frontend

# Initialize React + TypeScript project
npm create vite@latest . -- --template react-ts

# Install dependencies
npm install \
    react-konva konva \
    @tanstack/react-query \
    zustand \
    axios \
    @mui/material @mui/icons-material @emotion/react @emotion/styled \
    react-router-dom

# Install dev dependencies
npm install -D \
    @types/react @types/react-dom \
    @vitejs/plugin-react \
    typescript \
    eslint eslint-plugin-react-hooks \
    prettier
```

---

## Configuration

### 1. Create Environment Configuration

```bash
# In annotateforge root directory
cat > .env << 'EOF'
# =============================================================================
# Database Configuration (HPC PostgreSQL)
# =============================================================================
DATABASE_URL=postgresql://annotateforge:PASSWORD@hpc-postgres-node:5432/annotateforge
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=40

# =============================================================================
# Redis Configuration (HPC Redis)
# =============================================================================
REDIS_URL=redis://hpc-redis-node:6379/0

# =============================================================================
# Security Configuration
# =============================================================================
SECRET_KEY=$(openssl rand -hex 32)
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# =============================================================================
# Storage Configuration
# =============================================================================
UPLOAD_DIR=$HOME/projects/annotateforge/storage/uploads
MODEL_CACHE_DIR=$HOME/projects/annotateforge/storage/models
MAX_UPLOAD_SIZE=104857600

# =============================================================================
# ML Models Configuration
# =============================================================================
YOLO_MODEL=yolov8n.pt
SAM2_MODEL=sam2.1_b.pt

# =============================================================================
# GPU Configuration
# =============================================================================
CUDA_VISIBLE_DEVICES=0
TORCH_DEVICE=cuda

# =============================================================================
# Performance Configuration
# =============================================================================
WORKER_COUNT=4
INFERENCE_TIMEOUT=30

# =============================================================================
# Environment Configuration
# =============================================================================
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=info

# =============================================================================
# CORS Configuration
# =============================================================================
CORS_ORIGINS=http://hpc-compute-node:3000,http://hpc-gateway:80

# =============================================================================
# Port Configuration
# =============================================================================
BACKEND_PORT=8000
FRONTEND_PORT=3000

# =============================================================================
# Frontend Configuration
# =============================================================================
VITE_API_URL=http://hpc-compute-node:8000/api/v1
VITE_WS_URL=ws://hpc-compute-node:8000/ws
EOF

# Make .env readable only by you
chmod 600 .env
```

### 2. Load Environment Variables

```bash
# Add to your .bashrc or create a source file
cat > env.sh << 'EOF'
#!/bin/bash
export $(grep -v '^#' .env | xargs)
export PYTHONPATH=$HOME/projects/annotateforge/backend:$PYTHONPATH
EOF

source env.sh
```

---

## Database Setup

### Option 1: Use HPC-Provided PostgreSQL

```bash
# Check if PostgreSQL module exists
module avail postgres

# Load module
module load postgres/15

# Connect and create database
psql -h hpc-postgres-node -U $USER -c "CREATE DATABASE annotateforge;"
psql -h hpc-postgres-node -U $USER -d annotateforge -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

### Option 2: Run PostgreSQL on Compute Node

```bash
# Install PostgreSQL via conda
conda install -c conda-forge postgresql=15 -y

# Initialize database
initdb -D $HOME/projects/annotateforge/postgres_data

# Configure PostgreSQL
cat >> $HOME/projects/annotateforge/postgres_data/postgresql.conf << 'EOF'
port = 5432
listen_addresses = 'localhost'
max_connections = 100
shared_buffers = 256MB
EOF

# Start PostgreSQL
pg_ctl -D $HOME/projects/annotateforge/postgres_data -l $HOME/projects/annotateforge/logs/postgres.log start

# Create database
createdb annotateforge
psql -d annotateforge -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

### Option 3: Use SQLite (Development Only)

```bash
# Update DATABASE_URL in .env
DATABASE_URL=sqlite:///$HOME/projects/annotateforge/annotateforge.db
```

---

## Running Services

### 1. Start Redis (if not HPC-provided)

```bash
# Using conda
conda install -c conda-forge redis -y

# Start Redis
redis-server --daemonize yes \
    --port 6379 \
    --dir $HOME/projects/annotateforge/redis_data \
    --logfile $HOME/projects/annotateforge/logs/redis.log
```

### 2. Start Backend

```bash
# Navigate to backend directory
cd $HOME/projects/annotateforge/backend

# Load modules
module load python/3.11 cuda/12.1
conda activate annotateforge
source ../env.sh

# Run database migrations
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 4 \
    --log-config logging.yaml \
    > ../logs/backend.log 2>&1 &

# Save PID
echo $! > ../logs/backend.pid
```

### 3. Build and Serve Frontend

```bash
# Navigate to frontend directory
cd $HOME/projects/annotateforge/frontend

# Build production bundle
npm run build

# Serve using Python HTTP server (development)
cd dist
python -m http.server 3000 > ../../logs/frontend.log 2>&1 &
echo $! > ../../logs/frontend.pid

# OR serve using Nginx (production)
# See Nginx configuration section below
```

### 4. Nginx Configuration (Production)

```bash
# Create Nginx config
cat > nginx.conf << 'EOF'
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    upstream backend {
        server localhost:8000;
    }

    server {
        listen 80;
        server_name _;

        client_max_body_size 100M;

        # Frontend
        location / {
            root /home/$USER/projects/annotateforge/frontend/dist;
            try_files $uri $uri/ /index.html;
        }

        # Backend API
        location /api/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # WebSocket
        location /ws/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "Upgrade";
            proxy_set_header Host $host;
        }
    }
}
EOF

# Start Nginx (if you have permission)
nginx -c $HOME/projects/annotateforge/nginx.conf
```

---

## GPU Configuration

### 1. Verify GPU Access

```bash
# Check H100 availability
nvidia-smi

# Test PyTorch CUDA
python << 'EOF'
import torch
print(f"CUDA available: {torch.cuda.is_available()}")
print(f"CUDA version: {torch.version.cuda}")
print(f"GPU count: {torch.cuda.device_count()}")
if torch.cuda.is_available():
    print(f"GPU name: {torch.cuda.get_device_name(0)}")
    print(f"GPU memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
EOF
```

### 2. Configure CUDA for SAM2

```bash
# Set CUDA environment variables
export CUDA_VISIBLE_DEVICES=0
export TORCH_CUDA_ARCH_LIST="9.0"  # H100 compute capability
export CUDA_HOME=/usr/local/cuda-12.1

# Pre-download models to avoid timeouts
python << 'EOF'
from ultralytics import SAM, YOLO

# Download SAM2 model
sam = SAM('sam2.1_b.pt')
print("SAM2 model downloaded")

# Download YOLO model
yolo = YOLO('yolov8n.pt')
print("YOLO model downloaded")
EOF
```

### 3. Optimize for H100

```bash
# Create optimization config
cat > $HOME/projects/annotateforge/backend/app/core/gpu_config.py << 'EOF'
"""GPU optimization for H100"""
import torch

def configure_h100():
    """Configure PyTorch for H100 optimization"""
    if torch.cuda.is_available():
        # Enable TF32 for performance
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True

        # Enable cuDNN benchmarking
        torch.backends.cudnn.benchmark = True

        # Set memory allocator
        torch.cuda.set_per_process_memory_fraction(0.8, 0)

        print(f"H100 GPU configured: {torch.cuda.get_device_name(0)}")
    else:
        print("Warning: CUDA not available")

configure_h100()
EOF
```

---

## Process Management

### Using Systemd (if available)

```bash
# Create service file (requires root/admin)
cat > /etc/systemd/system/annotateforge-backend.service << 'EOF'
[Unit]
Description=annotateforge FastAPI Backend
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/home/$USER/projects/annotateforge/backend
Environment="PATH=/home/$USER/miniconda3/envs/annotateforge/bin:$PATH"
EnvironmentFile=/home/$USER/projects/annotateforge/.env
ExecStart=/home/$USER/miniconda3/envs/annotateforge/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable annotateforge-backend
sudo systemctl start annotateforge-backend
```

### Using Supervisor (recommended for HPC)

```bash
# Install supervisor
pip install supervisor

# Create supervisor config
mkdir -p $HOME/projects/annotateforge/supervisor
cat > $HOME/projects/annotateforge/supervisor/supervisord.conf << 'EOF'
[supervisord]
logfile=$HOME/projects/annotateforge/logs/supervisord.log
pidfile=$HOME/projects/annotateforge/logs/supervisord.pid
directory=$HOME/projects/annotateforge

[program:annotateforge-backend]
command=/home/$USER/miniconda3/envs/annotateforge/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
directory=/home/$USER/projects/annotateforge/backend
user=$USER
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/home/$USER/projects/annotateforge/logs/backend.log
environment=PATH="/home/$USER/miniconda3/envs/annotateforge/bin:$PATH"

[program:redis]
command=redis-server --port 6379
directory=/home/$USER/projects/annotateforge
user=$USER
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/home/$USER/projects/annotateforge/logs/redis.log
EOF

# Start supervisor
supervisord -c $HOME/projects/annotateforge/supervisor/supervisord.conf

# Control services
supervisorctl -c $HOME/projects/annotateforge/supervisor/supervisord.conf status
supervisorctl -c $HOME/projects/annotateforge/supervisor/supervisord.conf restart annotateforge-backend
```

### Using SLURM Job Scheduler

```bash
# Create SLURM job script
cat > annotateforge-job.slurm << 'EOF'
#!/bin/bash
#SBATCH --job-name=annotateforge
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=16
#SBATCH --gres=gpu:h100:1
#SBATCH --mem=64G
#SBATCH --time=24:00:00
#SBATCH --output=logs/annotateforge-%j.out
#SBATCH --error=logs/annotateforge-%j.err

# Load modules
module load python/3.11 cuda/12.1

# Activate conda environment
source ~/miniconda3/etc/profile.d/conda.sh
conda activate annotateforge

# Load environment variables
source env.sh

# Start Redis
redis-server --daemonize yes --port 6379

# Start backend
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4 &
BACKEND_PID=$!

# Keep job running
wait $BACKEND_PID
EOF

# Submit job
sbatch annotateforge-job.slurm

# Check job status
squeue -u $USER

# Get job info
scontrol show job <job_id>
```

### Manual Process Management Script

```bash
# Create management script
cat > manage.sh << 'EOF'
#!/bin/bash

BACKEND_PID_FILE="logs/backend.pid"
REDIS_PID_FILE="logs/redis.pid"
FRONTEND_PID_FILE="logs/frontend.pid"

start() {
    echo "Starting annotateforge services..."

    # Start Redis
    redis-server --daemonize yes --port 6379 --pidfile $REDIS_PID_FILE

    # Start Backend
    cd backend
    source ~/miniconda3/etc/profile.d/conda.sh
    conda activate annotateforge
    source ../env.sh
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4 \
        > ../logs/backend.log 2>&1 &
    echo $! > ../$BACKEND_PID_FILE
    cd ..

    # Start Frontend
    cd frontend/dist
    python -m http.server 3000 > ../../logs/frontend.log 2>&1 &
    echo $! > ../../$FRONTEND_PID_FILE
    cd ../..

    echo "annotateforge started"
}

stop() {
    echo "Stopping annotateforge services..."

    # Stop Backend
    if [ -f $BACKEND_PID_FILE ]; then
        kill $(cat $BACKEND_PID_FILE)
        rm $BACKEND_PID_FILE
    fi

    # Stop Frontend
    if [ -f $FRONTEND_PID_FILE ]; then
        kill $(cat $FRONTEND_PID_FILE)
        rm $FRONTEND_PID_FILE
    fi

    # Stop Redis
    if [ -f $REDIS_PID_FILE ]; then
        kill $(cat $REDIS_PID_FILE)
        rm $REDIS_PID_FILE
    fi

    echo "annotateforge stopped"
}

status() {
    echo "annotateforge status:"

    if [ -f $BACKEND_PID_FILE ]; then
        echo "  Backend: running (PID $(cat $BACKEND_PID_FILE))"
    else
        echo "  Backend: stopped"
    fi

    if [ -f $FRONTEND_PID_FILE ]; then
        echo "  Frontend: running (PID $(cat $FRONTEND_PID_FILE))"
    else
        echo "  Frontend: stopped"
    fi

    if [ -f $REDIS_PID_FILE ]; then
        echo "  Redis: running (PID $(cat $REDIS_PID_FILE))"
    else
        echo "  Redis: stopped"
    fi
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        stop
        sleep 2
        start
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
esac
EOF

chmod +x manage.sh

# Usage
./manage.sh start
./manage.sh status
./manage.sh stop
```

---

## Troubleshooting

### GPU Issues

```bash
# GPU not detected
nvidia-smi  # Check if GPU is visible
echo $CUDA_VISIBLE_DEVICES  # Check environment variable

# Out of memory
# Reduce batch size or use smaller SAM2 model (sam2.1_t.pt instead of sam2.1_b.pt)

# CUDA version mismatch
python -c "import torch; print(torch.version.cuda)"
nvcc --version  # Should match
```

### Database Issues

```bash
# Can't connect to PostgreSQL
psql -h hpc-postgres-node -U $USER -d annotateforge -c "SELECT 1;"

# Check if PostgreSQL is running
ps aux | grep postgres

# View logs
tail -f logs/postgres.log
```

### Port Already in Use

```bash
# Find process using port
lsof -i :8000

# Kill process
kill -9 <PID>
```

### Permission Issues

```bash
# Fix file permissions
chmod -R u+rw storage/
chmod -R u+rw logs/

# Fix database permissions
psql -d annotateforge -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO annotateforge;"
```

### Module Not Found Errors

```bash
# Verify conda environment
conda activate annotateforge
conda list | grep ultralytics

# Reinstall missing packages
pip install -r requirements.txt

# Check PYTHONPATH
echo $PYTHONPATH
export PYTHONPATH=$HOME/projects/annotateforge/backend:$PYTHONPATH
```

---

## Performance Tuning

### Backend Optimization

```bash
# Increase worker count (CPUs available)
# In backend startup command:
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 16

# Enable HTTP/2 (requires additional setup)
pip install httptools uvloop
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4 --loop uvloop --http httptools
```

### Database Optimization

```sql
-- Create indexes for common queries
CREATE INDEX idx_annotations_image_id ON annotations(image_id);
CREATE INDEX idx_annotations_user_id ON annotations(user_id);
CREATE INDEX idx_images_project_id ON images(project_id);

-- Analyze tables
ANALYZE annotations;
ANALYZE images;
ANALYZE projects;
```

### Redis Optimization

```bash
# Increase memory limit
redis-cli CONFIG SET maxmemory 4gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

---

## Monitoring

### Check Service Health

```bash
# Backend health
curl http://localhost:8000/health

# Check GPU usage
nvidia-smi -l 1

# Check logs
tail -f logs/backend.log
tail -f logs/redis.log
```

### Resource Usage

```bash
# Monitor CPU/Memory
htop

# Monitor disk usage
df -h $HOME/projects/annotateforge/storage

# Monitor network
netstat -tuln | grep -E '8000|6379|5432'
```

---

## Backup and Maintenance

### Backup Database

```bash
# PostgreSQL backup
pg_dump -h hpc-postgres-node -U $USER annotateforge > backup-$(date +%Y%m%d).sql

# Restore
psql -h hpc-postgres-node -U $USER annotateforge < backup-20250110.sql
```

### Backup Storage

```bash
# Backup uploaded images and models
tar -czf storage-backup-$(date +%Y%m%d).tar.gz storage/

# Restore
tar -xzf storage-backup-20250110.tar.gz
```

### Log Rotation

```bash
# Create logrotate config
cat > logrotate.conf << 'EOF'
/home/$USER/projects/annotateforge/logs/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
EOF

# Run manually
logrotate -f logrotate.conf
```

---

## Security Considerations

### Firewall Configuration

```bash
# Allow only specific IPs to access services
# Use HPC firewall rules or iptables

# Example: Allow only internal HPC network
iptables -A INPUT -p tcp --dport 8000 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 8000 -j DROP
```

### Environment Variables

```bash
# Never commit .env file
# Use secure secret generation
openssl rand -hex 32  # Generate strong SECRET_KEY

# Restrict file permissions
chmod 600 .env
```

### Database Security

```sql
-- Create restricted user
CREATE USER annotateforge_app WITH PASSWORD 'strong_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO annotateforge_app;
```

---

## Quick Start Script

```bash
# Create automated setup script
cat > setup.sh << 'EOF'
#!/bin/bash
set -e

echo "=== annotateforge HPC Setup ==="

# Load modules
module load python/3.11 cuda/12.1 nodejs/18

# Create environment
conda create -n annotateforge python=3.11 -y
conda activate annotateforge

# Install backend dependencies
pip install fastapi uvicorn sqlalchemy asyncpg redis ultralytics torch

# Create directory structure
mkdir -p backend frontend storage logs

# Generate .env
cat > .env << 'ENVEOF'
DATABASE_URL=sqlite:///annotateforge.db
REDIS_URL=redis://localhost:6379
SECRET_KEY=$(openssl rand -hex 32)
UPLOAD_DIR=$PWD/storage/uploads
MODEL_CACHE_DIR=$PWD/storage/models
CUDA_VISIBLE_DEVICES=0
ENVEOF

echo "Setup complete!"
echo "Next steps:"
echo "1. Update DATABASE_URL in .env if using PostgreSQL"
echo "2. Run: source env.sh"
echo "3. Start services: ./manage.sh start"
EOF

chmod +x setup.sh
./setup.sh
```

---

## Additional Resources

- **HPC Documentation**: Check your HPC's specific module system and job scheduler
- **SLURM Guide**: https://slurm.schedmd.com/quickstart.html
- **PyTorch CUDA**: https://pytorch.org/get-started/locally/
- **FastAPI Deployment**: https://fastapi.tiangolo.com/deployment/

---

**Need Help?**

Check the main [IMPLEMENTATION.md](./IMPLEMENTATION.md) and [CLAUDE.md](./CLAUDE.md) for detailed technical documentation.
