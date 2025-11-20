# HPC Rocky 9 Deployment Review

**Date**: November 2025
**Reviewer**: Claude (AI Assistant)
**Target Platform**: Rocky Linux 9 HPC Systems (No Docker)

---

## Executive Summary

The current HPC deployment documentation and scripts are **generally well-structured** and should work on Rocky 9 HPC systems with **minor modifications**. The documentation is comprehensive and the automation scripts are production-ready.

### Overall Assessment: ✅ **GOOD** (with recommended improvements)

---

## Documentation Review

### ✅ Strengths

1. **Comprehensive Coverage**: Both detailed (`HPC_SETUP.md`) and quick-start (`HPC-QUICKSTART.md`) guides provided
2. **Well-Organized**: Clear step-by-step instructions with proper progression
3. **Good Troubleshooting**: Common issues addressed with solutions
4. **Multiple Options**: Provides both HPC-provided services and self-hosted alternatives
5. **Automation Scripts**: Includes automated setup and management scripts

### ⚠️ Areas for Improvement

#### 1. Rocky 9 Specific Considerations

**Issue**: Documentation doesn't explicitly mention Rocky Linux 9 compatibility

**Recommendation**: Add a Rocky 9 specific section:
```markdown
### Rocky Linux 9 Notes

Rocky 9 ships with:
- Python 3.9 (need to install Python 3.11+ from EPEL or build from source)
- Node.js can be installed via NodeSource repository
- PostgreSQL 15 available from official PostgreSQL repository
- Redis 7 available from EPEL

#### Installing Prerequisites on Rocky 9:

```bash
# Enable EPEL
sudo dnf install -y epel-release

# Install Python 3.11
sudo dnf install -y python3.11 python3.11-devel

# Install Node.js 18 LTS
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# Install PostgreSQL 15
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm
sudo dnf install -y postgresql15-server postgresql15-devel

# Install Redis
sudo dnf install -y redis

# Install development tools
sudo dnf groupinstall -y "Development Tools"
sudo dnf install -y gcc-c++ libpq-devel
```
```

#### 2. SELinux Considerations

**Issue**: Rocky 9 has SELinux enabled by default, which may block network bindings

**Recommendation**: Add SELinux section:
```markdown
### SELinux Configuration

If SELinux is enabled (default on Rocky 9):

```bash
# Check SELinux status
getenforce

# If Enforcing, allow HTTP ports
sudo semanage port -a -t http_port_t -p tcp 8000
sudo semanage port -a -t http_port_t -p tcp 3000

# Or temporarily set to permissive for testing
sudo setenforce 0

# To permanently disable (not recommended for production):
sudo vi /etc/selinux/config
# Set SELINUX=disabled
```
```

#### 3. Firewall Configuration

**Issue**: Rocky 9's firewalld may block incoming connections

**Recommendation**: Add firewall section:
```markdown
### Firewall Configuration

```bash
# Open required ports
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=5432/tcp  # If running PostgreSQL locally
sudo firewall-cmd --permanent --add-port=6379/tcp  # If running Redis locally
sudo firewall-cmd --reload

# Verify
sudo firewall-cmd --list-ports
```
```

#### 4. SystemD Service Files

**Issue**: Documentation shows background/tmux approach but not systemd services (better for production)

**Recommendation**: Add optional systemd service files:
```markdown
### Optional: SystemD Service Setup

For production deployments, use systemd services instead of tmux:

#### Backend Service
```bash
sudo cat > /etc/systemd/system/annotateforge-backend.service << 'EOF'
[Unit]
Description=AnnotateForge Backend API
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/path/to/label-flow/backend
Environment="PATH=/path/to/label-flow/venv/bin"
Environment="PYTHONPATH=/path/to/label-flow/backend"
ExecStart=/path/to/label-flow/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=on-failure
RestartSec=10s

[Install]
WantedBy=multi-user.target
EOF
```

#### Frontend Service
```bash
sudo cat > /etc/systemd/system/annotateforge-frontend.service << 'EOF'
[Unit]
Description=AnnotateForge Frontend
After=network.target annotateforge-backend.service

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/path/to/label-flow/frontend
ExecStart=/usr/bin/npm run dev -- --host 0.0.0.0 --port 3000
Restart=on-failure
RestartSec=10s

[Install]
WantedBy=multi-user.target
EOF
```

#### Enable and start services
```bash
sudo systemctl daemon-reload
sudo systemctl enable annotateforge-backend annotateforge-frontend
sudo systemctl start annotateforge-backend annotateforge-frontend

# Check status
sudo systemctl status annotateforge-backend
sudo systemctl status annotateforge-frontend
```
```

#### 5. Python Version Detection

**Issue**: Rocky 9 has Python 3.9 as default, but scripts may use `python3` which points to 3.9

**Recommendation**: Update scripts to detect and use correct Python version:
```bash
# In install-hpc.sh, check-hpc-env.sh
# Replace:
python3 -m venv venv

# With:
PYTHON_CMD=""
for cmd in python3.11 python3.12 python3.10 python3; do
    if command -v $cmd &> /dev/null; then
        VERSION=$($cmd -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
        if (( $(echo "$VERSION >= 3.11" | bc -l) )); then
            PYTHON_CMD=$cmd
            break
        fi
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo "Error: Python 3.11+ not found"
    exit 1
fi

$PYTHON_CMD -m venv venv
```

---

## Script Review

### ✅ check-hpc-env.sh

**Status**: EXCELLENT

**Strengths**:
- Comprehensive environment checking
- Clear color-coded output
- Checks all required dependencies
- Verifies Python/Node versions
- Tests port availability

**Recommendations**:
- ✅ Add Rocky Linux detection
- ✅ Add SELinux status check
- ✅ Add firewalld status check
- ✅ Check for Python 3.11+ specifically (not just 3.x)

### ✅ install-hpc.sh

**Status**: VERY GOOD

**Strengths**:
- Automated installation process
- Creates all necessary directories
- Generates secure secrets
- Creates startup scripts
- Optional ML model download

**Recommendations**:
- ✅ Improve Python version detection (use 3.11+ explicitly)
- ✅ Add Rocky 9 specific package installation prompts
- ✅ Check for SELinux and suggest configuration
- ✅ Offer to create systemd services (optional)

### ✅ create-admin.py

**Status**: EXCELLENT

**Strengths**:
- Clean Python code
- Good error handling
- Supports command-line arguments
- Clear user feedback

**Recommendations**:
- ✅ Add password strength validation
- ✅ Prompt for password twice to confirm
- ✅ Suggest generating strong password

### ⚠️ SLURM Job Script

**Status**: MISSING (but mentioned in docs)

**Issue**: Documentation references `annotateforge-job.slurm` but file is in legacy directory

**Recommendation**: Create updated SLURM script in main directory:

```bash
#!/bin/bash
#SBATCH --job-name=annotateforge
#SBATCH --partition=standard
#SBATCH --time=24:00:00
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=8
#SBATCH --mem=16GB
#SBATCH --output=annotateforge-%j.out
#SBATCH --error=annotateforge-%j.err

# Rocky 9 specific: Load from module system or use system packages
module load python/3.11 2>/dev/null || true
module load nodejs/18 2>/dev/null || true
module load postgresql/15 2>/dev/null || true
module load redis/7 2>/dev/null || true

# Verify we have required commands
command -v python3.11 >/dev/null || { echo "Python 3.11 not found"; exit 1; }
command -v node >/dev/null || { echo "Node.js not found"; exit 1; }

# Start services if needed (adjust paths)
if command -v redis-server &> /dev/null; then
    redis-server $HOME/annotateforge-redis/redis.conf &
    REDIS_PID=$!
    sleep 2
fi

if command -v pg_ctl &> /dev/null; then
    pg_ctl -D $HOME/annotateforge-db start -l $HOME/annotateforge-db/postgres.log
    sleep 5
fi

# Get node hostname for connection info
NODE=$(hostname -f)
echo "========================================"
echo "AnnotateForge Running on: $NODE"
echo "========================================"
echo "Frontend: http://$NODE:3000"
echo "Backend:  http://$NODE:8000"
echo "API Docs: http://$NODE:8000/docs"
echo "========================================"
echo ""
echo "To access via SSH tunnel from your local machine:"
echo "ssh -L 3000:localhost:3000 -L 8000:localhost:8000 $USER@$(hostname -s)"
echo "Then open: http://localhost:3000"
echo "========================================"

# Start AnnotateForge
cd $HOME/label-flow

# Activate venv
source venv/bin/activate

# Start backend in background
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 5

# Start frontend
cd frontend
npm run dev -- --host 0.0.0.0 --port 3000 &
FRONTEND_PID=$!
cd ..

# Keep job running and monitor processes
while kill -0 $BACKEND_PID 2>/dev/null && kill -0 $FRONTEND_PID 2>/dev/null; do
    sleep 60
done

echo "Service stopped, cleaning up..."

# Cleanup
kill $REDIS_PID 2>/dev/null || true
pg_ctl -D $HOME/annotateforge-db stop 2>/dev/null || true
```

---

## Rocky 9 Specific Issues & Solutions

### Issue 1: Python 3.9 Default

**Problem**: Rocky 9 ships with Python 3.9, but AnnotateForge requires 3.11+

**Solutions**:
1. **Option A**: Install from EPEL: `dnf install python3.11`
2. **Option B**: Build from source (for HPC without sudo)
3. **Option C**: Use Anaconda/Miniconda module if available

**Update Scripts**: Modify to explicitly use `python3.11`

### Issue 2: Node.js 16 in Base Repos

**Problem**: Rocky 9 AppStream has older Node.js

**Solutions**:
1. **Option A**: Use NodeSource repository (requires sudo)
2. **Option B**: Use nvm (Node Version Manager) in user space
3. **Option C**: Load from HPC module system

### Issue 3: Compilation Dependencies

**Problem**: Building Python packages requires development headers

**Required Packages** (if using system packages):
```bash
sudo dnf install -y \
    python3.11-devel \
    postgresql-devel \
    libpq-devel \
    gcc \
    gcc-c++ \
    make \
    openssl-devel \
    bzip2-devel \
    libffi-devel \
    zlib-devel
```

### Issue 4: PostgreSQL Socket Location

**Problem**: Rocky 9 PostgreSQL may use different socket directory

**Solution**: Update database URL to specify socket or use TCP:
```bash
# TCP connection (recommended)
DATABASE_URL=postgresql://user:pass@localhost:5432/annotateforge

# Socket connection
DATABASE_URL=postgresql://user:pass@/annotateforge?host=/var/run/postgresql
```

---

## Updated Installation Workflow for Rocky 9

```bash
# 1. Check if running on Rocky 9
cat /etc/rocky-release
# Rocky Linux release 9.x

# 2. Install prerequisites (if you have sudo)
sudo dnf install -y epel-release
sudo dnf install -y python3.11 python3.11-devel python3.11-pip
sudo dnf install -y nodejs npm  # or from NodeSource
sudo dnf install -y postgresql15-server postgresql15-devel
sudo dnf install -y redis gcc gcc-c++ make

# 3. For HPC users without sudo, use modules
module avail python  # Find available versions
module load python/3.11
module load nodejs/18
module load postgresql/15
module load redis

# 4. Run environment check
./check-hpc-env.sh

# 5. Run installer
./install-hpc.sh

# 6. Configure SELinux (if enforcing)
sudo setenforce 0  # Temporary
# or
sudo semanage port -a -t http_port_t -p tcp 8000
sudo semanage port -a -t http_port_t -p tcp 3000

# 7. Configure firewall
sudo firewall-cmd --add-port=8000/tcp --add-port=3000/tcp --permanent
sudo firewall-cmd --reload

# 8. Initialize database
cd backend
source ../venv/bin/activate
alembic upgrade head
cd ..

# 9. Create admin user
python3 create-admin.py

# 10. Start services
./start-annotateforge.sh
```

---

## Recommended Documentation Updates

### 1. Create Rocky 9 Specific Quick Start

File: `docs/HPC_ROCKY9_QUICKSTART.md`

Content: Step-by-step guide specifically for Rocky 9 HPC systems

### 2. Add SELinux/Firewall Section

File: `docs/HPC_SETUP.md`

Add after "Step 2: Set Up Redis" section

### 3. Update Script Comments

Files: `install-hpc.sh`, `check-hpc-env.sh`

Add Rocky 9 specific notes and version checks

### 4. Create SystemD Template

File: `systemd-template/`

Provide optional systemd service files for production

---

## Testing Checklist for Rocky 9

- [ ] Test on Rocky 9.0, 9.1, 9.2
- [ ] Test with system Python 3.9 (should fail gracefully)
- [ ] Test with Python 3.11 from EPEL
- [ ] Test with SELinux enforcing
- [ ] Test with SELinux permissive
- [ ] Test with firewalld enabled
- [ ] Test without sudo (pure HPC user install)
- [ ] Test with module system
- [ ] Test PostgreSQL 15 from official repos
- [ ] Test Redis 7 from EPEL
- [ ] Test SLURM job submission
- [ ] Test SSH tunneling
- [ ] Test with GPU (CUDA 11.8+)

---

## Priority Recommendations

### High Priority (Before Production)
1. ✅ Add Python 3.11+ explicit detection in scripts
2. ✅ Add SELinux configuration section
3. ✅ Add firewall configuration section
4. ✅ Create Rocky 9 specific quick start guide
5. ✅ Update SLURM job script and move from legacy

### Medium Priority (Nice to Have)
1. ✅ Add systemd service templates
2. ✅ Add automated Rocky 9 package installation script
3. ✅ Add password strength validation to create-admin.py
4. ✅ Add monitoring/health check script
5. ✅ Add backup/restore automation

### Low Priority (Future Enhancement)
1. ✅ Add Nginx reverse proxy configuration
2. ✅ Add SSL/TLS setup guide
3. ✅ Add multi-node deployment guide
4. ✅ Add Kubernetes/OpenShift deployment option

---

## Conclusion

The current HPC deployment documentation and scripts are **production-ready** with minor updates needed for Rocky 9 specific considerations. The main areas requiring attention are:

1. **Python version handling** - Ensure 3.11+ is used
2. **SELinux/Firewall** - Add configuration guidance
3. **Rocky 9 packages** - Document installation paths

With these updates, the deployment process will be smooth and reliable on Rocky 9 HPC systems.

**Estimated Time to Deploy** (with updates): 30-45 minutes

---

**Reviewed by**: Claude AI Assistant
**Review Date**: November 20, 2025
**Next Review**: Before major version releases
