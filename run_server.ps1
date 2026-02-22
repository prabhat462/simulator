# PowerShell script to run the application server

param(
    [string]$mode = "production",
    [string]$host = "0.0.0.0",
    [int]$port = 8000
)

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "PG Routing Algorithm Simulator" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check Python
Write-Host "Checking Python installation..." -ForegroundColor Yellow
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Python not found. Please install Python 3.8+" -ForegroundColor Red
    exit 1
}
$pythonVersion = python --version
Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green

# Check Node.js
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js not found. Please install Node.js 16+" -ForegroundColor Red
    exit 1
}
$nodeVersion = node --version
Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
Write-Host ""

# Create virtual environment if it doesn't exist
if (-not (Test-Path "$ProjectRoot\venv")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv "$ProjectRoot\venv"
    Write-Host "✓ Virtual environment created" -ForegroundColor Green
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& "$ProjectRoot\venv\Scripts\Activate.ps1"
Write-Host "✓ Virtual environment activated" -ForegroundColor Green

# Install Python dependencies
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
pip install -q -r "$ProjectRoot\requirements.txt"
Write-Host "✓ Python dependencies installed" -ForegroundColor Green

# Install frontend dependencies and build
Write-Host "Building frontend..." -ForegroundColor Yellow
Push-Location "$ProjectRoot\frontend"
npm install --silent
npm run build --silent
Pop-Location
Write-Host "✓ Frontend built successfully" -ForegroundColor Green

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "Starting server..." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "Mode: $mode" -ForegroundColor Cyan
Write-Host "Host: $host" -ForegroundColor Cyan
Write-Host "Port: $port" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access the application at: http://localhost:$port" -ForegroundColor Green
Write-Host "API Documentation: http://localhost:$port/docs" -ForegroundColor Green
Write-Host ""

# Run the server
uvicorn api.main:app --host $host --port $port
