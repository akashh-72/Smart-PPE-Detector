# Arduino & 16x2 I2C LCD Hardware Gateway

Connect your physical **Arduino Uno** and **16x2 I2C LCD display** to the **SafeGuard AI Smart PPE Access System**.

---

### 1. Hardware Connections (Arduino Uno)

| LCD I2C Pin | Arduino Uno Pin | Purpose |
| :--- | :--- | :--- |
| **GND** | **GND** | Power Ground |
| **VCC** | **5V** | 5V Power Supply |
| **SDA** | **A4** (or SDA near AREF) | I2C Data Line |
| **SCL** | **A5** (or SCL near AREF) | I2C Clock Line |

#### Optional Actuators:
| Component | Arduino Pin | Behavior |
| :--- | :--- | :--- |
| **Green LED** | **Pin 6** | Lights on ACCESS ALLOWED |
| **Red LED** | **Pin 7** | Lights on ACCESS DENIED |
| **Piezo Buzzer** | **Pin 8** | Double chime on Allow, long warning alarm on Deny |
| **SG90 Servo** | **Pin 9** | Opens 90° on Allow, closes 0° on Deny |

---

### 2. IMPORTANT: Display Contrast Potentiometer
If your LCD backlight turns on but:
- The screen is **completely blank**, OR
- The screen shows **solid dark/white rectangular blocks**:

**Fix**: Take a small flathead or Phillips screwdriver and gently rotate the **blue potentiometer trimmer** on the back of the black I2C backpack board until the text letters appear crisp and high-contrast!

---

### 3. Step-by-Step Arduino Setup

1. Open **[smart_ppe_access.ino](smart_ppe_access/smart_ppe_access.ino)** in the **Arduino IDE**.
2. Install the **LiquidCrystal I2C** library:
   - Go to **Sketch** -> **Include Library** -> **Manage Libraries...**
   - Search for `LiquidCrystal I2C` (by *Frank de Brabander* or *Marco Schwartz*) and click **Install**.
3. In **Tools** -> **Board**, select **Arduino Uno**.
4. In **Tools** -> **Port**, select your port:
   - macOS: `/dev/cu.usbserial-XXXX` (CH340 chip) or `/dev/cu.usbmodemXXXX` (Original Uno)
   - Windows: `COM3`, `COM4`, etc.
   - Linux: `/dev/ttyUSB0` or `/dev/ttyACM0`
5. Click **Upload** (Arrow icon).

---

### 4. What Appears On The 16x2 Screen

- **Boot Test**:
  ```text
  SAFEGUARD AI
  ARDUINO READY
  ```
  *(Backlight blinks once as confirmation)*

- **Standby Mode**:
  ```text
  SAFEGUARD AI
  WELCOME - SCAN
  ```

- **When Scan is Compliant (Allowed)**:
  ```text
  ACCESS ALLOWED
  WELCOME WORKER
  ```

- **When Scan has Missing Items (Denied)**:
  ```text
  ACCESS DENIED
  NO: HELMET, VEST
  ```

---

### 5. Troubleshooting Checklist

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| Screen backlight is ON, but no letters visible | Contrast potentiometer not set | Rotate the blue trimmer screw on the back of the LCD backpack |
| Screen completely unlit | VCC/GND loose or reversed | Connect VCC to 5V and GND to GND on Uno |
| Serial port not found in Python | System python missing `pyserial` | Use `hardware_controller.py`'s automatic `.venv` loader or run using `.venv/bin/python` |
| LCD shows wrong characters | I2C address mismatch | The upgraded sketch automatically detects `0x27` and `0x3F` |
