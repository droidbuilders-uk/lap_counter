import cv2
import cv2.aruco as aruco
import time
import subprocess

def main():
    # Initialize the camera. Removing CAP_V4L2 as it sometimes breaks MJPG negotiation in OpenCV.
    cap = cv2.VideoCapture(0)
    
    # --- Performance Tuning ---
    # We MUST successfully negotiate MJPG to get 60fps at 720p. 
    # If this fails, OpenCV falls back to YUYV which caps at exactly 5 FPS for 720p!
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc('M', 'J', 'P', 'G'))

    # Set to 640x480. The C922 natively supports 30 FPS here without needing MJPG compression.
    # This is much more reliable than fighting with OpenCV's MJPG negotiator.
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    # Request 30 FPS (Native for 640x480 uncompressed)
    cap.set(cv2.CAP_PROP_FPS, 30)
    
    # 3. Disable Auto-Exposure (Optional, requires bright light)
    # We commented these out because we used v4l2-ctl to set hardware exposure directly.
    # OpenCV commands here might conflict with our v4l2-ctl fixes.
    # cap.set(cv2.CAP_PROP_AUTO_EXPOSURE, 0.25) 
    # cap.set(cv2.CAP_PROP_EXPOSURE, -6)        
    # --------------------------
    
    # Wait for the camera to initialize
    time.sleep(2)
    
    # --- Bulletproof Linux Camera Hardware Control ---
    # OpenCV's initialization often resets hardware exposure settings.
    # We use subprocess to force the v4l2 driver directly AFTER OpenCV has claimed the camera.
    try:
        subprocess.run(["v4l2-ctl", "-d", "/dev/video0", "-c", "auto_exposure=1"])
        subprocess.run(["v4l2-ctl", "-d", "/dev/video0", "-c", "exposure_dynamic_framerate=0"])
        subprocess.run(["v4l2-ctl", "-d", "/dev/video0", "-c", "exposure_time_absolute=150"])
    except Exception as e:
        print(f"Warning: Could not set v4l2 hardware settings: {e}")
    # --------------------------

    if not cap.isOpened():
        print("Error: Could not open camera.")
        return

    # Define the ArUco dictionary we are using. 
    # DICT_4X4_50 is good for small robots - low complexity but 50 unique IDs.
    # Note: Depending on your OpenCV version, the initialization might slightly differ.
    try:
        aruco_dict = aruco.Dictionary_get(aruco.DICT_4X4_50)
        aruco_params = aruco.DetectorParameters_create()
    except AttributeError:
        # OpenCV 4.7.0+ syntax
        aruco_dict = aruco.getPredefinedDictionary(aruco.DICT_4X4_50)
        aruco_params = aruco.DetectorParameters()
        detector = aruco.ArucoDetector(aruco_dict, aruco_params)

    # Dictionary to keep track of the previous Y position of each droid
    previous_positions = {}
    
    # Dictionary to store the last time a droid crossed the line (for cooldown)
    last_cross_time = {}
    
    # Dictionary to store the number of laps
    lap_counts = {}
    
    # Cooldown time in seconds (prevent double counting as the droid passes)
    COOLDOWN_SECONDS = 3.0

    print("Lap Counter Started. Press 'q' to quit.")

    # Variables for FPS calculation
    prev_frame_time = 0
    new_frame_time = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame")
            break

        # Calculate FPS
        new_frame_time = time.time()
        fps = 1 / (new_frame_time - prev_frame_time) if prev_frame_time > 0 else 0
        prev_frame_time = new_frame_time

        # Get frame dimensions
        height, width = frame.shape[:2]
        
        # Define the finish line Y-coordinate (middle of the screen)
        finish_line_y = height // 2
        
        # Draw the finish line on the frame (red line)
        cv2.line(frame, (0, finish_line_y), (width, finish_line_y), (0, 0, 255), 2)

        # Convert to grayscale for ArUco detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Detect markers
        try:
            corners, ids, rejectedImgPoints = aruco.detectMarkers(gray, aruco_dict, parameters=aruco_params)
        except AttributeError:
            # OpenCV 4.7.0+ syntax
            corners, ids, rejectedImgPoints = detector.detectMarkers(gray)

        if ids is not None:
            # Draw outlines around the detected markers
            aruco.drawDetectedMarkers(frame, corners, ids)

            for i, marker_id in enumerate(ids.flatten()):
                # Get the four corners of this specific marker
                marker_corners = corners[i][0]
                
                # Calculate the center (centroid) of the marker
                center_x = int(sum([c[0] for c in marker_corners]) / 4)
                center_y = int(sum([c[1] for c in marker_corners]) / 4)
                
                # Draw a dot in the center (green dot)
                cv2.circle(frame, (center_x, center_y), 5, (0, 255, 0), -1)

                current_time = time.time()
                
                # Check if this marker is in a cooldown period
                is_cooling_down = False
                if marker_id in last_cross_time:
                    if (current_time - last_cross_time[marker_id]) < COOLDOWN_SECONDS:
                        is_cooling_down = True
                
                if not is_cooling_down:
                    if marker_id in previous_positions:
                        prev_y = previous_positions[marker_id]
                        
                        # Check if it crossed the line (from either direction)
                        crossed_down = prev_y <= finish_line_y and center_y > finish_line_y
                        crossed_up = prev_y >= finish_line_y and center_y < finish_line_y
                        
                        if crossed_down or crossed_up:
                            # Lap triggered!
                            last_cross_time[marker_id] = current_time
                            
                            # Increment lap count
                            if marker_id not in lap_counts:
                                lap_counts[marker_id] = 1
                            else:
                                lap_counts[marker_id] += 1
                                
                            print(f"[{time.strftime('%H:%M:%S')}] Droid #{marker_id} crossed the line! Lap: {lap_counts[marker_id]}")
                    
                    # Update previous position
                    previous_positions[marker_id] = center_y

        # Draw Resolution and FPS on screen
        cv2.putText(frame, f"FPS: {int(fps)}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(frame, f"Res: {width}x{height}", (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2, cv2.LINE_AA)

        # Display the resulting frame
        cv2.imshow('Lap Counter PoC', frame)

        # Press 'q' to quit
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # When everything done, release the capture
    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    main()
