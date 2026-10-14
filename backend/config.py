import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
CAPTURES_DIR = DATA_DIR / "captures"
SAMPLES_DIR = BASE_DIR / "tests" / "sample_images"
MODELS_DIR = BASE_DIR / "backend" / "models"
MODEL_PATH = MODELS_DIR / "ppe_yolov8_detector.onnx"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
CAPTURES_DIR.mkdir(parents=True, exist_ok=True)
SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Required PPE items for access grant (Prioritizing Helmet & High-Vis Vest)
DEFAULT_REQUIRED_PPE = ["helmet", "vest"]

# Confidence thresholds (0.0 to 1.0)
DEFAULT_THRESHOLDS = {
    "helmet": 0.60,
    "vest": 0.60,
    "mask": 0.55,
    "gloves": 0.55,
    "shoes": 0.55,
}

# Barrier gate timing
GATE_OPEN_DURATION_SECONDS = 5.0

# Hardware GPIO configuration for Raspberry Pi 4 (BCM numbering)
RPI_CONFIG = {
    "GREEN_LED_PIN": 17,
    "RED_LED_PIN": 27,
    "BUZZER_PIN": 22,
    "SERVO_PIN": 18,        # Hardware PWM pin on Pi 4
    "SERVO_FREQUENCY": 50,  # 50Hz for SG90 / MG996R servo
    "SERVO_MIN_DUTY": 2.5,  # 0 degrees (Closed)
    "SERVO_MAX_DUTY": 12.5, # 90-180 degrees (Open)
    "LCD_I2C_BUS": 1,
    "LCD_I2C_ADDR": 0x27,   # Common PCF8574 backpack address (or 0x3F)
    "LCD_COLS": 16,
    "LCD_ROWS": 2,
}

# Firebase Configuration
FIREBASE_CONFIG = {
    "apiKey": "AIzaSyB2WHY2BlNODgMABHErbER5NuB9CKGgsHc",
    "authDomain": "ppe-detector-c3835.firebaseapp.com",
    "databaseURL": "https://ppe-detector-c3835-default-rtdb.firebaseio.com",
    "projectId": "ppe-detector-c3835",
    "storageBucket": "ppe-detector-c3835.firebasestorage.app",
    "messagingSenderId": "401231291518",
    "appId": "1:401231291518:web:0197cc627ea5c1b9efe42f",
}
FIREBASE_DATABASE_URL = FIREBASE_CONFIG["databaseURL"]
