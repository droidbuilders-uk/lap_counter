# Software Installation

LapCounter Pro is distributed as a pre-packaged Debian (`.deb`) file for easy deployment on a Raspberry Pi.

## 1. Prerequisites
- A Raspberry Pi running Raspberry Pi OS (Bullseye or Bookworm).
- You need to enable "I2C" so the Pi can talk to the LCD screen:
  1. Open a terminal window on the Pi (or connect via SSH).
  2. Type `sudo raspi-config` and press Enter.
  3. Use the arrow keys to select **Interface Options**, then **I2C**, and select **Yes** to enable it.
  4. Select **Finish** to exit.

## 2. Installing from the Repository (Recommended)
LapCounter Pro has a dedicated APT repository hosted on GitHub Pages. This is the easiest way to install the software because it will automatically handle future updates for you.

Open a terminal on your Raspberry Pi and paste these three commands exactly as written:
```bash
echo "deb [trusted=yes arch=amd64,arm64] https://droidbuilders-uk.github.io/lap_counter/ stable main" | sudo tee /etc/apt/sources.list.d/lapcounter.list
sudo apt-get update
sudo apt-get install lapcounter
```

The installer automatically sets up a virtual environment in `/opt/lapcounter`, installs all Python dependencies, and configures the systemd services.

## 3. Offline Installation (Manual)
If your Pi is not connected to the internet, you can copy the `.deb` file directly to it:
```bash
sudo apt-get install -f ./lapcounter_*.deb
```

## 4. Managing Services
The system runs entirely in the background. You can check the status or restart the services using standard `systemctl` commands:
```bash
sudo systemctl status lapcounter
sudo systemctl status lapcounter-lcd
```

## 5. Updates
To update the software, simply build a new `.deb` file on your development machine using `scripts/create_deb.sh`, copy it to the Pi, and run the `apt-get install` command again. It will automatically stop the services, upgrade the files, and restart them.
