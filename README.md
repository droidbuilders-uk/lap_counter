# Droid Lap Counter Pro

A full-stack, web-based lap counting and timing system designed for real-time ArUco tag tracking via computer vision. 

Built with **FastAPI**, **OpenCV**, and **React**, this system enables multi-droid race tracking, lap timings, auto-terminating heats, and live video streaming.

## Features

*   🏎️ **Real-Time Tracking:** Uses OpenCV and ArUco markers to accurately track laps in real time.
*   🏁 **Race Control:** Configure and run timed heats or lap-based races with automated stop timers.
*   📊 **Live Dashboard:** Watch the live camera feed and see leaderboards update instantly via WebSockets.
*   🤖 **Droid Garage:** Register multiple droids, assign them ArUco IDs, and customize their team colors.
*   ⚙️ **Live Settings:** Change lap tracking directions and toggle debug overlays on the fly without rebooting.
*   🏆 **Race Results:** Historical race data is saved to a local SQLite database for post-race analysis.
*   🌐 **100% Offline:** Self-contained application that requires no internet connection to run in the field.

## Architecture

*   **Backend:** Python 3, FastAPI, OpenCV (`cv2.aruco`), SQLite, SQLAlchemy.
*   **Frontend:** React, Vite, TailwindCSS, React Router, Lucide Icons.
*   **Streaming:** Multi-part JPEG stream for video, WebSockets for telemetry.

## Hardware Requirements

*   Raspberry Pi (or any Linux/Windows/Mac machine)
*   USB Web Camera or Raspberry Pi Camera Module

## Installation

### 1. Backend Setup

```bash
# Create a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install fastapi uvicorn sqlalchemy opencv-contrib-python numpy
```

### 2. Frontend Setup

```bash
cd frontend
npm install
```

## Running the Application

You can start both the backend server and the frontend development server simultaneously using the provided script:

```bash
./start_server.sh
```

Then, open your web browser and navigate to `http://localhost:5173`.

## License

This project is licensed under the **GNU General Public License v2.0** - see the [LICENSE](LICENSE) file for details.
