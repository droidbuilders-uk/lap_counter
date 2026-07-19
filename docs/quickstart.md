# LapCounter Pro - Quickstart Guide

This guide will get you up and running with a race as quickly as possible.

## 1. Power On
*(Prerequisite: Make sure your Raspberry Pi has been configured to connect to your local WiFi network. You can set this up using the official Raspberry Pi Imager tool before putting the SD card in.)*

Plug the power cable into the Raspberry Pi. The DFRobot LCD screen on top will light up automatically and cycle through the system status pages every 8 seconds. 
Once the **Race Status** page shows the system is running, check the **WiFi Network** and **IP Address** pages.

## 2. Connect to the Web Dashboard
Using a laptop, tablet, or phone connected to the **same WiFi network** as the Pi, open a web browser.
Look at the LCD screen to find the **IP Address** (it will look something like `192.168.1.100`). Type that IP address into your browser's address bar, followed by `:8000`. 
Example: `http://192.168.1.100:8000`

## 3. Configure the System (Settings)
Before racing, you must tell the system how you plan to track the droids:
1. Navigate to the **Settings** tab in the top navigation bar.
2. Select your **Tracking Method**:
   - **ArUco Tags (Camera)**: Uses a USB camera connected to the Pi to read visual QR-like codes. You can select which camera to use.
   - **IR Transponders (Serial)**: Uses the custom ATtiny IR chips and the ESP32 Sensor Bar. (Recommended for high-speed racing).
3. **Advanced Settings**: You can adjust the "Minimum Lap Time" to prevent double-counting if a droid gets stuck on the finish line, and fine-tune the "Debounce" settings to filter out noisy sensor readings.
4. **Hardware Programming**: If you are using IR Transponders, you can actually plug the ESP32 or the ATtiny programmer directly into the Raspberry Pi's USB port and click the "Flash" buttons here to automatically program them!

## 4. Register Droids
1. Navigate to the **Droids** tab in the top navigation bar.
2. Click **Add Droid**.
3. Enter the name of the driver/droid and assign them a Transponder ID. (The Transponder ID must match the hardcoded ID flashed to their ATtiny chip, e.g., `42`).

## 5. Setup a Race
1. Navigate to the **Races** tab.
2. Click **Create New Race**.
3. Give the race a name and select all the participating Droids from the dropdown list.
4. Click **Start Race**.

## 6. Racing!
Once the race is started, any IR transponders that cross the Sensor Bar will automatically log a lap. The dashboard will update in real-time, showing the current leaderboard, fastest laps, and time gaps.
