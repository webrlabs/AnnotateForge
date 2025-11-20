#!/bin/bash
# Check HPC environment for annotateforge requirements

echo "========================================"
echo "annotateforge HPC Environment Check"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check function
check_item() {
    local name=$1
    local command=$2
    local version_flag=$3

    if command -v $command &> /dev/null; then
        version=$($command $version_flag 2>&1 | head -n1)
        echo -e "${GREEN}✓${NC} $name: $version"
        return 0
    else
        echo -e "${RED}✗${NC} $name: Not found"
        return 1
    fi
}

# System information
echo "📊 System Information:"
echo "  Hostname: $(hostname)"
echo "  OS: $(uname -s) $(uname -r)"
echo "  Architecture: $(uname -m)"
echo "  CPUs: $(nproc)"
echo "  Memory: $(free -h | awk '/^Mem:/ {print $2}')"
echo ""

# Check required software
echo "🔍 Required Software:"
check_item "Python3" "python3" "--version" || MISSING_PYTHON=1
check_item "pip" "pip" "--version" || check_item "pip3" "pip3" "--version" || MISSING_PIP=1
check_item "Node.js" "node" "--version" || MISSING_NODE=1
check_item "npm" "npm" "--version" || MISSING_NPM=1
check_item "PostgreSQL client" "psql" "--version" || MISSING_PSQL=1
check_item "Redis client" "redis-cli" "--version" || MISSING_REDIS=1
echo ""

# Check optional tools
echo "🛠️  Optional Tools:"
check_item "tmux" "tmux" "-V"
check_item "git" "git" "--version"
check_item "gcc" "gcc" "--version"
check_item "curl" "curl" "--version"
echo ""

# Check Python version
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
    if (( $(echo "$PYTHON_VERSION >= 3.11" | bc -l) )); then
        echo -e "${GREEN}✓${NC} Python version $PYTHON_VERSION is compatible (>= 3.11)"
    else
        echo -e "${YELLOW}⚠${NC} Python version $PYTHON_VERSION may be too old (need >= 3.11)"
    fi
else
    echo -e "${RED}✗${NC} Python not found"
fi
echo ""

# Check Node version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo -e "${GREEN}✓${NC} Node.js version is compatible (>= 18)"
    else
        echo -e "${YELLOW}⚠${NC} Node.js version may be too old (need >= 18)"
    fi
else
    echo -e "${RED}✗${NC} Node.js not found"
fi
echo ""

# Check for module system
echo "📦 Module System:"
if command -v module &> /dev/null; then
    echo -e "${GREEN}✓${NC} Environment modules available"
    echo ""
    echo "  Available Python modules:"
    module avail python 2>&1 | grep -i python | head -5 || echo "    None found"
    echo ""
    echo "  Available Node modules:"
    module avail node 2>&1 | grep -i node | head -5 || echo "    None found"
else
    echo -e "${YELLOW}⚠${NC} No module system detected"
fi
echo ""

# Check ports
echo "🌐 Network Ports:"
check_port() {
    local port=$1
    if command -v nc &> /dev/null; then
        if nc -z localhost $port 2>/dev/null; then
            echo -e "  ${YELLOW}⚠${NC} Port $port is already in use"
        else
            echo -e "  ${GREEN}✓${NC} Port $port is available"
        fi
    else
        if lsof -i :$port &>/dev/null; then
            echo -e "  ${YELLOW}⚠${NC} Port $port is already in use"
        else
            echo -e "  ${GREEN}✓${NC} Port $port is available"
        fi
    fi
}
check_port 8000
check_port 3000
check_port 5432
check_port 6379
echo ""

# Check disk space
echo "💾 Disk Space:"
df -h . | awk 'NR==2 {print "  Available: " $4 " / " $2 " (" $5 " used)"}'
AVAIL_GB=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$AVAIL_GB" -gt 10 ]; then
    echo -e "  ${GREEN}✓${NC} Sufficient disk space (>10GB available)"
else
    echo -e "  ${YELLOW}⚠${NC} Low disk space (need at least 10GB)"
fi
echo ""

# Check GPU (optional)
echo "🎮 GPU Support (optional):"
if command -v nvidia-smi &> /dev/null; then
    GPU_INFO=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
    echo -e "  ${GREEN}✓${NC} GPU detected: $GPU_INFO"
else
    echo -e "  ${YELLOW}○${NC} No GPU detected (not required)"
fi
echo ""

# Summary
echo "========================================"
echo "📋 Summary"
echo "========================================"
echo ""

if [ -z "$MISSING_PYTHON" ] && [ -z "$MISSING_NODE" ] && [ -z "$MISSING_PSQL" ]; then
    echo -e "${GREEN}✓ System is ready for annotateforge installation${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run: ./install-hpc.sh"
    echo "  2. Configure database and Redis in backend/.env"
    echo "  3. Run: cd backend && alembic upgrade head"
    echo "  4. Run: python3 create-admin.py"
    echo "  5. Run: ./start-annotateforge.sh"
else
    echo -e "${RED}✗ System is missing required dependencies${NC}"
    echo ""
    echo "Please install or load the following modules:"
    [ ! -z "$MISSING_PYTHON" ] && echo "  - Python 3.11+: module load python/3.11"
    [ ! -z "$MISSING_NODE" ] && echo "  - Node.js 18+: module load nodejs/18"
    [ ! -z "$MISSING_PSQL" ] && echo "  - PostgreSQL: module load postgresql/15"
    [ ! -z "$MISSING_REDIS" ] && echo "  - Redis: module load redis/7"
fi
echo ""
