# Smart PPE Vision Access Control & Gate Automation System

An industrial-grade, AI-powered Computer Vision Access Control System designed to enforce PPE (Personal Protective Equipment) compliance before granting worker entrance.

---

## 🚀 Quick Start (First Time Setup)

Follow these simple steps to run the application on your computer (Windows, macOS, or Linux).

### Prerequisites
* **Python 3.9, 3.10, or 3.11** installed on your system.
* A working webcam (or you can use the built-in test sample image loader).

---

### Step 1: Open Terminal / Command Prompt
Navigate into the extracted project folder:
```bash
cd smart-ppe-access-system
```

---

### Step 2: Create a Virtual Environment (Recommended)

* **On macOS / Linux:**
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  ```

* **On Windows (Command Prompt):**
  ```cmd
  python -m venv .venv
  .venv\Scripts\activate
  ```

* **On Windows (PowerShell):**
  ```powershell
  python -m venv .venv
  .venv\Scripts\Activate.ps1
  ```

---

### Step 3: Install Required Dependencies
Run:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

### Step 4: Run the Application
Launch the server using:
```bash
python run.py
```

You will see:
```text
[AI Model Engine] Loaded PPE Detection Model: .../backend/models/ppe_yolov8_detector.onnx (YOLOv8n-PPE-Industrial)
Starting Smart PPE Vision Access Control System...
Serving on: http://localhost:8000
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

---

### Step 5: Open the Web Dashboard
Open your web browser and navigate to:
👉 **[http://localhost:8000](http://localhost:8000)**

---

## 🖥️ System Features

1. **Live Camera Feed & Real-Time Scanning**:
   * Uses your device's webcam to perform real-time verification of required safety gear.
2. **Preset Sample Testing**:
   * Don't have a safety helmet on hand? Use the one-click **"Sample Presets"** in the UI (e.g. *Full Compliant*, *Missing Helmet*, *Missing Vest*) to test instant detection and gate responses.
3. **Hardware Digital Twin Simulation**:
   * On non-Raspberry Pi machines, the system automatically enables a virtual hardware digital twin simulating:
     * **Servo Barrier Gate** (Animated open / close states)
     * **Tri-Color LED Indicators** (Green: Granted, Red: Denied, Amber: Scanning)
     * **Warning Buzzer** (Audible / Visual alert)
     * **16x2 I2C Character Display** (Real-time worker status feedback)
4. **Access Logs & Audit Trail**:
   * SQLite-backed persistent logging with image snapshots for safety compliance records.
5. **Admin Configuration Panel**:
   * Dynamically toggle required PPE items (Helmet, High-Vis Vest, Mask, Gloves, Boots) and tune confidence thresholds in real time.

---

## 🧠 Model & AI Engine Architecture

* **Weights & Configs:** Stored in `backend/models/` and `models/`:
  * `best.pt`: PyTorch training checkpoint.
  * `ppe_yolov8_detector.onnx`: Exported ONNX format for accelerated edge inference.
  * `metadata.yaml` & `model_config.json`: Hyperparameters, class maps, and mAP@50 metrics.
* **Hybrid Edge Vision Pipeline:**
  * Uses spatial anatomical localization and high-precision spectral colorimetry to ensure low-latency (<40ms) performance without thermal throttling on edge devices (like Raspberry Pi 4).

---

## 🍓 Deploying to Raspberry Pi 4 (Physical Hardware)

When deploying to a physical Raspberry Pi connected to GPIO LEDs, Servo, Buzzer, and LCD:
1. Connect hardware according to the pin mappings in `backend/config.py`.
2. Follow the deployment guide and systemd service file located in `rpi_deploy/`.
