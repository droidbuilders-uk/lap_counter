#!/bin/bash

echo "Starting Lap Counter Pro..."

# Kill any existing processes
pkill -f "uvicorn backend.main:app"
pkill -f "vite"

# Start the Backend (FastAPI + OpenCV)
echo "Starting Backend..."
source .venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start the Frontend (Vite)
echo "Starting Frontend..."
cd frontend
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

echo "========================================="
echo " Lap Counter Pro is running!"
echo " Web UI: http://localhost:5173"
echo "========================================="

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
