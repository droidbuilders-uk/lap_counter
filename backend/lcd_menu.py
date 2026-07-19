import os
import subprocess
import sys
import time

import requests
import RPi.GPIO as GPIO

# Ensure the backend directory is in the path so we can import rgb1602
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    import rgb1602
except ImportError:
    print("Error: Could not import rgb1602. Ensure smbus is installed.")
    sys.exit(1)

# Setup LCD
lcd = rgb1602.RGB1602(16, 2)
lcd.setRGB(0, 128, 64) # Default green background

# Setup Buttons (BCM Numbering for DFRobot HAT)
BTN_UP = 17
BTN_DOWN = 18
BTN_SELECT = 16

GPIO.setmode(GPIO.BCM)
GPIO.setup(BTN_UP, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)
GPIO.setup(BTN_DOWN, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)
GPIO.setup(BTN_SELECT, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)

# --- Info Gathering Functions ---
def get_ip():
    try:
        # Gets the primary IP
        ip = subprocess.check_output(['/usr/bin/hostname', '-I']).decode('utf-8').split()[0]
        return f"IP Address:\n{ip}"
    except:
        return "IP Address:\nOffline"

def get_wifi():
    try:
        ssid = subprocess.check_output(['/usr/sbin/iwgetid', '-r']).decode('utf-8').strip()
        if not ssid:
            return "WiFi Network:\nDisconnected"
        return f"WiFi Network:\n{ssid}"
    except:
        return "WiFi Network:\nDisconnected"

def get_race_status():
    try:
        res = requests.get('http://localhost:8000/api/races/active', timeout=1).json()
        if res and res.get('race', {}).get('status') == 'active':
            return f"Race: {res['race']['name'][:10]}\nStatus: LIVE"
        return "LapCounter Pro\nStatus: Idle"
    except:
        return "LapCounter Pro\nBackend Offline"

def get_system_temp():
    try:
        temp = subprocess.check_output(['/usr/bin/vcgencmd', 'measure_temp']).decode('utf-8').strip()
        temp = temp.replace("temp=", "").replace("'C", " C")
        return f"System Temp:\n{temp}"
    except:
        return "System Temp:\nUnknown"

# --- Menu System ---
menu_pages = [get_race_status, get_ip, get_wifi, get_system_temp]
current_page = 0
last_text = ""

def update_display(force=False):
    """Clears and draws the current page only if it changed"""
    global last_text

    text = menu_pages[current_page]()

    if text == last_text and not force:
        return

    last_text = text
    lcd.clear()

    lines = text.split('\n')

    # Print Line 1
    lcd.setCursor(0, 0)
    lcd.printout(lines[0])

    # Print Line 2
    if len(lines) > 1:
        lcd.setCursor(0, 1)
        lcd.printout(lines[1])

if __name__ == "__main__":
    # Initial draw
    update_display()

    print("LCD Menu Running...")
    try:
        last_interaction = time.time()
        while True:
            # DFRobot buttons are Active High (pull to 3.3V when pressed)
            if GPIO.input(BTN_UP) == 1:
                current_page = (current_page - 1) % len(menu_pages)
                update_display(force=True)
                last_interaction = time.time()
                time.sleep(0.3) # Debounce

            elif GPIO.input(BTN_DOWN) == 1:
                current_page = (current_page + 1) % len(menu_pages)
                update_display(force=True)
                last_interaction = time.time()
                time.sleep(0.3) # Debounce

            # Auto-scroll pages every 8 seconds if no buttons are pressed
            if time.time() - last_interaction > 8.0:
                current_page = (current_page + 1) % len(menu_pages)
                update_display(force=True)
                last_interaction = time.time()

            # Refresh the current page gracefully if data changed natively
            update_display(force=False)

            time.sleep(0.1)

    except KeyboardInterrupt:
        pass
    finally:
        lcd.clear()
        lcd.setRGB(0, 0, 0)
        GPIO.cleanup()
