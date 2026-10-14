#!/bin/bash
# ==============================================================================
# One-Click Deployment Script for Raspberry Pi 4 Model B
# AI PPE Verification & Access Control Gateway
# ==============================================================================

set -e

echo "=================================================================="
echo " Starting Smart PPE Access System Deployment on Raspberry Pi 4..."
echo "=================================================================="

# 1. Update APT and install system dependencies
echo "[1/5] Installing system packages & hardware interfaces..."
sudo apt-get update
sudo apt-get install -y \
    python3-pip \
    python3-dev \
    python3-venv \
    i2c-tools \
    python3-smbus \
    libatlas-base-dev \
    libcamera-dev \
    v4l-utils

# 2. Enable Hardware Interfaces (I2C and Camera)
echo "[2/5] Enabling I2C and Camera in Raspberry Pi configuration..."
sudo raspi-config nonint do_i2c 0 || true
sudo raspi-config nonint do_camera 0 || true

# Check I2C detection for LCD backpack (typically address 0x27 or 0x3f)
echo "Checking I2C devices on bus 1:"
i2cdetect -y 1 || true

# 3. Create Virtual Environment
echo "[3/5] Setting up Python virtual environment..."
cd "$(dirname "$0")/.."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

# 4. Install Python Dependencies
echo "[4/5] Installing Python modules..."
./venv/bin/pip install --upgrade pip setuptools wheel
./venv/bin/pip install -r rpi_deploy/requirements-rpi.txt

# 5. Configure systemd Service for Auto-start on Boot
echo "[5/5] Configuring systemd background service..."
SERVICE_FILE="/etc/systemd/system/ppe_system.service"
CURRENT_DIR=$(pwd)
CURRENT_USER=$(whoami)

sudo cp rpi_deploy/ppe_system.service $SERVICE_FILE
sudo sed -i "s|{{APP_DIR}}|$CURRENT_DIR|g" $SERVICE_FILE
sudo sed -i "s|{{APP_USER}}|$CURRENT_USER|g" $SERVICE_FILE

sudo systemctl daemon-reload
sudo systemctl enable ppe_system.service
sudo systemctl restart ppe_system.service

echo "=================================================================="
echo " Deployment Complete!"
echo " The AI PPE Verification System is now running on Raspberry Pi."
echo " Status: sudo systemctl status ppe_system.service"
echo " Dashboard URL: http://$(hostname -I | awk '{print $1}'):8000"
echo "=================================================================="
