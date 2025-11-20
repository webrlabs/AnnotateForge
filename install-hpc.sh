#!/bin/bash
# LabelFlow HPC Installation Script
# This script sets up LabelFlow without Docker

set -e  # Exit on error

echo "========================================"
echo "LabelFlow HPC Installation"
echo "========================================"

# Detect project directory
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Configuration
PYTHON_VERSION="3.11"
NODE_VERSION="18"

echo ""
echo "📁 Project directory: $PROJECT_DIR"
echo ""

# Step 1: Check for required commands
echo "🔍 Checking prerequisites..."

check_command() {
    if command -v $1 &> /dev/null; then
        echo "  ✅ $1 found"
        return 0
    else
        echo "  ❌ $1 not found"
        return 1
    fi
}

MISSING_DEPS=0
check_command python3 || MISSING_DEPS=1
check_command node || MISSING_DEPS=1
check_command npm || MISSING_DEPS=1
check_command psql || MISSING_DEPS=1
check_command redis-cli || MISSING_DEPS=1

if [ $MISSING_DEPS -eq 1 ]; then
    echo ""
    echo "⚠️  Missing dependencies detected."
    echo "Please load required modules or install missing packages:"
    echo "  module load python/$PYTHON_VERSION"
    echo "  module load nodejs/$NODE_VERSION"
    echo "  module load postgresql/15"
    echo "  module load redis/7"
    echo ""
    read -p "Have you loaded all required modules? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 2: Python virtual environment
echo ""
echo "🐍 Setting up Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "  ✅ Virtual environment created"
else
    echo "  ℹ️  Virtual environment already exists"
fi

source venv/bin/activate
pip install --upgrade pip > /dev/null 2>&1

# Step 3: Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd backend
pip install -r requirements.txt --quiet
if [ $? -eq 0 ]; then
    echo "  ✅ Backend dependencies installed"
else
    echo "  ⚠️  Some backend dependencies may have failed"
fi
cd ..

# Step 4: Install frontend dependencies
echo ""
echo "📦 Installing frontend dependencies..."
cd frontend
npm install --silent
if [ $? -eq 0 ]; then
    echo "  ✅ Frontend dependencies installed"
else
    echo "  ⚠️  Some frontend dependencies may have failed"
fi
cd ..

# Step 5: Create directories
echo ""
echo "📁 Creating storage directories..."
mkdir -p storage/original storage/thumbnails storage/processed models
echo "  ✅ Directories created"

# Step 6: Configure backend environment
echo ""
echo "⚙️  Configuring backend..."
if [ ! -f "backend/.env" ]; then
    cat > backend/.env << EOF
# Database (update with your database details)
DATABASE_URL=postgresql://labelflow:changeme@localhost:5432/labelflow

# Redis (update with your Redis details)
REDIS_URL=redis://localhost:6379/0

# Security
SECRET_KEY=$(openssl rand -hex 32)
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Storage
UPLOAD_DIR=$PROJECT_DIR/storage
MAX_UPLOAD_SIZE=104857600

# ML Models
YOLO_MODEL=yolov8n.pt
SAM2_MODEL=sam2.1_b.pt
MODEL_CACHE_DIR=$PROJECT_DIR/models

# Performance
WORKER_COUNT=4
INFERENCE_TIMEOUT=30

# Environment
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=info

# CORS
CORS_ORIGINS=http://localhost:3000
EOF
    echo "  ✅ Backend .env created"
    echo "  ⚠️  Please update DATABASE_URL and REDIS_URL in backend/.env"
else
    echo "  ℹ️  Backend .env already exists"
fi

# Step 7: Configure frontend environment
echo ""
echo "⚙️  Configuring frontend..."
if [ ! -f "frontend/.env" ]; then
    cat > frontend/.env << EOF
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000/ws
EOF
    echo "  ✅ Frontend .env created"
else
    echo "  ℹ️  Frontend .env already exists"
fi

# Step 8: Download ML models (optional)
echo ""
read -p "📥 Download ML models now? (170MB, required for AI features) (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "  Downloading models (this may take a while)..."
    source venv/bin/activate
    python3 << 'PYEOF'
from ultralytics import SAM, YOLO
print("  Downloading YOLO...")
YOLO('yolov8n.pt')
print("  Downloading SAM2...")
SAM('sam2.1_b.pt')
print("  ✅ Models downloaded")
PYEOF
fi

# Step 9: Create startup scripts
echo ""
echo "📝 Creating startup scripts..."

# Backend script
cat > start-backend.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/backend"
source ../venv/bin/activate
export PYTHONPATH="$(pwd):$PYTHONPATH"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
EOF
chmod +x start-backend.sh

# Frontend script
cat > start-frontend.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/frontend"
npm run dev -- --host 0.0.0.0 --port 3000
EOF
chmod +x start-frontend.sh

# Combined script
cat > start-labelflow.sh << 'EOF'
#!/bin/bash
SESSION="labelflow"

if command -v tmux &> /dev/null; then
    # Use tmux
    tmux new-session -d -s $SESSION
    tmux split-window -h -t $SESSION
    tmux send-keys -t $SESSION:0.0 './start-backend.sh' C-m
    tmux send-keys -t $SESSION:0.1 './start-frontend.sh' C-m
    echo "Starting LabelFlow in tmux session '$SESSION'"
    echo "Use 'tmux attach -t $SESSION' to view"
    echo "Use Ctrl+B, D to detach"
else
    # Use background processes
    ./start-backend.sh > backend.log 2>&1 &
    echo $! > backend.pid
    ./start-frontend.sh > frontend.log 2>&1 &
    echo $! > frontend.pid
    echo "Services started in background"
    echo "Backend PID: $(cat backend.pid), logs: tail -f backend.log"
    echo "Frontend PID: $(cat frontend.pid), logs: tail -f frontend.log"
fi
EOF
chmod +x start-labelflow.sh

# Stop script
cat > stop-labelflow.sh << 'EOF'
#!/bin/bash
[ -f backend.pid ] && kill $(cat backend.pid) 2>/dev/null && rm backend.pid
[ -f frontend.pid ] && kill $(cat frontend.pid) 2>/dev/null && rm frontend.pid
tmux kill-session -t labelflow 2>/dev/null
echo "LabelFlow stopped"
EOF
chmod +x stop-labelflow.sh

echo "  ✅ Startup scripts created"

# Step 10: Final instructions
echo ""
echo "========================================"
echo "✅ Installation Complete!"
echo "========================================"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Configure your database and Redis:"
echo "   Edit: backend/.env"
echo "   Update: DATABASE_URL and REDIS_URL"
echo ""
echo "2. Run database migrations:"
echo "   cd backend"
echo "   source ../venv/bin/activate"
echo "   alembic upgrade head"
echo ""
echo "3. Create admin user:"
echo "   python3 create-admin.py"
echo ""
echo "4. Start LabelFlow:"
echo "   ./start-labelflow.sh"
echo ""
echo "5. Access the application:"
echo "   Frontend: http://$(hostname):3000"
echo "   Backend:  http://$(hostname):8000"
echo "   API Docs: http://$(hostname):8000/docs"
echo ""
echo "📚 For detailed instructions, see: HPC_SETUP.md"
echo ""
