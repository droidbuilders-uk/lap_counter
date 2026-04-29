import cv2
import cv2.aruco as aruco
import time
import subprocess
import threading
from datetime import datetime
from .database import SessionLocal
from .models import Race, RaceEntry, Lap, AppSetting

class CameraTracker:
    def __init__(self):
        self.is_running = False
        self.thread = None
        self.active_race_id = None
        self.valid_aruco_ids = []
        self.lap_callback = None
        self.latest_frame = None
        self.settings = {
            "lap_direction": "down",
            "debug_overlays": "true"
        }
        
    def update_settings(self, settings):
        self.settings.update(settings)
        
    def load_initial_settings(self):
        db = SessionLocal()
        try:
            settings_db = db.query(AppSetting).all()
            for s in settings_db:
                self.settings[s.key] = s.value
        finally:
            db.close()
        
    def update_settings(self, settings):
        self.settings.update(settings)
        
    def load_initial_settings(self):
        db = SessionLocal()
        try:
            settings_db = db.query(AppSetting).all()
            for s in settings_db:
                self.settings[s.key] = s.value
        finally:
            db.close()
        
    def set_active_race(self, race_id):
        self.active_race_id = race_id
        self._update_valid_droids()

    def _update_valid_droids(self):
        if not self.active_race_id:
            self.valid_aruco_ids = []
            return
            
        db = SessionLocal()
        try:
            race = db.query(Race).filter(Race.id == self.active_race_id).first()
            if race and race.status == 'active':
                entries = db.query(RaceEntry).filter(RaceEntry.race_id == self.active_race_id).all()
                self.valid_aruco_ids = [entry.droid.aruco_id for entry in entries if entry.droid]
            else:
                self.valid_aruco_ids = []
        finally:
            db.close()

    def start(self, lap_callback):
        self.lap_callback = lap_callback
        if not self.is_running:
            self.is_running = True
            self.load_initial_settings()
            self.thread = threading.Thread(target=self._run_loop, daemon=True)
            self.thread.start()

    def stop(self):
        self.is_running = False
        if self.thread:
            self.thread.join()

    def _run_loop(self):
        cap = cv2.VideoCapture(0)
        
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc('M', 'J', 'P', 'G'))
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        
        time.sleep(2)
        
        try:
            subprocess.run(["v4l2-ctl", "-d", "/dev/video0", "-c", "auto_exposure=1"])
            subprocess.run(["v4l2-ctl", "-d", "/dev/video0", "-c", "exposure_dynamic_framerate=0"])
            subprocess.run(["v4l2-ctl", "-d", "/dev/video0", "-c", "exposure_time_absolute=150"])
        except Exception as e:
            print(f"Warning: Could not set v4l2 hardware settings: {e}")

        if not cap.isOpened():
            print("Error: Could not open camera.")
            return

        try:
            aruco_dict = aruco.Dictionary_get(aruco.DICT_4X4_50)
            aruco_params = aruco.DetectorParameters_create()
        except AttributeError:
            aruco_dict = aruco.getPredefinedDictionary(aruco.DICT_4X4_50)
            aruco_params = aruco.DetectorParameters()
            detector = aruco.ArucoDetector(aruco_dict, aruco_params)

        previous_positions = {}
        last_cross_time = {}
        COOLDOWN_SECONDS = 3.0
        
        fps_counter = 0
        fps_start_time = time.time()
        current_fps = 0

        while self.is_running:
            ret, frame = cap.read()
            if not ret:
                time.sleep(0.1)
                continue
            
            fps_counter += 1
            if time.time() - fps_start_time > 1.0:
                current_fps = fps_counter / (time.time() - fps_start_time)
                fps_counter = 0
                fps_start_time = time.time()
            
            # Draw the finish line for the UI feed
            height, width = frame.shape[:2]
            finish_line_y = height // 2
            
            ui_frame = frame.copy()
            cv2.line(ui_frame, (0, finish_line_y), (width, finish_line_y), (0, 0, 255), 2)
            
            show_debug = self.settings.get("debug_overlays", "true") == "true"
            if show_debug:
                cv2.putText(ui_frame, f"FPS: {int(current_fps)} | Res: {width}x{height}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            try:
                corners, ids, _ = aruco.detectMarkers(gray, aruco_dict, parameters=aruco_params)
            except AttributeError:
                corners, ids, _ = detector.detectMarkers(gray)

            if ids is not None:
                # Draw a green box around ANY detected tag so the user can debug visually
                if show_debug:
                    aruco.drawDetectedMarkers(ui_frame, corners, ids)
                
                for i, marker_id in enumerate(ids.flatten()):
                    marker_id = int(marker_id) # Ensure it's a native Python int
                    
                    # ONLY TRACK DROIDS IN THE ACTIVE RACE
                    if marker_id not in self.valid_aruco_ids:
                        continue

                    marker_corners = corners[i][0]
                    center_y = int(sum([c[1] for c in marker_corners]) / 4)
                    
                    # Draw a dot at the centroid for debugging
                    if show_debug:
                        cv2.circle(ui_frame, (int(sum([c[0] for c in marker_corners]) / 4), center_y), 4, (255, 0, 0), -1)
                    
                    current_time = time.time()
                    
                    is_cooling_down = False
                    if marker_id in last_cross_time:
                        if (current_time - last_cross_time[marker_id]) < COOLDOWN_SECONDS:
                            is_cooling_down = True
                    
                    if not is_cooling_down:
                        if marker_id in previous_positions:
                            prev_y = previous_positions[marker_id]
                            
                            crossed_down = prev_y <= finish_line_y and center_y > finish_line_y
                            crossed_up = prev_y >= finish_line_y and center_y < finish_line_y
                            
                            direction = self.settings.get("lap_direction", "down")
                            is_lap = False
                            
                            if direction == 'down' and crossed_down:
                                is_lap = True
                            elif direction == 'up' and crossed_up:
                                is_lap = True
                            elif direction == 'both' and (crossed_down or crossed_up):
                                is_lap = True
                                
                            if is_lap:
                                last_cross_time[marker_id] = current_time
                                self._record_lap(marker_id)
                        
                        previous_positions[marker_id] = center_y

            # Finally encode the frame for the web UI AFTER drawing all overlays
            ret_encode, jpeg = cv2.imencode('.jpg', ui_frame)
            if ret_encode:
                self.latest_frame = jpeg.tobytes()

        cap.release()

    def _record_lap(self, aruco_id):
        if not self.active_race_id:
            return
            
        db = SessionLocal()
        try:
            from .models import Droid
            droid = db.query(Droid).filter(Droid.aruco_id == aruco_id).first()
            if not droid:
                return

            prev_lap = db.query(Lap).filter(
                Lap.race_id == self.active_race_id,
                Lap.droid_id == droid.id
            ).order_by(Lap.lap_number.desc()).first()
            
            lap_num = 1 if not prev_lap else prev_lap.lap_number + 1
            now = datetime.utcnow()
            race = db.query(Race).filter(Race.id == self.active_race_id).first()
            
            lap_time_ms = 0
            if prev_lap:
                lap_time_ms = int((now - prev_lap.timestamp).total_seconds() * 1000)
            elif race and race.start_time:
                lap_time_ms = int((now - race.start_time).total_seconds() * 1000)

            new_lap = Lap(
                race_id=self.active_race_id,
                droid_id=droid.id,
                lap_number=lap_num,
                timestamp=now,
                lap_time_ms=lap_time_ms
            )
            db.add(new_lap)
            
            # Check if this lap finishes the race
            race_finished = False
            if race and race.race_type == 'laps' and lap_num >= race.max_laps:
                race.status = 'finished'
                race_finished = True
                
            db.commit()
            db.refresh(new_lap)
            
            if self.lap_callback:
                self.lap_callback({
                    "droid_id": droid.id,
                    "aruco_id": aruco_id,
                    "lap_number": lap_num,
                    "lap_time_ms": lap_time_ms,
                    "timestamp": now.isoformat()
                })
            
            if race_finished:
                self.set_active_race(None)
        finally:
            db.close()

tracker = CameraTracker()
