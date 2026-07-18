import subprocess
import threading
import time
from datetime import datetime

import cv2
import cv2.aruco as aruco

from .database import SessionLocal
from .models import AppSetting, Lap, Race, RaceEntry


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
            "debug_overlays": "true",
            "camera_index": "0",
            "aruco_dict": "DICT_4X4_50"
        }

    def update_settings(self, settings):
        print(f"DEBUG: CameraTracker updating settings: {settings}")
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
        if self.thread and self.thread.is_alive():
            print("DEBUG: CameraTracker thread already running.")
            return

        print("DEBUG: Starting CameraTracker thread...")
        self.is_running = True
        self.load_initial_settings()
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.is_running = False
        if self.thread:
            self.thread.join()

    def _run_loop(self):
        current_camera_idx = int(self.settings.get("camera_index", "0"))
        cap = cv2.VideoCapture(current_camera_idx)

        def setup_camera(c, idx):
            c.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc('M', 'J', 'P', 'G'))
            c.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            c.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            c.set(cv2.CAP_PROP_FPS, 60)
            c.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            time.sleep(1)
            try:
                device = f"/dev/video{idx}"
                # 3 is Aperture Priority Auto Exposure in v4l2 (1 is manual)
                subprocess.run(["/usr/bin/v4l2-ctl", "-d", device, "-c", "auto_exposure=3"], timeout=2)
            except Exception as e:
                print(f"Warning: Could not set v4l2 hardware settings for {idx}: {e}")

        setup_camera(cap, current_camera_idx)

        if not cap.isOpened():
            print(f"Error: Could not open camera {current_camera_idx}.")

        # --- DEDICATED FRAME GRABBER THREAD ---
        # This thread's ONLY job is to pull frames out of the OS buffer as fast as possible.
        # This completely eliminates the 2-second OpenCV lag on Raspberry Pi.
        class FrameGrabber:
            def __init__(self, capture):
                self.capture = capture
                self.ret = False
                self.frame = None
                self.new_frame_ready = False
                self.running = True
                self.thread = threading.Thread(target=self.update, daemon=True)
                self.thread.start()

            def update(self):
                while self.running:
                    if self.capture.isOpened():
                        ret, frame = self.capture.read()
                        if ret:
                            self.ret = ret
                            self.frame = frame
                            self.new_frame_ready = True
                    else:
                        time.sleep(0.1)

            def read(self):
                self.new_frame_ready = False
                return self.ret, self.frame

            def stop(self):
                self.running = False
                if self.thread.is_alive():
                    self.thread.join()

        grabber = FrameGrabber(cap)

        # Mapping for dictionaries
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

        current_dict_key = self.settings.get("aruco_dict", "DICT_4X4_50")
        dict_id = dict_mapping.get(current_dict_key, aruco.DICT_4X4_50)

        try:
            aruco_dict = aruco.Dictionary_get(dict_id)
            aruco_params = aruco.DetectorParameters_create()
            # Sensitivity tuning
            aruco_params.adaptiveThreshWinSizeMin = 3
            aruco_params.adaptiveThreshWinSizeMax = 23
            aruco_params.adaptiveThreshWinSizeStep = 10
            aruco_params.minMarkerPerimeterRate = 0.05
            # Add some filtering for noise
            aruco_params.errorCorrectionRate = 0.6
        except AttributeError:
            aruco_dict = aruco.getPredefinedDictionary(dict_id)
            aruco_params = aruco.DetectorParameters()
            aruco_params.adaptiveThreshWinSizeMin = 3
            aruco_params.adaptiveThreshWinSizeMax = 23
            aruco_params.adaptiveThreshWinSizeStep = 10
            aruco_params.minMarkerPerimeterRate = 0.05
            aruco_params.errorCorrectionRate = 0.6
            # Performance tweaks for Pi 4
            aruco_params.cornerRefinementMethod = aruco.CORNER_REFINE_NONE
            detector = aruco.ArucoDetector(aruco_dict, aruco_params)

        previous_positions = {}
        last_cross_time = {}
        COOLDOWN_SECONDS = 3.0

        fps_counter = 0
        fps_start_time = time.time()
        current_fps = 0

        while self.is_running:
            # Check for camera or dictionary index change
            new_camera_idx = int(self.settings.get("camera_index", "0"))
            new_dict_key = self.settings.get("aruco_dict", "DICT_4X4_50")

            if new_camera_idx != current_camera_idx or new_dict_key != current_dict_key:
                print(f"DEBUG: Setting change requested. Camera: {current_camera_idx}->{new_camera_idx}, "
                      f"Dict: {current_dict_key}->{new_dict_key}")

                if new_dict_key != current_dict_key:
                    current_dict_key = new_dict_key
                    dict_id = dict_mapping.get(current_dict_key, aruco.DICT_4X4_50)
                    try:
                        aruco_dict = aruco.Dictionary_get(dict_id)
                    except AttributeError:
                        aruco_dict = aruco.getPredefinedDictionary(dict_id)
                        detector = aruco.ArucoDetector(aruco_dict, aruco_params)

                if new_camera_idx != current_camera_idx:
                    grabber.stop()
                    cap.release()
                    current_camera_idx = new_camera_idx
                    cap = cv2.VideoCapture(current_camera_idx)
                    if cap.isOpened():
                        print(f"DEBUG: Successfully opened camera {current_camera_idx}")
                        setup_camera(cap, current_camera_idx)
                    else:
                        print(f"ERROR: Failed to open camera {current_camera_idx}")
                    grabber = FrameGrabber(cap)

            if not cap.isOpened():
                print(f"ERROR: Camera {current_camera_idx} is not opened. Attempting to reconnect...")
                self.latest_frame = None
                time.sleep(2)
                grabber.stop()
                cap = cv2.VideoCapture(current_camera_idx)
                if cap.isOpened():
                    print(f"DEBUG: Successfully re-opened camera {current_camera_idx}")
                    setup_camera(cap, current_camera_idx)
                grabber = FrameGrabber(cap)
                continue

            if not grabber.new_frame_ready:
                time.sleep(0.01)
                continue

            ret, frame = grabber.read()
            if not ret or frame is None:
                self.latest_frame = None  # Clear the frozen frame so the UI knows it's offline
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
                cv2.putText(ui_frame, f"FPS: {int(current_fps)} | Res: {width}x{height}", (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            # if fps_counter % 30 == 0:
            #     print(f"DEBUG: Processing frame {width}x{height} @ {int(current_fps)} FPS. "
            #           f"Camera: {current_camera_idx}")

            try:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

                # STAGE 1: Contrast Normalization
                # Essential for low-contrast cameras or reading tags off phone screens
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
                gray = clahe.apply(gray)

                def detect(img, d_obj, d_params, d_detector):
                    try:
                        c, i, _ = aruco.detectMarkers(img, d_obj, parameters=d_params)
                    except AttributeError:
                        c, i, _ = d_detector.detectMarkers(img)
                    return c, i

                corners, ids = detect(gray, aruco_dict, aruco_params, detector)
                is_mirrored = False

                # Fallback: if tag is mirrored (e.g. holding a phone to a front-facing camera)
                if ids is None:
                    corners, ids = detect(cv2.flip(gray, 1), aruco_dict, aruco_params, detector)
                    if ids is not None:
                        is_mirrored = True

                # Rescale corners back to original resolution and add ROI offset
                if ids is not None:
                    # Make a copy of corners to avoid modifying them while iterating
                    rescaled_corners = []
                    for corner in corners:
                        # corner shape is (1, 4, 2)
                        c = corner[0].copy() # Get the 4 points
                        if is_mirrored:
                            # Un-flip the x coordinates
                            c[:, 0] = width - c[:, 0]
                        rescaled_corners.append(c.reshape(1, 4, 2))
                    corners = rescaled_corners

                    import numpy as np
                    flat_ids = np.ravel(ids)
                    for i in range(len(flat_ids)):
                        marker_id = int(flat_ids[i])
                        # Get center point of marker
                        c = corners[i][0]
                        center_y = int((c[0][1] + c[2][1]) / 2)
                        center_x = int((c[0][0] + c[2][0]) / 2)

                        if show_debug:
                            # Draw marker outline and ID
                            cv2.polylines(ui_frame, [c.astype(int)], True, (0, 255, 0), 2)
                            cv2.putText(ui_frame, f"ID: {marker_id}", (int(c[0][0]), int(c[0][1]) - 10),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                            cv2.circle(ui_frame, (center_x, center_y), 4, (255, 0, 0), -1)

                        # ONLY TRACK DROIDS IN THE ACTIVE RACE
                        if marker_id not in self.valid_aruco_ids:
                            continue

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
            except Exception as e:
                print(f"ERROR: Exception in camera loop: {e}")
                time.sleep(1)

        grabber.stop()
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

            race_finished = False
            if race.race_type == 'laps' and lap_num >= race.duration_laps:
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
