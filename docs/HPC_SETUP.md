# annotateforge - HPC Setup (No Docker)

This guide explains how to run annotateforge on HPC systems without Docker containers.

## Prerequisites

### Required Software
- Python 3.11+ (with pip)
- Node.js 18+ (with npm)
- PostgreSQL 15+ (client tools)
- Redis 7+ (or access to Redis server)
- Git

### HPC Module System
Most HPC systems use environment modules. Load required modules:

```bash
# Example for common HPC systems
module load python/3.11
module load nodejs/18
module load postgresql/15
module load redis/7
module load gcc/11  # For compiling Python packages
```

Check available modules:
```bash
module avail python
module avail nodejs
```

## Step 1: Set Up PostgreSQL Database

### Option A: Use HPC-Provided PostgreSQL

If your HPC provides PostgreSQL as a service:

```bash
# Contact your HPC admin for:
# - Database host and port
# - Database name
# - Username and password
# - Connection string

# Example connection string:
# postgresql://username:password@db.hpc.edu:5432/annotateforge
```

### Option B: Use Your Own PostgreSQL

If you need to run your own PostgreSQL:

```bash
# 1. Create a data directory in your home/scratch space
mkdir -p $HOME/annotateforge/postgres-data

# 2. Initialize the database
initdb -D $HOME/annotateforge/postgres-data

# 3. Configure PostgreSQL
# Edit $HOME/annotateforge/postgres-data/postgresql.conf
# Set:
#   port = 5432  (or another available port)
#   unix_socket_directories = '$HOME/annotateforge/run'
#   listen_addresses = 'localhost'

# 4. Create socket directory
mkdir -p $HOME/annotateforge/run

# 5. Start PostgreSQL
pg_ctl -D $HOME/annotateforge/postgres-data -l $HOME/annotateforge/postgres.log start

# 6. Create database
createdb -p 5432 annotateforge

# 7. Create user
psql -p 5432 -d annotateforge -c "CREATE USER annotateforge WITH PASSWORD 'your_password';"
psql -p 5432 -d annotateforge -c "GRANT ALL PRIVILEGES ON DATABASE annotateforge TO annotateforge;"
```

## Step 2: Set Up Redis

### Option A: Use HPC-Provided Redis

```bash
# Contact your HPC admin for Redis connection details
# Example: redis://redis.hpc.edu:6379/0
```

### Option B: Run Redis Locally

```bash
# 1. Create Redis directory
mkdir -p $HOME/annotateforge/redis-data

# 2. Create Redis config
cat > $HOME/annotateforge/redis.conf << 'EOF'
port 6379
bind 127.0.0.1
dir /path/to/your/home/annotateforge/redis-data
appendonly yes
EOF

# Replace /path/to/your/home with your actual home directory
sed -i "s|/path/to/your/home|$HOME|g" $HOME/annotateforge/redis.conf

# 3. Start Redis
redis-server $HOME/annotateforge/redis.conf &

# Save the process ID
echo $! > $HOME/annotateforge/redis.pid
```

## Step 3: Set Up Backend (FastAPI)

```bash
# Navigate to the project directory
cd label-flow

# Create Python virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install backend dependencies
cd backend
pip install -r requirements.txt

# Note: If installation fails due to missing system libraries, you may need:
# - For OpenCV: module load opencv or install opencv-python-headless
# - For PostgreSQL: module load postgresql-devel or libpq-dev
# - For compilation: module load gcc or build-essential
```

### Configure Backend Environment

```bash
# Create backend environment file
cat > backend/.env << 'EOF'
# Database
DATABASE_URL=postgresql://annotateforge:your_password@localhost:5432/annotateforge

# Redis
REDIS_URL=redis://localhost:6379/0

# Security
SECRET_KEY=your_jwt_secret_key_change_this_to_something_secure_min_32_chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Storage
UPLOAD_DIR=/absolute/path/to/label-flow/storage
MAX_UPLOAD_SIZE=104857600

# ML Models
YOLO_MODEL=yolov8n.pt
SAM2_MODEL=sam2.1_b.pt
MODEL_CACHE_DIR=/absolute/path/to/label-flow/models

# Performance
WORKER_COUNT=4
INFERENCE_TIMEOUT=30

# Environment
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=info

# CORS (update with your actual frontend URL)
CORS_ORIGINS=http://localhost:3000,http://your-hpc-node:3000
EOF

# Update paths in .env
sed -i "s|/absolute/path/to/label-flow|$(pwd)|g" backend/.env
```

### Run Database Migrations

```bash
# From backend directory with venv activated
cd backend

# Run migrations
alembic upgrade head

# If you get errors, initialize alembic:
# alembic revision --autogenerate -m "Initial migration"
# alembic upgrade head
```

### Create Admin User

```bash
# From backend directory with venv activated
python3 << 'EOF'
from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

db = SessionLocal()
try:
    # Check if admin exists
    existing = db.query(User).filter(User.username == 'admin').first()
    if existing:
        print('Admin user already exists')
    else:
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
    db.rollback()
finally:
    db.close()
EOF
```

### Download ML Models (Optional - for AI features)

```bash
# This may take a while (150MB+ download)
python3 << 'EOF'
from ultralytics import SAM, YOLO
import os

print("Downloading YOLO model...")
YOLO('yolov8n.pt')
print("✅ YOLO model downloaded")

print("Downloading SAM2 model...")
SAM('sam2.1_b.pt')
print("✅ SAM2 model downloaded")
EOF
```

## Step 4: Set Up Frontend (React)

```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install

# Create frontend environment file
cat > .env << 'EOF'
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000/ws
EOF

# If running on a specific HPC node, update the URLs:
# VITE_API_URL=http://your-hpc-node:8000/api/v1
# VITE_WS_URL=ws://your-hpc-node:8000/ws
```

## Step 5: Create Startup Scripts

### Backend Startup Script

```bash
cat > start-backend.sh << 'EOF'
#!/bin/bash

# Load required modules (adjust for your HPC)
module load python/3.11
module load postgresql/15
module load gcc/11

# Navigate to backend directory
cd "$(dirname "$0")/backend"

# Activate virtual environment
source ../venv/bin/activate

# Set environment variables
export PYTHONPATH="$(pwd):$PYTHONPATH"

# Start the backend
echo "Starting annotateforge Backend..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

# For development with auto-reload:
# uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
EOF

chmod +x start-backend.sh
```

### Frontend Startup Script

```bash
cat > start-frontend.sh << 'EOF'
#!/bin/bash

# Load required modules
module load nodejs/18

# Navigate to frontend directory
cd "$(dirname "$0")/frontend"

# Start the frontend
echo "Starting annotateforge Frontend..."
npm run dev -- --host 0.0.0.0 --port 3000
EOF

chmod +x start-frontend.sh
```

### Combined Startup Script (with tmux)

```bash
cat > start-annotateforge.sh << 'EOF'
#!/bin/bash

# Create a tmux session with multiple panes
SESSION="annotateforge"

# Check if tmux is available
if ! command -v tmux &> /dev/null; then
    echo "tmux not found. Starting services in background..."

    # Start services in background
    ./start-backend.sh > backend.log 2>&1 &
    echo $! > backend.pid
    echo "Backend started (PID: $(cat backend.pid))"

    ./start-frontend.sh > frontend.log 2>&1 &
    echo $! > frontend.pid
    echo "Frontend started (PID: $(cat frontend.pid))"

    echo ""
    echo "Services started!"
    echo "Backend logs: tail -f backend.log"
    echo "Frontend logs: tail -f frontend.log"
    echo ""
    echo "To stop services:"
    echo "  kill $(cat backend.pid) $(cat frontend.pid)"
    exit 0
fi

# Start a new tmux session
tmux new-session -d -s $SESSION

# Split the window
tmux split-window -h -t $SESSION

# Run backend in left pane
tmux send-keys -t $SESSION:0.0 './start-backend.sh' C-m

# Run frontend in right pane
tmux send-keys -t $SESSION:0.1 './start-frontend.sh' C-m

# Attach to the session
echo "Starting annotateforge in tmux session..."
echo "Use 'Ctrl+B, D' to detach"
echo "Use 'tmux attach -t annotateforge' to reattach"
tmux attach -t $SESSION
EOF

chmod +x start-annotateforge.sh
```

### Stop Script

```bash
cat > stop-annotateforge.sh << 'EOF'
#!/bin/bash

echo "Stopping annotateforge..."

# Kill processes if PIDs exist
if [ -f backend.pid ]; then
    kill $(cat backend.pid) 2>/dev/null
    rm backend.pid
    echo "Backend stopped"
fi

if [ -f frontend.pid ]; then
    kill $(cat frontend.pid) 2>/dev/null
    rm frontend.pid
    echo "Frontend stopped"
fi

# Kill tmux session if it exists
tmux kill-session -t annotateforge 2>/dev/null && echo "Tmux session killed"

# Stop Redis if we started it
if [ -f $HOME/annotateforge/redis.pid ]; then
    kill $(cat $HOME/annotateforge/redis.pid) 2>/dev/null
    echo "Redis stopped"
fi

# Stop PostgreSQL if we started it
if [ -f $HOME/annotateforge/postgres-data/postmaster.pid ]; then
    pg_ctl -D $HOME/annotateforge/postgres-data stop
    echo "PostgreSQL stopped"
fi

echo "All services stopped"
EOF

chmod +x stop-annotateforge.sh
```

## Step 6: Start the Application

### Simple Start (Background Processes)

```bash
# Start everything
./start-annotateforge.sh

# Check if services are running
curl http://localhost:8000/health
# Should return: {"status":"healthy"}

# View logs
tail -f backend.log
tail -f frontend.log
```

### Start with tmux (Recommended)

```bash
# If tmux is available, this gives you interactive panes
./start-annotateforge.sh

# You'll see split screen with backend and frontend logs
# Press Ctrl+B, D to detach and leave it running
# Reattach later with: tmux attach -t annotateforge
```

### Manual Start (For Debugging)

```bash
# Terminal 1 - Backend
cd backend
source ../venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 - Frontend
cd frontend
npm run dev -- --host 0.0.0.0
```

## Step 7: Access the Application

### Find Your Node's Hostname

```bash
# Get your current node hostname
hostname -f

# Or get IP address
hostname -i
```

### Access URLs

- **Frontend**: `http://YOUR-NODE:3000`
- **Backend API**: `http://YOUR-NODE:8000`
- **API Docs**: `http://YOUR-NODE:8000/docs`

### SSH Tunneling (if node is not directly accessible)

If your HPC compute nodes aren't directly accessible:

```bash
# On your local machine, create SSH tunnel
ssh -L 3000:localhost:3000 -L 8000:localhost:8000 username@hpc-login-node.edu

# Then access:
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
```

## Step 8: Running as a Job (SLURM)

If you want to run annotateforge as a batch job:

```bash
cat > annotateforge-job.slurm << 'EOF'
#!/bin/bash
#SBATCH --job-name=annotateforge
#SBATCH --time=24:00:00
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=8
#SBATCH --mem=16GB
#SBATCH --output=annotateforge-%j.out
#SBATCH --error=annotateforge-%j.err

# Load modules
module load python/3.11
module load nodejs/18
module load postgresql/15
module load redis/7

# Start Redis (if needed)
redis-server $HOME/annotateforge/redis.conf &
REDIS_PID=$!
sleep 2

# Start PostgreSQL (if needed)
pg_ctl -D $HOME/annotateforge/postgres-data start
sleep 5

# Activate Python environment
source $HOME/label-flow/venv/bin/activate

# Start backend in background
cd $HOME/label-flow/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4 &
BACKEND_PID=$!
sleep 5

# Start frontend
cd $HOME/label-flow/frontend
npm run dev -- --host 0.0.0.0 --port 3000 &
FRONTEND_PID=$!

# Print connection info
echo "========================================"
echo "annotateforge is running on: $(hostname -f)"
echo "Frontend: http://$(hostname -f):3000"
echo "Backend: http://$(hostname -f):8000"
echo "========================================"

# Keep job running
wait $BACKEND_PID $FRONTEND_PID

# Cleanup
kill $REDIS_PID 2>/dev/null
pg_ctl -D $HOME/annotateforge/postgres-data stop
EOF

# Submit the job
sbatch annotateforge-job.slurm

# Check job status
squeue -u $USER

# View output
tail -f annotateforge-*.out
```

## Troubleshooting

### Python Package Installation Issues

```bash
# If you get compiler errors:
module load gcc/11

# If OpenCV fails:
pip install opencv-python-headless  # Instead of opencv-python

# If PyTorch fails:
pip install torch --index-url https://download.pytorch.org/whl/cpu

# Install packages one by one if needed:
pip install fastapi uvicorn sqlalchemy psycopg2-binary redis pydantic
```

### Port Already in Use

```bash
# Check what's using the port
lsof -i :8000
netstat -tulpn | grep 8000

# Use different ports
# Edit backend/.env: Change any port references
# Edit frontend/.env: Update VITE_API_URL
# Update start scripts with new ports
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql -h localhost -p 5432 -U annotateforge -d annotateforge

# Check if PostgreSQL is running
pg_ctl -D $HOME/annotateforge/postgres-data status

# View PostgreSQL logs
tail -f $HOME/annotateforge/postgres.log
```

### Module Not Found Errors

```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall package
pip install --force-reinstall package-name

# Check Python path
python -c "import sys; print('\n'.join(sys.path))"
```

## Performance Optimization for HPC

### Use HPC Scratch Space

```bash
# Use high-performance scratch for storage
export UPLOAD_DIR=/scratch/$USER/annotateforge/storage
export MODEL_CACHE_DIR=/scratch/$USER/annotateforge/models
mkdir -p $UPLOAD_DIR $MODEL_CACHE_DIR
```

### Increase Workers

```bash
# In backend/.env, increase workers based on available CPU cores
WORKER_COUNT=16  # Match your allocated CPUs
```

### GPU Support (if available)

```bash
# Load CUDA modules
module load cuda/11.8

# Install PyTorch with GPU support
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118

# Verify GPU is available
python -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
```

## Maintenance

### Updating the Application

```bash
# Stop services
./stop-annotateforge.sh

# Pull latest changes (if using git)
git pull

# Update backend dependencies
source venv/bin/activate
cd backend
pip install -r requirements.txt --upgrade

# Update frontend dependencies
cd ../frontend
npm install

# Run migrations
cd ../backend
alembic upgrade head

# Restart
./start-annotateforge.sh
```

### Backup Database

```bash
# Backup PostgreSQL database
pg_dump -h localhost -p 5432 -U annotateforge -d annotateforge > annotateforge-backup-$(date +%Y%m%d).sql

# Restore from backup
psql -h localhost -p 5432 -U annotateforge -d annotateforge < annotateforge-backup-20250101.sql
```

---

This setup allows you to run annotateforge entirely without Docker on your HPC system!
