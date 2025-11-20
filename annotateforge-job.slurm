#!/bin/bash
#SBATCH --job-name=annotateforge
#SBATCH --partition=standard
#SBATCH --time=24:00:00
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=8
#SBATCH --mem=16GB
#SBATCH --output=annotateforge-%j.out
#SBATCH --error=annotateforge-%j.err

# ========================================
# AnnotateForge SLURM Job Script
# For Rocky Linux 9 and other HPC systems
# ========================================

echo "========================================"
echo "AnnotateForge Starting on HPC"
echo "========================================"
echo "Job ID: $SLURM_JOB_ID"
echo "Node: $(hostname -f)"
echo "Start Time: $(date)"
echo "========================================"
echo ""

# Load required modules (adjust module names for your HPC)
echo "📦 Loading modules..."
module load python/3.11 2>/dev/null || echo "  ⚠️  Python module not loaded (will use system)"
module load nodejs/18 2>/dev/null || echo "  ⚠️  Node.js module not loaded (will use system)"
module load postgresql/15 2>/dev/null || echo "  ⚠️  PostgreSQL module not loaded (will use system)"
module load redis/7 2>/dev/null || echo "  ⚠️  Redis module not loaded (will use system)"
echo ""

# Verify required commands are available
echo "🔍 Verifying prerequisites..."
ERRORS=0

# Check Python 3.11+
PYTHON_CMD=""
for cmd in python3.11 python3.12 python3.10 python3; do
    if command -v $cmd &> /dev/null; then
        VERSION=$($cmd -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
        MAJOR=$(echo $VERSION | cut -d. -f1)
        MINOR=$(echo $VERSION | cut -d. -f2)
        if [ "$MAJOR" -ge 3 ] && [ "$MINOR" -ge 11 ]; then
            PYTHON_CMD=$cmd
            echo "  ✅ Found Python $VERSION ($cmd)"
            break
        fi
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo "  ❌ Python 3.11+ not found!"
    ERRORS=1
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "  ✅ Found Node.js $NODE_VERSION"
else
    echo "  ❌ Node.js not found!"
    ERRORS=1
fi

# Exit if prerequisites not met
if [ $ERRORS -eq 1 ]; then
    echo ""
    echo "❌ Prerequisites not met. Please load required modules or install missing software."
    echo "   Try: module avail python nodejs postgresql redis"
    exit 1
fi
echo ""

# Start Redis if needed
echo "🔴 Starting Redis..."
if command -v redis-server &> /dev/null; then
    if [ -f "$HOME/annotateforge-redis/redis.conf" ]; then
        redis-server $HOME/annotateforge-redis/redis.conf &
        REDIS_PID=$!
        sleep 2
        if kill -0 $REDIS_PID 2>/dev/null; then
            echo "  ✅ Redis started (PID: $REDIS_PID)"
        else
            echo "  ⚠️  Redis failed to start (check logs)"
        fi
    else
        echo "  ⚠️  Redis config not found at $HOME/annotateforge-redis/redis.conf"
        echo "     Using external Redis or skipping..."
    fi
else
    echo "  ⚠️  redis-server not found (assuming external Redis)"
fi
echo ""

# Start PostgreSQL if needed
echo "🐘 Starting PostgreSQL..."
if command -v pg_ctl &> /dev/null; then
    if [ -d "$HOME/annotateforge-db" ]; then
        pg_ctl -D $HOME/annotateforge-db start -l $HOME/annotateforge-db/postgres.log -o "-p 5432"
        sleep 5
        if pg_isready -h localhost -p 5432 &>/dev/null; then
            echo "  ✅ PostgreSQL started"
        else
            echo "  ⚠️  PostgreSQL failed to start (check logs)"
        fi
    else
        echo "  ⚠️  PostgreSQL data directory not found at $HOME/annotateforge-db"
        echo "     Using external PostgreSQL or skipping..."
    fi
else
    echo "  ⚠️  pg_ctl not found (assuming external PostgreSQL)"
fi
echo ""

# Change to project directory
cd $HOME/label-flow || cd $SLURM_SUBMIT_DIR || {
    echo "❌ Could not find label-flow directory"
    exit 1
}

echo "📁 Project directory: $(pwd)"
echo ""

# Activate Python virtual environment
echo "🐍 Activating Python virtual environment..."
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    echo "  ✅ Virtual environment activated"
else
    echo "  ❌ Virtual environment not found!"
    echo "     Run: $PYTHON_CMD -m venv venv && source venv/bin/activate && pip install -r backend/requirements.txt"
    exit 1
fi
echo ""

# Get connection info
NODE=$(hostname -f)
NODE_SHORT=$(hostname -s)

# Start backend
echo "🚀 Starting Backend..."
cd backend
export PYTHONPATH="$(pwd):$PYTHONPATH"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4 > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "  ⏳ Waiting for backend to start..."
sleep 5

# Check if backend is running
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "  ✅ Backend started (PID: $BACKEND_PID)"

    # Test backend health
    sleep 2
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "  ✅ Backend health check passed"
    else
        echo "  ⚠️  Backend health check failed (may still be starting)"
    fi
else
    echo "  ❌ Backend failed to start!"
    echo "  📄 Last 20 lines of backend log:"
    tail -20 backend.log
    exit 1
fi
echo ""

# Start frontend
echo "🎨 Starting Frontend..."
cd frontend
npm run dev -- --host 0.0.0.0 --port 3000 > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
echo "  ⏳ Waiting for frontend to start..."
sleep 5

# Check if frontend is running
if kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "  ✅ Frontend started (PID: $FRONTEND_PID)"
else
    echo "  ❌ Frontend failed to start!"
    echo "  📄 Last 20 lines of frontend log:"
    tail -20 frontend.log
    exit 1
fi
echo ""

# Display connection information
echo "========================================"
echo "✅ AnnotateForge is Running!"
echo "========================================"
echo ""
echo "📍 Connection Information:"
echo "  Node: $NODE"
echo "  Frontend: http://$NODE:3000"
echo "  Backend:  http://$NODE:8000"
echo "  API Docs: http://$NODE:8000/docs"
echo ""
echo "🔑 Default Login:"
echo "  Username: admin"
echo "  Password: admin"
echo ""
echo "🔌 SSH Tunnel (if node not directly accessible):"
echo "  ssh -L 3000:localhost:3000 -L 8000:localhost:8000 $USER@$NODE_SHORT"
echo "  Then access: http://localhost:3000"
echo ""
echo "📊 Process Information:"
echo "  Backend PID: $BACKEND_PID"
echo "  Frontend PID: $FRONTEND_PID"
if [ ! -z "$REDIS_PID" ]; then
    echo "  Redis PID: $REDIS_PID"
fi
echo ""
echo "📝 View Logs:"
echo "  Backend:  tail -f $(pwd)/backend.log"
echo "  Frontend: tail -f $(pwd)/frontend.log"
echo ""
echo "⏰ Job will run for $SLURM_TIMELIMIT (job will auto-terminate)"
echo "========================================"
echo ""

# Create a status file
cat > job_info.txt << EOF
AnnotateForge Job Information
============================
Job ID: $SLURM_JOB_ID
Node: $NODE
Started: $(date)

Access URLs:
  Frontend: http://$NODE:3000
  Backend: http://$NODE:8000

SSH Tunnel Command:
  ssh -L 3000:localhost:3000 -L 8000:localhost:8000 $USER@$NODE_SHORT

Process IDs:
  Backend: $BACKEND_PID
  Frontend: $FRONTEND_PID
EOF

echo "ℹ️  Job info saved to: job_info.txt"
echo ""

# Monitor processes and keep job running
echo "👀 Monitoring processes (Ctrl+C or scancel $SLURM_JOB_ID to stop)..."
echo ""

# Function to check process
check_process() {
    local pid=$1
    local name=$2
    if ! kill -0 $pid 2>/dev/null; then
        echo "$(date): ❌ $name (PID $pid) has stopped!"
        return 1
    fi
    return 0
}

# Main monitoring loop
LAST_CHECK=$(date +%s)
while true; do
    # Check processes every minute
    sleep 60

    NOW=$(date +%s)
    ELAPSED=$((NOW - LAST_CHECK))

    if ! check_process $BACKEND_PID "Backend"; then
        echo "Backend crashed! Check backend.log for errors."
        break
    fi

    if ! check_process $FRONTEND_PID "Frontend"; then
        echo "Frontend crashed! Check frontend.log for errors."
        break
    fi

    # Print status every 10 minutes
    if [ $ELAPSED -ge 600 ]; then
        echo "$(date): ✅ Services running normally (Backend: $BACKEND_PID, Frontend: $FRONTEND_PID)"
        LAST_CHECK=$NOW
    fi
done

# Cleanup when job ends
echo ""
echo "========================================"
echo "Cleaning up..."
echo "========================================"

# Stop services
echo "Stopping backend..."
kill $BACKEND_PID 2>/dev/null || true
wait $BACKEND_PID 2>/dev/null || true

echo "Stopping frontend..."
kill $FRONTEND_PID 2>/dev/null || true
wait $FRONTEND_PID 2>/dev/null || true

# Stop Redis if we started it
if [ ! -z "$REDIS_PID" ]; then
    echo "Stopping Redis..."
    kill $REDIS_PID 2>/dev/null || true
fi

# Stop PostgreSQL if we started it
if command -v pg_ctl &> /dev/null && [ -d "$HOME/annotateforge-db" ]; then
    echo "Stopping PostgreSQL..."
    pg_ctl -D $HOME/annotateforge-db stop 2>/dev/null || true
fi

echo ""
echo "✅ Cleanup complete"
echo "End Time: $(date)"
echo "========================================"
