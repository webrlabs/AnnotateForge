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
mkdir -p $INSTALL_DIR/downloads

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
        wget -q --show-progress https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
    fi
    
    # Install Miniconda
    if [ ! -d "$HOME/miniconda3" ]; then
        echo "Installing Miniconda to $HOME/miniconda3..."
        bash Miniconda3-latest-Linux-x86_64.sh -b -p $HOME/miniconda3
    fi
    
    # Initialize
    export PATH="$HOME/miniconda3/bin:$PATH"
    $HOME/miniconda3/bin/conda init bash 2>/dev/null || true
    
    # Create environment
    echo "Creating annotateforge environment with Python 3.11, Node.js 18, PostgreSQL, Redis..."
    $HOME/miniconda3/bin/conda create -n annotateforge \
        python=3.11 nodejs=18 postgresql redis -c conda-forge -y
    
    echo ""
    echo "✅ Installation complete!"
    echo ""
    echo "📝 To activate the environment, run:"
    echo "   source ~/.bashrc"
    echo "   conda activate annotateforge"
    echo ""
    echo "💡 To automatically activate (optional):"
    echo "   echo 'conda activate annotateforge' >> ~/.bashrc"
    
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
        echo "Installing Python 3.11.7..."
        pyenv install 3.11.7
        pyenv global 3.11.7
        echo "✅ Python installed"
    else
        echo "ℹ️  pyenv already installed"
    fi
    
    # Node.js via nvm
    echo ""
    echo "2/3 Installing Node.js via nvm..."
    if [ ! -d "$HOME/.nvm" ]; then
        curl -s https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        echo "Installing Node.js 18..."
        nvm install 18
        nvm use 18
        nvm alias default 18
        echo "✅ Node.js installed"
    else
        echo "ℹ️  nvm already installed"
    fi
    
    # Redis
    echo ""
    echo "3/3 Installing Redis..."
    mkdir -p $HOME/local
    cd $INSTALL_DIR/downloads
    if [ ! -f "redis-stable.tar.gz" ]; then
        echo "Downloading Redis..."
        wget -q --show-progress https://download.redis.io/redis-stable.tar.gz
    fi
    tar -xzf redis-stable.tar.gz
    cd redis-stable
    echo "Compiling Redis..."
    make PREFIX=$HOME/local install -j$(nproc) >/dev/null 2>&1
    cd ..
    rm -rf redis-stable
    echo "✅ Redis installed"
    
    echo ""
    echo "✅ Installation complete!"
    echo ""
    echo "📝 Add to your .bashrc (copy and paste):"
    cat << 'EOF'

# AnnotateForge Environment
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
EOF

else
    echo "❌ Invalid choice. Exiting."
    exit 1
fi

echo ""
echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo ""
echo "1. Reload your shell:"
echo "   source ~/.bashrc"
echo ""
if [ "$METHOD" = "1" ]; then
    echo "2. Activate conda environment:"
    echo "   conda activate annotateforge"
    echo ""
fi
echo "3. Verify installations:"
echo "   python --version"
echo "   node --version"
echo "   redis-cli --version"
echo ""
echo "4. Continue with AnnotateForge installation:"
echo "   cd label-flow"
echo "   ./install-hpc.sh"
echo ""
