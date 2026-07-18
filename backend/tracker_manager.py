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
            new_method = config['tracking_method']
            if new_method != self.active_tracker:
                self._switch_tracker(new_method)

        # Forward settings to both
        camera_tracker.update_settings(config)
        self.ir_tracker.update_settings(config)

    def _switch_tracker(self, new_method):
        # Stop current
        if self.active_tracker == "camera":
            camera_tracker.stop()
        else:
            self.ir_tracker.stop()

        self.active_tracker = new_method

        # Start new
        if self.active_tracker == "camera":
            camera_tracker.start(lap_callback=self.lap_callback)
            camera_tracker.set_active_race(self.active_race_id)
        else:
            self.ir_tracker.start(lap_callback=self.lap_callback)
            self.ir_tracker.set_active_race(self.active_race_id)

    def start(self, lap_callback):
        self.lap_callback = lap_callback
        if self.active_tracker == "camera":
            camera_tracker.start(lap_callback)
        else:
            self.ir_tracker.start(lap_callback)

    def stop(self):
        if self.active_tracker == "camera":
            camera_tracker.stop()
        else:
            self.ir_tracker.stop()

    def set_active_race(self, race_id):
        self.active_race_id = race_id
        if self.active_tracker == "camera":
            camera_tracker.set_active_race(race_id)
        else:
            self.ir_tracker.set_active_race(race_id)

    @property
    def latest_frame(self):
        if self.active_tracker == "camera":
            return camera_tracker.latest_frame
        else:
            return self.ir_tracker.latest_frame

tracker = TrackerManager()
