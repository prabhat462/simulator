#!/bin/bash

################################################################################
# SETUP SCRIPT FOR MAC - Payment Gateway Routing Simulator
# 
# This script sets up the complete environment and dependencies for running
# the payment gateway routing simulator on macOS.
# 
# Usage: bash setup_mac.sh
################################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Payment Gateway Routing Simulator - macOS Setup${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Check macOS ───────────────────────────────────────────────────────────
echo -e "${YELLOW}Checking system requirements...${NC}"
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}✗ This script is for macOS only.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ macOS detected${NC}"
echo ""

# ─── Check and install Homebrew ───────────────────────────────────────────
if ! command -v brew &> /dev/null; then
    echo -e "${YELLOW}Installing Homebrew...${NC}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    echo -e "${GREEN}✓ Homebrew installed${NC}"
else
    echo -e "${GREEN}✓ Homebrew already installed${NC}"
fi
echo ""

# ─── Check and install Python ──────────────────────────────────────────────
echo -e "${YELLOW}Checking Python...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}Installing Python 3 via Homebrew...${NC}"
    brew install python3
    echo -e "${GREEN}✓ Python 3 installed${NC}"
else
    PYTHON_VERSION=$(python3 --version | awk '{print $2}')
    echo -e "${GREEN}✓ Python ${PYTHON_VERSION} already installed${NC}"
fi
echo ""

# ─── Check and install Node.js ────────────────────────────────────────────
echo -e "${YELLOW}Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Installing Node.js via Homebrew...${NC}"
    brew install node
    echo -e "${GREEN}✓ Node.js installed${NC}"
else
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js ${NODE_VERSION} already installed${NC}"
fi
echo ""

# ─── Create Python virtual environment ─────────────────────────────────────
echo -e "${YELLOW}Setting up Python virtual environment...${NC}"
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
else
    echo -e "${GREEN}✓ Virtual environment already exists${NC}"
fi

# Activate virtual environment
source venv/bin/activate
echo -e "${GREEN}✓ Virtual environment activated${NC}"
echo ""

# ─── Install Python dependencies ───────────────────────────────────────────
echo -e "${YELLOW}Installing Python dependencies...${NC}"
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
echo -e "${GREEN}✓ Python dependencies installed${NC}"
echo ""

# ─── Install Node.js dependencies ──────────────────────────────────────────
echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
cd frontend
npm install
echo -e "${GREEN}✓ Node.js dependencies installed${NC}"
cd ..
echo ""

# ─── Summary ────────────────────────────────────────────────────────────────
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ✓ Setup Complete!${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo ""
echo "1. Start the application using the run script:"
echo -e "   ${YELLOW}bash run_mac.sh${NC}"
echo ""
echo "2. Or manually start both services:"
echo "   Terminal 1 (Backend):"
echo -e "   ${YELLOW}source venv/bin/activate && python -m uvicorn api.main:app --host 0.0.0.0 --port 8000${NC}"
echo ""
echo "   Terminal 2 (Frontend):"
echo -e "   ${YELLOW}cd frontend && npm run dev${NC}"
echo ""
echo "3. Open your browser and navigate to:"
echo -e "   ${BLUE}http://localhost:5173${NC}"
echo ""
echo -e "${YELLOW}For more information, see README.md${NC}"
echo ""
