#!/bin/bash

# Bash script to run the application server (Linux/macOS)

MODE=${1:-"production"}
HOST=${2:-"0.0.0.0"}
PORT=${3:-8000}

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "============================================"
echo "PG Routing Algorithm Simulator"
echo "============================================"
echo ""

# Check Python
echo "Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python not found. Please install Python 3.8+"
    exit 1
fi
PYTHON_VERSION=$(python3 --version)
echo "✓ Python found: $PYTHON_VERSION"

# Check Node.js
echo "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found. Please install Node.js 16+"
    exit 1
fi
NODE_VERSION=$(node --version)
echo "✓ Node.js found: $NODE_VERSION"
echo ""

# Create virtual environment if it doesn't exist
if [ ! -d "$PROJECT_ROOT/venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv "$PROJECT_ROOT/venv"
    echo "✓ Virtual environment created"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source "$PROJECT_ROOT/venv/bin/activate"
echo "✓ Virtual environment activated"

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -q -r "$PROJECT_ROOT/requirements.txt"
echo "✓ Python dependencies installed"

# Install frontend dependencies and build
echo "Building frontend..."
cd "$PROJECT_ROOT/frontend"
npm install --silent
npm run build --silent
cd "$PROJECT_ROOT"
echo "✓ Frontend built successfully"

echo ""
echo "============================================"
echo "Starting server..."
echo "============================================"
echo "Mode: $MODE"
echo "Host: $HOST"
echo "Port: $PORT"
echo ""
echo "Access the application at: http://localhost:$PORT"
echo "API Documentation: http://localhost:$PORT/docs"
echo ""

# Run the server
uvicorn api.main:app --host $HOST --port $PORT
