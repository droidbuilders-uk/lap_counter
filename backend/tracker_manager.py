from .camera_tracker import tracker as camera_tracker
from .ir_tracker import IRTracker


class TrackerManager:
    def __init__(self):
        self.ir_tracker = IRTracker()
        self.active_tracker = "camera"
        self.lap_callback = None
        self.active_race_id = None

    def update_settings(self, config):
        if 'tracking_method' in config:
            self.active_tracker = config['tracking_method']

        # Forward settings to both
        camera_tracker.update_settings(config)
        self.ir_tracker.update_settings(config)

    def _route_lap_camera(self, lap_data):
        if self.active_tracker == "camera" and self.lap_callback:
            self.lap_callback(lap_data)

    def _route_lap_ir(self, lap_data):
        if self.active_tracker == "ir_serial" and self.lap_callback:
            self.lap_callback(lap_data)

    def start(self, lap_callback, debug_callback=None):
        self.lap_callback = lap_callback
        camera_tracker.start(lap_callback=self._route_lap_camera)
        self.ir_tracker.start(lap_callback=self._route_lap_ir, debug_callback=debug_callback)

    def stop(self):
        camera_tracker.stop()
        self.ir_tracker.stop()

    def set_active_race(self, race_id):
        self.active_race_id = race_id
        camera_tracker.set_active_race(race_id)
        self.ir_tracker.set_active_race(race_id)

    @property
    def latest_frame(self):
        # Always return the camera feed!
        return camera_tracker.latest_frame

tracker = TrackerManager()
