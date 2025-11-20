# LabelFlow on HPC - Quick Start (No Docker)

This guide will get LabelFlow running on your HPC system **without Docker** in just a few steps.

## Prerequisites

Your HPC system needs:
- Python 3.11+
- Node.js 18+
- PostgreSQL (client tools or running instance)
- Redis (client tools or running instance)
- 10GB free disk space
- 8GB+ RAM

## Step 1: Check Your Environment

```bash
# Run the environment checker
./check-hpc-env.sh
```

This will verify all requirements are met. If anything is missing, load the required modules:

```bash
# Example for most HPC systems
module load python/3.11
module load nodejs/18
module load postgresql/15
module load redis/7
module load gcc/11  # For compiling packages
```

## Step 2: Set Up Database and Redis

### Option A: Use HPC-Provided Services

Contact your HPC administrator to get:
- PostgreSQL connection string
- Redis connection string

Then skip to Step 3.

### Option B: Run Your Own Instances

**PostgreSQL:**
```bash
# Initialize database
mkdir -p $HOME/labelflow-db
initdb -D $HOME/labelflow-db

# Start PostgreSQL
pg_ctl -D $HOME/labelflow-db -l $HOME/labelflow-db/postgres.log start

# Create database
createdb labelflow
```

**Redis:**
```bash
# Create config
mkdir -p $HOME/labelflow-redis
cat > $HOME/labelflow-redis/redis.conf << EOF
port 6379
bind 127.0.0.1
dir $HOME/labelflow-redis
appendonly yes
EOF

# Start Redis
redis-server $HOME/labelflow-redis/redis.conf &
```

## Step 3: Install LabelFlow

```bash
# Run the automated installer
./install-hpc.sh
```

This will:
- ✅ Create Python virtual environment
- ✅ Install all backend dependencies
- ✅ Install all frontend dependencies
- ✅ Create configuration files
- ✅ Create startup scripts
- ✅ Optionally download ML models

## Step 4: Configure Connection Strings

Edit `backend/.env` and update:

```bash
# Your PostgreSQL connection
DATABASE_URL=postgresql://username:password@hostname:5432/labelflow

# Your Redis connection
REDIS_URL=redis://hostname:6379/0

# If using local instances from Step 2:
# DATABASE_URL=postgresql://$(whoami):@localhost/labelflow
# REDIS_URL=redis://localhost:6379/0
```

## Step 5: Initialize Database

```bash
cd backend
source ../venv/bin/activate
alembic upgrade head
cd ..
```

## Step 6: Create Admin User

```bash
python3 create-admin.py

# Or with custom credentials:
python3 create-admin.py --username myuser --password mypass --email user@example.com
```

## Step 7: Start LabelFlow

```bash
# Start everything (uses tmux if available)
./start-labelflow.sh
```

**With tmux** (recommended):
- You'll see a split screen with backend and frontend logs
- Press `Ctrl+B`, then `D` to detach and leave running
- Reattach with: `tmux attach -t labelflow`

**Without tmux**:
- Services run in background
- View logs: `tail -f backend.log` or `tail -f frontend.log`

## Step 8: Access the Application

Find your node's hostname:
```bash
hostname -f
```

Then access:
- **Frontend**: http://YOUR-NODE:3000
- **Backend**: http://YOUR-NODE:8000
- **API Docs**: http://YOUR-NODE:8000/docs

### If node is not directly accessible (SSH Tunnel):

On your local machine:
```bash
ssh -L 3000:localhost:3000 -L 8000:localhost:8000 user@hpc-login.edu
```

Then access: http://localhost:3000

## Managing the Application

### Stop LabelFlow
```bash
./stop-labelflow.sh
```

### View Logs
```bash
# If using tmux:
tmux attach -t labelflow

# If using background processes:
tail -f backend.log
tail -f frontend.log
```

### Restart Services
```bash
./stop-labelflow.sh
./start-labelflow.sh
```

## Running as a SLURM Job

For longer-running sessions, submit as a job:

```bash
# Edit labelflow-job.slurm to match your HPC configuration
# Update paths, module names, and resource requirements

# Submit job
sbatch labelflow-job.slurm

# Check status
squeue -u $USER

# View output
tail -f labelflow-*.out

# Get node name from output, then access:
# http://NODENAME:3000
```

## Performance Tips

### Use Scratch Space
```bash
# Edit backend/.env
UPLOAD_DIR=/scratch/$USER/labelflow/storage
MODEL_CACHE_DIR=/scratch/$USER/labelflow/models
```

### Increase Workers
```bash
# Edit backend/.env based on available CPUs
WORKER_COUNT=16  # Match your allocated cores
```

### Enable GPU (if available)
```bash
module load cuda/11.8
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
```

## Troubleshooting

### "Module not found" errors
```bash
# Make sure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
cd backend && pip install -r requirements.txt
cd ../frontend && npm install
```

### Port already in use
```bash
# Check what's using ports
lsof -i :8000
lsof -i :3000

# Edit backend/.env to use different ports
# Then update frontend/.env with new backend URL
```

### Can't connect to database
```bash
# Test connection
psql -h hostname -p 5432 -U username -d labelflow

# Check if local PostgreSQL is running
pg_ctl -D $HOME/labelflow-db status
```

### Frontend won't start
```bash
# Clear cache and rebuild
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Getting Help

1. **Check logs**: Most errors are visible in the logs
2. **Verify environment**: Run `./check-hpc-env.sh` again
3. **Review full guide**: See `HPC_SETUP.md` for detailed information
4. **Test API**: `curl http://localhost:8000/health`

## File Structure

```
label-flow/
├── check-hpc-env.sh      # Environment checker
├── install-hpc.sh        # Automated installer
├── create-admin.py       # Create admin user
├── start-labelflow.sh    # Start services
├── stop-labelflow.sh     # Stop services
├── start-backend.sh      # Start backend only
├── start-frontend.sh     # Start frontend only
├── HPC_SETUP.md          # Detailed setup guide
└── HPC-QUICKSTART.md     # This file
```

## Next Steps

After successfully starting LabelFlow:

1. **Login**: Use the credentials you created (default: admin/admin)
2. **Create Project**: Use the API to create your first project
3. **Upload Images**: Add images to your project
4. **Annotate**: Start manual annotation or use AI tools
5. **Export**: Export annotations in YOLO/COCO format

---

🎉 **Congratulations!** LabelFlow is now running on your HPC system without Docker.
