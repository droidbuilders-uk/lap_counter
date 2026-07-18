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
 
### 1. Linux (Recommended)
You can install Lap Counter Pro directly via our APT repository. This will set up the application as a system service that starts automatically on boot.

```bash
# Add the repository
echo "deb [trusted=yes arch=amd64,arm64] https://droidbuilders-uk.github.io/lap_counter/ stable main" | sudo tee /etc/apt/sources.list.d/lapcounter.list

# Install the application
sudo apt update
sudo apt install lapcounter

# Manage the service
sudo systemctl start lapcounter
sudo systemctl status lapcounter
```

### 2. Manual / Development Setup
If you want to run the application in development mode:

#### Backend Setup
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

#### Frontend Setup

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

## Creating a Release

This project uses GitHub Actions to automatically build and publish `.deb` packages for `amd64` and `arm64` architectures. To trigger a new release:

1. Update the version number in the `VERSION` file at the root of the repository.
2. Commit your changes:
   ```bash
   git commit -am "Bump version to 1.0.6"
   ```
3. Create a Git tag starting with `v` (matching your new version):
   ```bash
   git tag v1.0.6
   ```
4. Push the commit and the tags to GitHub:
   ```bash
   git push origin main
   git push origin --tags
   ```

The GitHub Action will automatically run, build the packages, and update the `gh-pages` APT repository.

## License

This project is licensed under the **GNU General Public License v2.0** - see the [LICENSE](LICENSE) file for details.
