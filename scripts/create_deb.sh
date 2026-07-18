#!/bin/bash
set -e

# Configuration
APP_NAME="lapcounter"

# Get version from Git tag or VERSION file
if git describe --tags >/dev/null 2>&1; then
    VERSION=$(git describe --tags | sed 's/^v//' | sed 's/-/./g')
else
    VERSION=$(cat VERSION 2>/dev/null || echo "1.0.0")
fi

# Get architecture (allow override from environment)
if [ -n "$TARGET_ARCH" ]; then
    ARCH="$TARGET_ARCH"
else
    ARCH=$(dpkg --print-architecture)
fi

DEB_DIR="build/debian"
ROOT_DIR=$(pwd)

echo "--- Starting Build for ${APP_NAME}_${VERSION}_${ARCH}.deb ---"

# 1. Build Frontend
echo "Step 1: Building Frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run build
cd "$ROOT_DIR"

# 2. Prepare Directory Structure
echo "Step 2: Preparing Debian structure..."
rm -rf build/debian
mkdir -p "$DEB_DIR/DEBIAN"
mkdir -p "$DEB_DIR/opt/$APP_NAME"
mkdir -p "$DEB_DIR/etc/systemd/system"

# 3. Create Control File
echo "Step 3: Creating DEBIAN/control..."
cat <<EOF > "$DEB_DIR/DEBIAN/control"
Package: $APP_NAME
Version: $VERSION
Section: utils
Priority: optional
Architecture: $ARCH
Maintainer: Droid Builders UK <info@droidbuilders.uk>
Depends: python3, python3-venv, python3-pip, python3-dev, gcc, i2c-tools, libgl1, libglib2.0-0, v4l-utils
Description: ArUco Tag Lap Counter Pro
 A professional, high-performance lap counting and timing system 
 designed for ArUco tag tracking via computer vision. 
 Features real-time tracking, race control, and a live web dashboard.
EOF

# 4. Create Post-Install Script
echo "Step 4: Creating DEBIAN/postinst..."
cat <<EOF > "$DEB_DIR/DEBIAN/postinst"
#!/bin/bash
set -e

APP_DIR="/opt/$APP_NAME"

echo "Setting up virtual environment..."
cd "\$APP_DIR"
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

echo "Setting permissions..."
# Create user if not exists
if ! id -u $APP_NAME > /dev/null 2>&1; then
    useradd -m -r -s /bin/false $APP_NAME
fi

chown -R $APP_NAME:$APP_NAME "\$APP_DIR"
chmod -R 755 "\$APP_DIR"

echo "Reloading systemd and enabling services..."
systemctl daemon-reload
systemctl enable $APP_NAME
systemctl enable ${APP_NAME}-lcd

echo "--------------------------------------------------------"
echo "Installation Complete!"
echo "To start the services:"
echo "sudo systemctl start $APP_NAME"
echo "sudo systemctl start ${APP_NAME}-lcd"
echo "To view logs: journalctl -u $APP_NAME -f"
echo "Access the dashboard at: http://localhost:8000"
echo "--------------------------------------------------------"
EOF
chmod 755 "$DEB_DIR/DEBIAN/postinst"

# 5. Create Pre-Remove Script (Cleanup)
echo "Step 5: Creating DEBIAN/prerm..."
cat <<EOF > "$DEB_DIR/DEBIAN/prerm"
#!/bin/bash
set -e
echo "Stopping $APP_NAME services..."
systemctl stop $APP_NAME || true
systemctl disable $APP_NAME || true
systemctl stop ${APP_NAME}-lcd || true
systemctl disable ${APP_NAME}-lcd || true
EOF
chmod 755 "$DEB_DIR/DEBIAN/prerm"

# 6. Copy Application Files
echo "Step 6: Copying application files..."
cp -r backend "$DEB_DIR/opt/$APP_NAME/"
mkdir -p "$DEB_DIR/opt/$APP_NAME/frontend"
cp -r frontend/dist "$DEB_DIR/opt/$APP_NAME/frontend/"
cp requirements.txt "$DEB_DIR/opt/$APP_NAME/"

# 7. Create Systemd Service File
echo "Step 7: Creating systemd service..."
cat <<EOF > "$DEB_DIR/etc/systemd/system/$APP_NAME.service"
[Unit]
Description=LapCounter Pro Service
After=network.target

[Service]
User=$APP_NAME
Group=$APP_NAME
WorkingDirectory=/opt/$APP_NAME
Environment="PATH=/opt/$APP_NAME/.venv/bin"
ExecStart=/opt/$APP_NAME/.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

cat <<EOF > "$DEB_DIR/etc/systemd/system/${APP_NAME}-lcd.service"
[Unit]
Description=LapCounter Pro LCD Menu Service
After=network.target lapcounter.service

[Service]
User=$APP_NAME
Group=$APP_NAME
WorkingDirectory=/opt/$APP_NAME
Environment="PATH=/opt/$APP_NAME/.venv/bin"
ExecStart=/opt/$APP_NAME/.venv/bin/python3 backend/lcd_menu.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 8. Build the Package
echo "Step 8: Finalizing .deb package..."
dpkg-deb --build "$DEB_DIR" "${APP_NAME}_${VERSION}_${ARCH}.deb"

echo "--- Build Finished Successully! ---"
ls -lh "${APP_NAME}_${VERSION}_${ARCH}.deb"
