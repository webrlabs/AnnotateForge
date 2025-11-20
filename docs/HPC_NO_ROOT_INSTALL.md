# Installing Dependencies Without Root Access

**For HPC Users Without sudo/dnf/apt**

This guide shows how to install all AnnotateForge dependencies in your home directory without root access.

---

## Quick Start: Use Miniconda (Easiest Method)

The easiest way to get all dependencies is using Miniconda, which doesn't require root:

```bash
# 1. Download and install Miniconda
cd $HOME
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh -b -p $HOME/miniconda3

# Add to PATH
export PATH="$HOME/miniconda3/bin:$PATH"
echo 'export PATH="$HOME/miniconda3/bin:$PATH"' >> ~/.bashrc

# Initialize conda
conda init bash
source ~/.bashrc

# 2. Create environment with all dependencies
conda create -n annotateforge python=3.11 nodejs=18 postgresql redis -c conda-forge -y

# 3. Activate environment
conda activate annotateforge

# 4. Verify installations
python --version    # Should be 3.11+
node --version      # Should be 18+
psql --version      # PostgreSQL client
redis-cli --version # Redis client

# Done! Now proceed to install AnnotateForge
```

**Advantages of Conda Method:**
- ✅ No root required
- ✅ All dependencies in one command
- ✅ Easy to manage and update
- ✅ Works on any Linux HPC system
- ✅ Isolated from system packages

---

## Manual Installation (Alternative Method)

If you can't or don't want to use Conda, here's how to install each dependency from source:

### 1. Python 3.11+ from Source

```bash
# Set installation directory
export INSTALL_PREFIX=$HOME/local
mkdir -p $INSTALL_PREFIX

# Download Python 3.11
cd $HOME
wget https://www.python.org/ftp/python/3.11.7/Python-3.11.7.tgz
tar -xzf Python-3.11.7.tgz
cd Python-3.11.7

# Configure with optimizations
./configure --prefix=$INSTALL_PREFIX \
    --enable-optimizations \
    --with-ensurepip=install \
    --enable-shared \
    LDFLAGS="-Wl,-rpath=$INSTALL_PREFIX/lib"

# Compile (this takes 10-20 minutes)
make -j$(nproc)

# Install
make install

# Add to PATH
export PATH="$INSTALL_PREFIX/bin:$PATH"
export LD_LIBRARY_PATH="$INSTALL_PREFIX/lib:$LD_LIBRARY_PATH"

# Add to .bashrc for persistence
cat >> ~/.bashrc << 'EOF'
export PATH="$HOME/local/bin:$PATH"
export LD_LIBRARY_PATH="$HOME/local/lib:$LD_LIBRARY_PATH"
EOF

# Verify
python3.11 --version

# Clean up
cd $HOME
rm -rf Python-3.11.7 Python-3.11.7.tgz
```

### 2. Python 3.11 via pyenv (Alternative)

```bash
# Install pyenv
curl https://pyenv.run | bash

# Add to .bashrc
cat >> ~/.bashrc << 'EOF'
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"
EOF

# Reload shell
source ~/.bashrc

# Install Python 3.11
pyenv install 3.11.7
pyenv global 3.11.7

# Verify
python --version
```

### 3. Node.js via nvm (Node Version Manager)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Reload shell (or open new terminal)
source ~/.bashrc

# Install Node.js 18 LTS
nvm install 18
nvm use 18
nvm alias default 18

# Verify
node --version
npm --version
```

### 4. Node.js from Binary (Alternative)

```bash
# Download Node.js binary
cd $HOME
wget https://nodejs.org/dist/v18.19.0/node-v18.19.0-linux-x64.tar.xz
tar -xf node-v18.19.0-linux-x64.tar.xz

# Move to local directory
mkdir -p $HOME/local
mv node-v18.19.0-linux-x64 $HOME/local/nodejs

# Add to PATH
export PATH="$HOME/local/nodejs/bin:$PATH"
echo 'export PATH="$HOME/local/nodejs/bin:$PATH"' >> ~/.bashrc

# Verify
node --version
npm --version

# Clean up
rm node-v18.19.0-linux-x64.tar.xz
```

### 5. PostgreSQL Client from Source

```bash
# Download PostgreSQL 15
cd $HOME
wget https://ftp.postgresql.org/pub/source/v15.5/postgresql-15.5.tar.gz
tar -xzf postgresql-15.5.tar.gz
cd postgresql-15.5

# Configure (client tools only)
./configure --prefix=$HOME/local \
    --without-readline \
    --without-zlib

# Build only the client tools
cd src/bin/psql
make -j$(nproc)
make install

cd ../../interfaces/libpq
make -j$(nproc)
make install

cd ../../../src/bin/pg_dump
make -j$(nproc)
make install

# Also build pg_ctl, initdb, etc. if you want to run your own PostgreSQL
cd ../../backend
make -j$(nproc)
make install

# Verify
psql --version

# Clean up
cd $HOME
rm -rf postgresql-15.5 postgresql-15.5.tar.gz
```

### 6. PostgreSQL Server (Optional - if running your own)

```bash
# If you need to run PostgreSQL server locally
cd $HOME
wget https://ftp.postgresql.org/pub/source/v15.5/postgresql-15.5.tar.gz
tar -xzf postgresql-15.5.tar.gz
cd postgresql-15.5

# Configure
./configure --prefix=$HOME/local

# Compile (this takes time)
make -j$(nproc)
make install

# Initialize database
mkdir -p $HOME/annotateforge-db
$HOME/local/bin/initdb -D $HOME/annotateforge-db

# Configure for user port
echo "port = 5432" >> $HOME/annotateforge-db/postgresql.conf
echo "unix_socket_directories = '$HOME/annotateforge-db'" >> $HOME/annotateforge-db/postgresql.conf

# Start PostgreSQL
$HOME/local/bin/pg_ctl -D $HOME/annotateforge-db -l $HOME/annotateforge-db/logfile start

# Create database
$HOME/local/bin/createdb annotateforge

# Clean up
cd $HOME
rm -rf postgresql-15.5 postgresql-15.5.tar.gz
```

### 7. Redis from Source

```bash
# Download Redis
cd $HOME
wget https://download.redis.io/redis-stable.tar.gz
tar -xzf redis-stable.tar.gz
cd redis-stable

# Compile
make PREFIX=$HOME/local install

# Create config directory
mkdir -p $HOME/annotateforge-redis

# Create config file
cat > $HOME/annotateforge-redis/redis.conf << EOF
port 6379
bind 127.0.0.1
dir $HOME/annotateforge-redis
appendonly yes
daemonize yes
pidfile $HOME/annotateforge-redis/redis.pid
logfile $HOME/annotateforge-redis/redis.log
EOF

# Verify
redis-server --version

# Clean up
cd $HOME
rm -rf redis-stable redis-stable.tar.gz
```

### 8. Build Tools (if needed)

If you don't have gcc/make available and need to compile Python packages:

```bash
# Option 1: Use conda
conda install gcc_linux-64 gxx_linux-64 make -c conda-forge

# Option 2: Build GCC from source (advanced, takes hours)
# Not recommended - try to use HPC modules instead
# module load gcc/11 or contact your HPC admin
```

---

## Complete Installation Script (No Root)

Save this as `install-without-root.sh`:

```bash
#!/bin/bash
# Complete AnnotateForge dependency installation without root access

set -e

echo "=========================================="
echo "AnnotateForge Dependencies Installer"
echo "No Root Access Required"
echo "=========================================="
echo ""

# Configuration
INSTALL_DIR=$HOME/annotateforge-env
PYTHON_VERSION=3.11.7
NODE_VERSION=18.19.0
REDIS_VERSION=7.2.4

# Create directories
mkdir -p $INSTALL_DIR/downloads
mkdir -p $HOME/local/bin

echo "📦 Installation Method:"
echo "1. Miniconda (Recommended - Fast & Easy)"
echo "2. From Source (Manual - Takes 30-60 minutes)"
echo ""
read -p "Choose method (1 or 2): " METHOD

if [ "$METHOD" = "1" ]; then
    # Miniconda method
    echo ""
    echo "Installing via Miniconda..."

    cd $INSTALL_DIR/downloads

    # Download Miniconda
    if [ ! -f "Miniconda3-latest-Linux-x86_64.sh" ]; then
        echo "Downloading Miniconda..."
        wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
    fi

    # Install Miniconda
    if [ ! -d "$HOME/miniconda3" ]; then
        echo "Installing Miniconda to $HOME/miniconda3..."
        bash Miniconda3-latest-Linux-x86_64.sh -b -p $HOME/miniconda3
    fi

    # Initialize
    export PATH="$HOME/miniconda3/bin:$PATH"
    $HOME/miniconda3/bin/conda init bash

    # Create environment
    echo "Creating annotateforge environment..."
    $HOME/miniconda3/bin/conda create -n annotateforge \
        python=3.11 nodejs=18 postgresql redis -c conda-forge -y

    echo ""
    echo "✅ Installation complete!"
    echo ""
    echo "To activate the environment:"
    echo "  conda activate annotateforge"
    echo ""
    echo "Or add to your .bashrc:"
    echo "  echo 'conda activate annotateforge' >> ~/.bashrc"

elif [ "$METHOD" = "2" ]; then
    # From source method
    echo ""
    echo "Installing from source (this will take 30-60 minutes)..."

    # Python via pyenv
    echo ""
    echo "1/3 Installing Python via pyenv..."
    if [ ! -d "$HOME/.pyenv" ]; then
        curl -s https://pyenv.run | bash
        export PYENV_ROOT="$HOME/.pyenv"
        export PATH="$PYENV_ROOT/bin:$PATH"
        eval "$(pyenv init -)"
        pyenv install 3.11.7
        pyenv global 3.11.7
    fi

    # Node.js via nvm
    echo ""
    echo "2/3 Installing Node.js via nvm..."
    if [ ! -d "$HOME/.nvm" ]; then
        curl -s https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        nvm install 18
        nvm use 18
        nvm alias default 18
    fi

    # Redis
    echo ""
    echo "3/3 Installing Redis..."
    cd $INSTALL_DIR/downloads
    if [ ! -f "redis-stable.tar.gz" ]; then
        wget -q https://download.redis.io/redis-stable.tar.gz
    fi
    tar -xzf redis-stable.tar.gz
    cd redis-stable
    make PREFIX=$HOME/local install -j$(nproc)
    cd ..
    rm -rf redis-stable

    echo ""
    echo "✅ Installation complete!"
    echo ""
    echo "Add to your .bashrc:"
    cat << 'EOF'

# Python (pyenv)
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"

# Node.js (nvm)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Local binaries
export PATH="$HOME/local/bin:$PATH"
EOF

else
    echo "Invalid choice. Exiting."
    exit 1
fi

echo ""
echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo "1. Reload your shell: source ~/.bashrc"
echo "2. Verify installations:"
echo "   python --version"
echo "   node --version"
echo "   redis-cli --version"
echo "3. Continue with AnnotateForge installation:"
echo "   ./install-hpc.sh"
echo ""
```

---

## Environment Setup for .bashrc

After installing dependencies, add this to your `~/.bashrc`:

```bash
# ========================================
# AnnotateForge Environment
# ========================================

# Method 1: If using Conda
export PATH="$HOME/miniconda3/bin:$PATH"
# Auto-activate environment (optional)
# conda activate annotateforge

# Method 2: If using pyenv + nvm
# Python (pyenv)
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
if command -v pyenv &> /dev/null; then
    eval "$(pyenv init -)"
fi

# Node.js (nvm)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Local binaries
export PATH="$HOME/local/bin:$PATH"
export LD_LIBRARY_PATH="$HOME/local/lib:$LD_LIBRARY_PATH"
```

---

## Verification Script

Check if everything is installed correctly:

```bash
#!/bin/bash
echo "Verifying AnnotateForge dependencies..."
echo ""

# Check Python
if command -v python3 &> /dev/null; then
    PY_VER=$(python3 --version)
    echo "✅ Python: $PY_VER"
else
    echo "❌ Python: Not found"
fi

# Check pip
if command -v pip &> /dev/null; then
    PIP_VER=$(pip --version | cut -d' ' -f2)
    echo "✅ pip: $PIP_VER"
else
    echo "❌ pip: Not found"
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VER=$(node --version)
    echo "✅ Node.js: $NODE_VER"
else
    echo "❌ Node.js: Not found"
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VER=$(npm --version)
    echo "✅ npm: $NPM_VER"
else
    echo "❌ npm: Not found"
fi

# Check Redis
if command -v redis-server &> /dev/null; then
    REDIS_VER=$(redis-server --version | awk '{print $3}')
    echo "✅ Redis: $REDIS_VER"
else
    echo "⚠️  Redis: Not found (optional if using external Redis)"
fi

# Check PostgreSQL
if command -v psql &> /dev/null; then
    PG_VER=$(psql --version | awk '{print $3}')
    echo "✅ PostgreSQL client: $PG_VER"
else
    echo "⚠️  PostgreSQL client: Not found (optional if using external DB)"
fi

echo ""
echo "All required dependencies installed!"
```

---

## Troubleshooting

### Issue: Compilation Errors

**Problem**: Missing system headers or libraries

**Solutions**:
1. Use Conda method (includes all build tools)
2. Ask HPC admin to install development packages
3. Check if HPC has modules: `module avail gcc python-devel`

### Issue: Python Package Installation Fails

**Problem**: Missing compilation dependencies

**Solution**: Use conda to install system libraries:
```bash
conda install gcc_linux-64 gxx_linux-64 make cmake -c conda-forge
```

### Issue: Slow Downloads

**Problem**: Slow network on HPC

**Solution**: Download on login node, then copy to compute node:
```bash
# On login node
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh

# Then install on compute node
salloc -N 1
scp loginnode:~/Miniconda3-latest-Linux-x86_64.sh .
bash Miniconda3-latest-Linux-x86_64.sh -b -p $HOME/miniconda3
```

### Issue: Out of Space in Home Directory

**Problem**: HPC home directory quota too small

**Solution**: Install to scratch or work directory:
```bash
# Use scratch space (faster, more space, but may be cleaned periodically)
export INSTALL_PREFIX=/scratch/$USER/annotateforge-env
mkdir -p $INSTALL_PREFIX

# For Conda
bash Miniconda3-latest-Linux-x86_64.sh -b -p $INSTALL_PREFIX/miniconda3

# For pyenv
export PYENV_ROOT=$INSTALL_PREFIX/pyenv
```

---

## Quick Reference

### Recommended Method: Miniconda
```bash
# One-time setup (5 minutes)
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh -b -p $HOME/miniconda3
$HOME/miniconda3/bin/conda init bash
source ~/.bashrc

# Create environment
conda create -n annotateforge python=3.11 nodejs=18 postgresql redis -c conda-forge -y
conda activate annotateforge

# Verify
python --version && node --version
```

### Alternative: pyenv + nvm
```bash
# Install pyenv (Python)
curl https://pyenv.run | bash
pyenv install 3.11.7
pyenv global 3.11.7

# Install nvm (Node.js)
curl https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 18
nvm use 18
```

---

## Space Requirements

| Method | Disk Space | Installation Time |
|--------|------------|------------------|
| Miniconda | ~3-4 GB | 5-10 minutes |
| From Source | ~2-3 GB | 30-60 minutes |
| pyenv + nvm | ~1.5 GB | 15-30 minutes |

**Note**: Add 1-2 GB for AnnotateForge application itself and ML models.

---

**Recommendation**: Use the **Miniconda method** unless you have specific requirements. It's the fastest, easiest, and most reliable option for HPC environments without root access.
