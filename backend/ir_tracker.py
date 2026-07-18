import threading
import time

import cv2
import numpy as np


class IRTracker:
    def __init__(self):
        self.lap_callback = None
        self.active_race_id = None
        self.serial_port = '/dev/ttyUSB0'
        self.baud_rate = 9600
        self.ser = None
        self.running = False
        self.thread = None

        # Create a static image for the video feed
        img = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(img, "IR Transponder Mode Active", (100, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.putText(img, "Waiting for Serial Data...", (120, 280), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 1)
        self.latest_frame = cv2.imencode('.jpg', img)[1].tobytes()

    def set_active_race(self, race_id):
        self.active_race_id = race_id

    def update_settings(self, config):
        if 'serial_port' in config:
            new_port = config['serial_port']
            if new_port != self.serial_port:
                self.serial_port = new_port
                self._reconnect()

    def _reconnect(self):
        if self.ser and self.ser.is_open:
            self.ser.close()

        try:
            import serial
        except ImportError:
            print("pyserial is not installed! Cannot use IR Tracker.")
            return

        try:
            self.ser = serial.Serial(self.serial_port, self.baud_rate, timeout=1)
            print(f"IRTracker connected to {self.serial_port}")
        except Exception as e:
            print(f"IRTracker error connecting to {self.serial_port}: {e}")

    def start(self, lap_callback):
        self.lap_callback = lap_callback
        self.running = True
        self._reconnect()
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join()
        if self.ser and self.ser.is_open:
            self.ser.close()

    def _run_loop(self):
        while self.running:
            if not self.ser or not self.ser.is_open:
                time.sleep(2)
                self._reconnect()
                continue

            try:
                line = self.ser.readline()
                if line:
                    decoded = line.decode('utf-8', errors='ignore').strip()
                    # ESP32 could send just the ID, or "ID 42", or "ID: 42"
                    if decoded.isdigit():
                        self._record_lap(int(decoded))
                    elif "ID" in decoded.upper():
                        import re
                        match = re.search(r'\d+', decoded)
                        if match:
                            self._record_lap(int(match.group()))
            except Exception as e:
                print(f"IRTracker read error: {e}")
                time.sleep(1)

    def _record_lap(self, marker_id):
        if self.active_race_id is None:
            return

        from datetime import datetime

        from . import models
        from .database import SessionLocal
        db = SessionLocal()
        try:
            # ONLY TRACK DROIDS IN THE ACTIVE RACE
            entry = db.query(models.RaceEntry).filter(
                models.RaceEntry.race_id == self.active_race_id,
                models.RaceEntry.droid_id.in_(
                    db.query(models.Droid.id).filter(models.Droid.aruco_id == marker_id)
                )
            ).first()

            if not entry:
                return

            last_lap = db.query(models.Lap).filter(
                models.Lap.race_id == self.active_race_id,
                models.Lap.droid_id == entry.droid_id
            ).order_by(models.Lap.timestamp.desc()).first()

            now = datetime.utcnow()
            if last_lap:
                time_diff = (now - last_lap.timestamp).total_seconds()
                if time_diff < 2.0:
                    return

            new_lap = models.Lap(
                race_id=self.active_race_id,
                droid_id=entry.droid_id,
                timestamp=now
            )
            db.add(new_lap)
            db.commit()
            db.refresh(new_lap)

            if self.lap_callback:
                self.lap_callback({
                    "droid_id": entry.droid_id,
                    "lap_time": time_diff if last_lap else 0,
                    "timestamp": now.isoformat(),
                    "lap_id": new_lap.id,
                    "marker_id": marker_id
                })
        finally:
            db.close()
