# Server Setup Guide - PG Routing Algorithm Simulator

## Prerequisites
- Python 3.8+ installed
- Node.js 16+ and npm installed
- Git (for version control)

## Installation & Setup

### 1. Backend Setup (FastAPI)

```powershell
# Navigate to project root
cd c:\Users\prabh\Desktop\Simulator-dynamic

# Create Python virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Frontend Setup (React + Vite)

```powershell
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

# Go back to project root
cd ..
```

### 3. Run the Application

#### Development Mode (with separate frontend dev server):
```powershell
# Terminal 1: Backend
.\venv\Scripts\Activate.ps1
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend (from frontend directory)
cd frontend
npm run dev
```

#### Production Mode (unified server):
```powershell
# Ensure frontend is built
cd frontend
npm run build
cd ..

# Run backend (serves both API and frontend)
.\venv\Scripts\Activate.ps1
uvicorn api.main:app --host 0.0.0.0 --port 8000
```

## Access the Application

- **Frontend**: http://localhost:3000 (dev mode) or http://localhost:8000 (production)
- **API**: http://localhost:8000/api
- **Health Check**: http://localhost:8000/api/health

## Environment Variables (Optional)

Create a `.env` file in the project root if needed for configuration.

## Troubleshooting

1. **Port already in use**: Change the port with `--port <NEW_PORT>`
2. **Module not found**: Ensure virtual environment is activated and dependencies installed
3. **Frontend build issues**: Delete `node_modules` and `package-lock.json`, then reinstall
