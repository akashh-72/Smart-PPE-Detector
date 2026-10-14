# Raspberry Pi 4 AI PPE Verification & Access Control System
## Complete Hardware Interconnect, Schematic & Pinout Guide

This guide details how to wire and configure all physical hardware components when deploying the system on the Raspberry Pi 4 Model B, matching the architecture in Fig 1, 2, and 3.

---

### 1. Hardware Bill of Materials (BOM)

| Item | Component | Specification | Quantity |
| :--- | :--- | :--- | :--- |
| 1 | **Single Board Computer** | Raspberry Pi 4 Model B (4GB or 8GB recommended) | 1 |
| 2 | **Camera Module** | Raspberry Pi Camera Module v2 / v3 (CSI Ribbon) or USB 1080p WebCam | 1 |
| 3 | **Display Module** | 1602 (16×2) Character LCD with PCF8574 I2C Backpack | 1 |
| 4 | **Stack Indicator LEDs** | 1× Green LED (5mm/10mm), 1× Red LED (5mm/10mm) | 1 each |
| 5 | **LED Resistors** | 220Ω or 330Ω 1/4W Current Limiting Resistors | 2 |
| 6 | **Audio Alert** | 5V Piezoelectric Active Buzzer | 1 |
| 7 | **Buzzer Driver** | 2N2222 NPN Transistor + 1kΩ base resistor | 1 |
| 8 | **Barrier Servo Motor** | TowerPro SG90 (Micro) or MG996R (Metal Gear for heavier boom) | 1 |
| 9 | **External Power Supply** | 5V 3A (for Raspberry Pi via USB-C) + 5V 2A (for Servo) | 2 |
| 10 | **Prototyping / Housing** | Breadboard or custom PCB + Jumper Wires + Acrylic Enclosure | 1 |

---

### 2. Raspberry Pi 4 GPIO Pinout Table

All pin references follow the **BCM (Broadcom) GPIO numbering**, which is directly mapped in `backend/config.py`:

```
Raspberry Pi 4 40-Pin Header
======================================================
  3.3V Power [Pin 1]   ( ) ( ) [Pin 2]   5.0V Power (VCC)
GPIO 2 (SDA) [Pin 3]   ( ) ( ) [Pin 4]   5.0V Power
GPIO 3 (SCL) [Pin 5]   ( ) ( ) [Pin 6]   Ground (GND)
      GPIO 4 [Pin 7]   ( ) ( ) [Pin 8]   GPIO 14 (TXD)
Ground (GND) [Pin 9]   ( ) ( ) [Pin 10]  GPIO 15 (RXD)
GPIO 17 (GRN)[Pin 11]  ( ) ( ) [Pin 12]  GPIO 18 (PWM SERVO)
GPIO 27 (RED)[Pin 13]  ( ) ( ) [Pin 14]  Ground (GND)
GPIO 22 (BUZ)[Pin 15]  ( ) ( ) [Pin 16]  GPIO 23
======================================================
```

#### Detailed Pin Connection Mapping

| Component | Component Pin | Connects to Raspberry Pi Pin | Description |
| :--- | :--- | :--- | :--- |
| **16×2 LCD (I2C)** | **GND** | **Pin 6, 9, 14, or 20 (GND)** | Common Ground |
| | **VCC** | **Pin 2 or 4 (5V)** | LCD Backlight & Logic Power |
| | **SDA** | **Pin 3 (GPIO 2 / SDA)** | I2C Serial Data line |
| | **SCL** | **Pin 5 (GPIO 3 / SCL)** | I2C Serial Clock line |
| **Green LED** | **Anode (+)** | **Pin 11 (GPIO 17)** via 220Ω resistor | High = Green LED ON (Access Granted) |
| | **Cathode (-)** | **Pin 9 or 14 (GND)** | Ground |
| **Red LED** | **Anode (+)** | **Pin 13 (GPIO 27)** via 220Ω resistor | High = Red LED ON (Access Denied) |
| | **Cathode (-)** | **Pin 14 (GND)** | Ground |
| **Active Buzzer** | **Collector (2N2222)** | **Buzzer (-)**, Buzzer (+) to 5V | Transistor switched 5V buzzer driver |
| | **Base (2N2222)** | **Pin 15 (GPIO 22)** via 1kΩ resistor | High = Buzzer Alarm sounds |
| | **Emitter (2N2222)** | **Pin 14 (GND)** | Ground |
| **Servo Motor** | **PWM Signal (Orange/Yellow)** | **Pin 12 (GPIO 18 / PWM0)** | Hardware PWM signal (0° to 90°) |
| | **VCC (Red)** | **External 5V (+)** | *Do NOT power servo directly from 3.3V!* |
| | **GND (Brown/Black)** | **External 5V (-) & RPi GND (Pin 6/14)** | **CRITICAL: Shared Common Ground!** |

---

### 3. Circuit Schematic Overview

```
                      +-----------------------------+
                      |       Raspberry Pi 4        |
                      |                             |
                      |  [Pin 3: GPIO 2 SDA] ------>|-----> 16x2 LCD (SDA)
                      |  [Pin 5: GPIO 3 SCL] ------>|-----> 16x2 LCD (SCL)
                      |  [Pin 2: 5V Power]   ------>|-----> 16x2 LCD (VCC)
                      |                             |
                      |  [Pin 11: GPIO 17] ---------> [220Ω] ---> (Green LED) ---> GND
                      |  [Pin 13: GPIO 27] ---------> [220Ω] ---> (Red LED)   ---> GND
                      |                             |
                      |  [Pin 15: GPIO 22] ---------> [1kΩ] ----> [Base: 2N2222]
                      |                             |                 |
                      |                             |            (Buzzer to 5V)
                      |                             |
                      |  [Pin 12: GPIO 18 PWM] ----> Servo Signal (Orange Wire)
                      |                             |
                      |  [Pin 6: GND] -------------> COMMON GND (RPi + Servo + 5V PS)
                      |                             |
                      |  [CSI Camera Port] --------> 15-pin Ribbon to Pi Camera
                      +-----------------------------+
```

---

### 4. Software Auto-Detection

The code in `backend/hardware_controller.py` automatically detects when `RPi.GPIO` is available on the system:
- **On PC / Mac / Development Laptop:** The system runs in **Digital Twin Simulator Mode**, updating the UI virtual 16x2 LCD, LEDs, and 3D animated barrier gate without any hardware required.
- **On Physical Raspberry Pi:** Once booted on the Pi, it automatically binds to the GPIO pins, driving the real hardware barrier arm, tower light, buzzer, and I2C LCD!
