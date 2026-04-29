from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Dict
import json
import asyncio
import time
from datetime import datetime

from . import models
from .database import engine, get_db
from .camera_tracker import tracker
from pydantic import BaseModel

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
            except:
                pass

manager = ConnectionManager()

def on_lap_recorded(lap_data: dict):
    # In a real app we'd use a message queue, but for a simple thread this works 
    # if we create a new event loop or use thread-safe calls.
    # A cleaner way is to let the websocket endpoint poll, but broadcasting is fine for PoC.
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    loop.run_until_complete(manager.broadcast(json.dumps({
        "type": "new_lap",
        "data": lap_data
    })))

@app.on_event("startup")
def startup_event():
    tracker.start(lap_callback=on_lap_recorded)

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

class RaceCreate(BaseModel):
    name: str
    race_type: str = "time"
    duration_seconds: int = 240
    max_laps: int = 10
    droid_ids: List[int]

class SettingUpdate(BaseModel):
    key: str
    value: str

# --- API Endpoints ---
def generate_frames():
    while True:
        frame = tracker.latest_frame
        if frame is None:
            time.sleep(0.1)
            continue
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.get("/api/video_feed")
def video_feed():
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

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

@app.post("/api/settings/reset")
def reset_database(db: Session = Depends(get_db)):
    # Stop any active tracking to prevent foreign key errors
    tracker.set_active_race(None)
    
    # Delete all operational data
    db.query(models.Lap).delete()
    db.query(models.RaceEntry).delete()
    db.query(models.Race).delete()
    db.query(models.Droid).delete()
    db.commit()
    
    # Broadcast to clear frontend state
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    loop.run_until_complete(manager.broadcast(json.dumps({
        "type": "race_stopped",
        "race_id": None
    })))
    
    return {"status": "ok"}

@app.post("/api/settings/reset_races")
def reset_races(db: Session = Depends(get_db)):
    tracker.set_active_race(None)
    
    db.query(models.Lap).delete()
    db.query(models.RaceEntry).delete()
    db.query(models.Race).delete()
    db.commit()
    
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    loop.run_until_complete(manager.broadcast(json.dumps({
        "type": "race_stopped",
        "race_id": None
    })))
    
    return {"status": "ok"}

@app.get("/api/droids")
def get_droids(db: Session = Depends(get_db)):
    return db.query(models.Droid).all()

@app.post("/api/droids")
def create_droid(droid: DroidCreate, db: Session = Depends(get_db)):
    # Check if aruco_id is unique
    existing = db.query(models.Droid).filter(models.Droid.aruco_id == droid.aruco_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="ArUco ID already registered")
        
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
        
    if droid.aruco_id != db_droid.aruco_id:
        existing = db.query(models.Droid).filter(models.Droid.aruco_id == droid.aruco_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="ArUco ID already registered")
            
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
    db_race = models.Race(
        name=race.name,
        race_type=race.race_type,
        duration_seconds=race.duration_seconds,
        max_laps=race.max_laps
    )
    db.add(db_race)
    db.commit()
    db.refresh(db_race)

    for droid_id in race.droid_ids:
        entry = models.RaceEntry(race_id=db_race.id, droid_id=droid_id)
        db.add(entry)
    db.commit()
    
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


@app.post("/api/races/{race_id}/start")
def start_race(race_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
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
    loop = asyncio.new_event_loop()
    loop.run_until_complete(manager.broadcast(json.dumps({
        "type": "race_started",
        "race_id": race.id
    })))
    
    # Setup auto-stop for timed races
    if race.race_type == 'time':
        background_tasks.add_task(sync_auto_stop_timer, race.id, race.duration_seconds)
    
    return race

@app.post("/api/races/{race_id}/stop")
def stop_race(race_id: int, db: Session = Depends(get_db)):
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")
        
    race.status = 'finished'
    db.commit()
    
    tracker.set_active_race(None)
    
    loop = asyncio.new_event_loop()
    loop.run_until_complete(manager.broadcast(json.dumps({
        "type": "race_stopped",
        "race_id": race.id
    })))
    
    return race
