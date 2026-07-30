import asyncio
import io
import json
import os
import time
from datetime import datetime
from typing import List

import cv2
import cv2.aruco as aruco
import numpy as np
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from . import models
from .database import engine, get_db
from .tracker_manager import tracker

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE races ADD COLUMN season_id INTEGER REFERENCES seasons(id)"))
        conn.execute(text("ALTER TABLE races ADD COLUMN race_class VARCHAR DEFAULT 'adhoc'"))
except Exception:
    pass # columns already exist

try:
    # Attempt to drop the unique index on aruco_id if it exists from older schema
    with engine.begin() as conn:
        conn.execute(text("DROP INDEX IF EXISTS ix_droids_aruco_id"))
        conn.execute(text("CREATE INDEX ix_droids_aruco_id ON droids (aruco_id)"))
except Exception:
    pass

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Lap Counter API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- WebSocket Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()

def on_lap_recorded(lap_data: dict):
    # This is called from the CameraTracker thread
    try:
        # We need the loop where the manager connections live (the main loop)
        # In FastAPI, we can't easily get the main loop from a random thread without storing it
        # But we can try to use the current running loop if we are in it,
        # or use a global reference.
        asyncio.run_coroutine_threadsafe(
            manager.broadcast(json.dumps({
                "type": "new_lap",
                "data": lap_data
            })),
            app.state.loop
        )
    except Exception as e:
        print(f"Error broadcasting lap: {e}")

def on_debug_message(message: str):
    try:
        asyncio.run_coroutine_threadsafe(
            manager.broadcast(json.dumps({
                "type": "debug_log",
                "message": message
            })),
            app.state.loop
        )
    except Exception:
        pass

@app.on_event("startup")
async def startup_event():
    app.state.loop = asyncio.get_running_loop()
    from . import models
    from .database import SessionLocal
    db = SessionLocal()
    settings = db.query(models.AppSetting).all()
    config = {s.key: s.value for s in settings}
    tracker.update_settings(config)

    # Sync active race if the server restarted during a race
    active_race = db.query(models.Race).filter(models.Race.status == 'active').first()
    if active_race:
        tracker.set_active_race(active_race.id)

    db.close()

    tracker.start(lap_callback=on_lap_recorded, debug_callback=on_debug_message)

@app.on_event("shutdown")
def shutdown_event():
    tracker.stop()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

def sync_auto_stop_timer(race_id: int, duration_seconds: int):
    time.sleep(duration_seconds)
    from .database import SessionLocal
    db = SessionLocal()
    try:
        race = db.query(models.Race).filter(models.Race.id == race_id).first()
        if race and race.status == 'active':
            race.status = 'finished'
            db.commit()
            tracker.set_active_race(None)

            # Broadcast the stop
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            loop.run_until_complete(manager.broadcast(json.dumps({
                "type": "race_stopped",
                "race_id": race_id
            })))
    finally:
        db.close()

# --- API Schemas ---
class DroidCreate(BaseModel):
    name: str
    aruco_id: int
    color_hex: str = "#ffffff"

class SeasonCreate(BaseModel):
    name: str

class RaceCreate(BaseModel):
    name: str
    race_type: str = "time"
    duration_seconds: int = 240
    max_laps: int = 10
    season_id: int | None = None
    race_class: str = "adhoc"
    droid_ids: list[int]

class RaceUpdate(BaseModel):
    name: str | None = None
    duration_seconds: int | None = None
    max_laps: int | None = None
    droid_ids: list[int] | None = None

class SettingUpdate(BaseModel):
    key: str
    value: str

# --- API Endpoints ---
def generate_frames():
    last_frame = None
    while True:
        frame = tracker.latest_frame
        if frame is None or frame == last_frame:
            time.sleep(0.03)  # Wait for a new frame (approx 30fps)
            continue
        last_frame = frame
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.get("/api/video_feed")
def video_feed():
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/api/markers/{marker_id}")
def get_marker_image(marker_id: int, dictionary: str = "DICT_4X4_50", size: int = 500):
    """Generates an ArUco marker image for the given ID and dictionary."""
    dict_mapping = {
        "DICT_4X4_50": aruco.DICT_4X4_50,
        "DICT_4X4_100": aruco.DICT_4X4_100,
        "DICT_4X4_250": aruco.DICT_4X4_250,
        "DICT_4X4_1000": aruco.DICT_4X4_1000,
        "DICT_5X5_50": aruco.DICT_5X5_50,
        "DICT_6X6_50": aruco.DICT_6X6_50,
        "DICT_6X6_250": aruco.DICT_6X6_250,
        "DICT_7X7_50": aruco.DICT_7X7_50,
        "DICT_APRILTAG_36h11": getattr(aruco, 'DICT_APRILTAG_36h11', 0)
    }

    if dictionary not in dict_mapping:
        raise HTTPException(status_code=400, detail="Invalid dictionary")

    try:
        dict_obj = aruco.Dictionary_get(dict_mapping[dictionary])
    except AttributeError:
        dict_obj = aruco.getPredefinedDictionary(dict_mapping[dictionary])

    # Generate marker
    try:
        marker_img = np.zeros((size, size), dtype=np.uint8)
        try:
            marker_img = aruco.drawMarker(dict_obj, marker_id, size, marker_img, 1)
        except AttributeError:
            marker_img = aruco.generateImageMarker(dict_obj, marker_id, size, 1)

        # Encode to PNG
        ret, buffer = cv2.imencode('.png', marker_img)
        if not ret:
            raise HTTPException(status_code=500, detail="Failed to encode image")

        return StreamingResponse(io.BytesIO(buffer), media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(models.AppSetting).all()
    # default fallback
    config = {
        "lap_direction": "down",
        "debug_overlays": "true"
    }
    for s in settings:
        config[s.key] = s.value
    return config

@app.put("/api/settings")
def update_settings(settings: List[SettingUpdate], db: Session = Depends(get_db)):
    config = {}
    for s in settings:
        db_setting = db.query(models.AppSetting).filter(models.AppSetting.key == s.key).first()
        if db_setting:
            db_setting.value = s.value
        else:
            db_setting = models.AppSetting(key=s.key, value=s.value)
            db.add(db_setting)
        config[s.key] = s.value
    db.commit()

    tracker.update_settings(config)
    return config

@app.get("/api/settings/cameras")
def list_cameras():
    """List available camera indices on the system."""
    import os
    available_cameras = []

    # On Linux, query sysfs directly so we can see cameras even if OpenCV holds a lock on them
    if os.name == 'posix' and os.path.exists('/sys/class/video4linux'):
        import glob
        devices = glob.glob('/sys/class/video4linux/video*')
        for dev in devices:
            try:
                idx = int(os.path.basename(dev).replace('video', ''))
                name_path = os.path.join(dev, 'name')
                if os.path.exists(name_path):
                    with open(name_path, 'r') as f:
                        name = f.read().strip()
                else:
                    name = f"Camera {idx}"
                available_cameras.append({"index": idx, "name": f"{name} (idx: {idx})"})
            except Exception:
                pass
        available_cameras.sort(key=lambda x: x["index"])
        return available_cameras

    # Fallback for Windows / Mac
    import cv2
    backend = cv2.CAP_ANY
    try:
        cv2.setLogLevel(0) # LOG_LEVEL_SILENT
    except AttributeError:
        pass

    for i in range(6):
        cap = cv2.VideoCapture(i, backend)
        if cap.isOpened():
            available_cameras.append({"index": i, "name": f"Camera {i}"})
            cap.release()

    return available_cameras

@app.post("/api/settings/reset")
async def reset_database(db: Session = Depends(get_db)):
    # Stop any active tracking to prevent foreign key errors
    tracker.set_active_race(None)

    # Delete all operational data
    db.query(models.Lap).delete()
    db.query(models.RaceEntry).delete()
    db.query(models.Race).delete()
    db.query(models.Droid).delete()
    db.commit()

    # Broadcast to clear frontend state
    await manager.broadcast(json.dumps({
        "type": "race_stopped",
        "race_id": None
    }))

    return {"status": "ok"}

@app.post("/api/settings/reset_races")
async def reset_races(db: Session = Depends(get_db)):
    tracker.set_active_race(None)

    db.query(models.Lap).delete()
    db.query(models.RaceEntry).delete()
    db.query(models.Race).delete()
    db.commit()

    await manager.broadcast(json.dumps({
        "type": "race_stopped",
        "race_id": None
    }))

    return {"status": "ok"}

@app.post("/api/settings/flash_sensor_bar")
async def flash_sensor_bar():
    import os
    import subprocess
    project_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'ir_hardware', 'sensor_bar')

    # Pause the tracker so it completely releases the Serial Port lock!
    was_active = False
    if tracker.active_tracker == "ir_serial":
        tracker.stop()
        was_active = True

    try:
        # Run PlatformIO natively via Python
        result = subprocess.run(
            ["pio", "run", "-d", project_dir, "-t", "upload"],
            capture_output=True,
            text=True
        )

        # Resume tracker if it was active
        if was_active:
            # Re-read settings just to make sure it grabs the port correctly
            tracker.start(lap_callback=on_lap_recorded)

        if result.returncode == 0:
            return {"status": "success", "log": result.stdout}
        else:
            raise HTTPException(status_code=500, detail=result.stderr or result.stdout)
    except Exception as e:
        if was_active:
            tracker.start(lap_callback=on_lap_recorded)
        raise HTTPException(status_code=500, detail=str(e)) from e

class TransponderFlashRequest(BaseModel):
    droid_id: int

@app.post("/api/settings/flash_transponder")
async def flash_transponder(req: TransponderFlashRequest):
    import os
    import re
    import subprocess

    project_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'ir_hardware', 'transponder')
    main_cpp = os.path.join(project_dir, 'src', 'main.cpp')

    try:
        with open(main_cpp, 'r') as f:
            content = f.read()

        content = re.sub(
            r'const uint16_t TRANSPONDER_ID\s*=\s*\d+;',
            f'const uint16_t TRANSPONDER_ID = {req.droid_id};',
            content
        )

        with open(main_cpp, 'w') as f:
            f.write(content)

        result = subprocess.run(
            ["pio", "run", "-d", project_dir, "-t", "upload"],
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            return {"status": "success", "log": result.stdout}
        else:
            raise HTTPException(status_code=500, detail=result.stderr or result.stdout)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

@app.get("/api/droids")
def get_droids(db: Session = Depends(get_db)):
    return db.query(models.Droid).all()

@app.post("/api/droids")
def create_droid(droid: DroidCreate, db: Session = Depends(get_db)):
    db_droid = models.Droid(**droid.dict())
    db.add(db_droid)
    db.commit()
    db.refresh(db_droid)
    return db_droid

@app.put("/api/droids/{droid_id}")
def update_droid(droid_id: int, droid: DroidCreate, db: Session = Depends(get_db)):
    db_droid = db.query(models.Droid).filter(models.Droid.id == droid_id).first()
    if not db_droid:
        raise HTTPException(status_code=404, detail="Droid not found")

    db_droid.name = droid.name
    db_droid.aruco_id = droid.aruco_id
    db_droid.color_hex = droid.color_hex
    db.commit()
    db.refresh(db_droid)
    return db_droid

@app.delete("/api/droids/{droid_id}")
def delete_droid(droid_id: int, db: Session = Depends(get_db)):
    db_droid = db.query(models.Droid).filter(models.Droid.id == droid_id).first()
    if not db_droid:
        raise HTTPException(status_code=404, detail="Droid not found")
    db.delete(db_droid)
    db.commit()
    return {"status": "ok"}

@app.get("/api/races")
def get_races(db: Session = Depends(get_db)):
    races = db.query(models.Race).order_by(models.Race.id.desc()).all()
    return races

@app.post("/api/races")
def create_race(race: RaceCreate, db: Session = Depends(get_db)):
    # Check for duplicate aruco_ids
    droids = db.query(models.Droid).filter(models.Droid.id.in_(race.droid_ids)).all()
    aruco_ids = [d.aruco_id for d in droids]
    if len(aruco_ids) != len(set(aruco_ids)):
        raise HTTPException(status_code=400, detail="Cannot start race: Multiple droids share the same Transponder ID.")

    db_race = models.Race(
        name=race.name,
        race_type=race.race_type,
        duration_seconds=race.duration_seconds,
        max_laps=race.max_laps,
        season_id=race.season_id,
        race_class=race.race_class
    )
    db.add(db_race)
    db.commit()
    db.refresh(db_race)

    for droid_id in race.droid_ids:
        entry = models.RaceEntry(race_id=db_race.id, droid_id=droid_id)
        db.add(entry)
    db.commit()

    return db_race

@app.put("/api/races/{race_id}")
def update_race(race_id: int, race: RaceUpdate, db: Session = Depends(get_db)):
    db_race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not db_race:
        raise HTTPException(status_code=404, detail="Race not found")

    if db_race.status != "pending":
        raise HTTPException(status_code=400, detail="Cannot edit a race that has already started")

    if race.name is not None:
        db_race.name = race.name
    if race.duration_seconds is not None:
        db_race.duration_seconds = race.duration_seconds
    if race.max_laps is not None:
        db_race.max_laps = race.max_laps

    if race.droid_ids is not None:
        # Check for duplicate aruco_ids
        droids = db.query(models.Droid).filter(models.Droid.id.in_(race.droid_ids)).all()
        aruco_ids = [d.aruco_id for d in droids]
        if len(aruco_ids) != len(set(aruco_ids)):
            raise HTTPException(
                status_code=400,
                detail="Cannot edit race: Multiple droids share the same Transponder ID."
            )

        # Delete old entries
        db.query(models.RaceEntry).filter(models.RaceEntry.race_id == race_id).delete()
        # Add new entries
        for droid_id in race.droid_ids:
            entry = models.RaceEntry(race_id=race_id, droid_id=droid_id)
            db.add(entry)

    db.commit()
    db.refresh(db_race)
    return db_race

@app.get("/api/races/active")
def get_active_race(db: Session = Depends(get_db)):
    race = db.query(models.Race).filter(models.Race.status == 'active').first()
    if not race:
        return None

    # Get entries and laps
    entries = db.query(models.RaceEntry).filter(models.RaceEntry.race_id == race.id).all()
    droids = [e.droid for e in entries if e.droid]
    laps = db.query(models.Lap).filter(models.Lap.race_id == race.id).all()

    return {
        "race": race,
        "droids": droids,
        "laps": laps
    }

@app.get("/api/races/{race_id}")
def get_single_race(race_id: int, db: Session = Depends(get_db)):
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")

    entries = db.query(models.RaceEntry).filter(models.RaceEntry.race_id == race.id).all()
    droids = [e.droid for e in entries if e.droid]
    laps = db.query(models.Lap).filter(models.Lap.race_id == race.id).all()

    return {
        "race": race,
        "droids": droids,
        "laps": laps
    }

@app.post("/api/races/{race_id}/repeat")
def repeat_race(race_id: int, db: Session = Depends(get_db)):
    """Creates a new race with the same settings and competitors as the original."""
    original_race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not original_race:
        raise HTTPException(status_code=404, detail="Original race not found")

    # Get original entries
    entries = db.query(models.RaceEntry).filter(models.RaceEntry.race_id == race_id).all()
    droid_ids = [e.droid_id for e in entries]

    # Create new race
    new_race = models.Race(
        name=f"{original_race.name} (Repeat)",
        race_type=original_race.race_type,
        duration_seconds=original_race.duration_seconds,
        max_laps=original_race.max_laps,
        status="pending"
    )
    db.add(new_race)
    db.commit()
    db.refresh(new_race)

    # Add same droids
    for d_id in droid_ids:
        entry = models.RaceEntry(race_id=new_race.id, droid_id=d_id)
        db.add(entry)

    db.commit()
    return new_race


@app.post("/api/races/{race_id}/start")
async def start_race(race_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Stop any currently active races
    active_races = db.query(models.Race).filter(models.Race.status == 'active').all()
    for ar in active_races:
        ar.status = 'finished'

    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")

    race.status = 'active'
    race.start_time = datetime.utcnow()
    db.commit()

    # Notify tracker
    tracker.set_active_race(race.id)

    # Broadcast start event
    await manager.broadcast(json.dumps({
        "type": "race_started",
        "race_id": race.id
    }))

    # Setup auto-stop for timed races
    if race.race_type == 'time':
        background_tasks.add_task(sync_auto_stop_timer, race.id, race.duration_seconds)

    return race

@app.post("/api/races/{race_id}/stop")
async def stop_race(race_id: int, db: Session = Depends(get_db)):
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")

    race.status = 'finished'
    db.commit()

    tracker.set_active_race(None)

    await manager.broadcast(json.dumps({
        "type": "race_stopped",
        "race_id": race.id
    }))

    return race

# --- Seasons Endpoints ---

@app.get("/api/seasons")
def get_seasons(db: Session = Depends(get_db)):
    return db.query(models.Season).order_by(models.Season.id.desc()).all()

@app.post("/api/seasons")
def create_season(season: SeasonCreate, db: Session = Depends(get_db)):
    db_season = models.Season(name=season.name)
    db.add(db_season)
    db.commit()
    db.refresh(db_season)
    return db_season

@app.get("/api/seasons/{season_id}")
def get_season(season_id: int, db: Session = Depends(get_db)):
    season = db.query(models.Season).filter(models.Season.id == season_id).first()
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")
    races = db.query(models.Race).filter(models.Race.season_id == season_id).order_by(models.Race.id.desc()).all()
    races_data = []
    for r in races:
        entries = [e.droid_id for e in db.query(models.RaceEntry).filter(models.RaceEntry.race_id == r.id).all()]
        races_data.append({
            "id": r.id,
            "name": r.name,
            "status": r.status,
            "race_class": r.race_class,
            "duration_seconds": r.duration_seconds,
            "max_laps": r.max_laps,
            "droid_ids": entries
        })
    return {"season": season, "races": races_data}

@app.get("/api/seasons/{season_id}/leaderboard")
def get_season_leaderboard(season_id: int, db: Session = Depends(get_db)):
    # Calculate stats across all 'heat' class races in this season
    heats = db.query(models.Race).filter(
        models.Race.season_id == season_id,
        models.Race.race_class == 'heat',
        models.Race.status == 'finished'
    ).all()

    heat_ids = [h.id for h in heats]
    if not heat_ids:
        return []

    # Get all laps in these heats
    laps = db.query(models.Lap).filter(models.Lap.race_id.in_(heat_ids)).all()

    # Calculate per droid stats
    stats = {}
    for lap in laps:
        droid_id = lap.droid_id
        if droid_id not in stats:
            stats[droid_id] = {
                "droid": db.query(models.Droid).filter(models.Droid.id == droid_id).first(),
                "fastest_lap_ms": 999999999,
                "heat_laps": {} # race_id -> lap count
            }

        if lap.lap_time_ms < stats[droid_id]["fastest_lap_ms"]:
            stats[droid_id]["fastest_lap_ms"] = lap.lap_time_ms

        stats[droid_id]["heat_laps"][lap.race_id] = stats[droid_id]["heat_laps"].get(lap.race_id, 0) + 1

    leaderboard = []
    for _d_id, stat in stats.items():
        most_laps = max(stat["heat_laps"].values()) if stat["heat_laps"] else 0
        leaderboard.append({
            "droid": stat["droid"],
            "fastest_lap_ms": stat["fastest_lap_ms"] if stat["fastest_lap_ms"] != 999999999 else None,
            "most_laps": most_laps,
            "heats_entered": len(stat["heat_laps"])
        })

    # Sort primarily by most laps, then by fastest lap
    leaderboard.sort(key=lambda x: (-x["most_laps"], x["fastest_lap_ms"] if x["fastest_lap_ms"] else 999999999))
    return leaderboard


# Serve static files from the React frontend build
# This must be at the end to avoid shadowing /api routes
frontend_dist_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.exists(frontend_dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist_path, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        # Don't shadow /api or /ws routes
        if full_path.startswith("api") or full_path.startswith("ws"):
            raise HTTPException(status_code=404)

        index_path = os.path.join(frontend_dist_path, "index.html")
        return FileResponse(index_path)
else:
    print(f"WARNING: Frontend dist not found at {frontend_dist_path}. Run 'npm run build' first.")
