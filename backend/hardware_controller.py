import sys
import time
import asyncio
import threading
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable, Tuple

# Automatically load virtual environment packages (such as pyserial)
# even when the user runs backend via system Python3
_root_dir = Path(__file__).resolve().parent.parent
for _venv_site in (_root_dir / ".venv").glob("lib/python*/site-packages"):
    if str(_venv_site) not in sys.path:
        sys.path.insert(0, str(_venv_site))

from config import RPI_CONFIG, GATE_OPEN_DURATION_SECONDS

# Check if running on actual Raspberry Pi with GPIO support
try:
    import RPi.GPIO as GPIO  # type: ignore
    HAS_RPI_GPIO = True
except ImportError:
    HAS_RPI_GPIO = False


class BaseHardwareController:
    """Base interface for hardware interactions."""
    def __init__(self):
        self.mode = "base"
        self.listeners: List[Callable[[Dict[str, Any]], None]] = []

    def subscribe(self, callback: Callable[[Dict[str, Any]], None]):
        self.listeners.append(callback)

    def notify(self, event: Dict[str, Any]):
        for cb in self.listeners:
            try:
                cb(event)
            except Exception as e:
                print(f"Listener error: {e}")

    def grant_access(self, worker_name: str = "WORKER", cause: str = "WELCOME", callback_after_close: Optional[Callable] = None):
        raise NotImplementedError

    def deny_access(self, missing_items: Optional[List[str]] = None, cause: str = ""):
        raise NotImplementedError

    def reset_standby(self):
        raise NotImplementedError

    def display_custom_lcd(self, line1: str, line2: str = ""):
        pass

    def get_available_ports(self) -> Dict[str, Any]:
        return {"ports": [], "current_port": None, "connected": False, "baudrate": 9600}

    def connect_port(self, port: Optional[str] = None, baudrate: int = 9600) -> Tuple[bool, str]:
        return False, "Not supported"

    def get_state(self) -> Dict[str, Any]:
        raise NotImplementedError


class VirtualHardwareSimulator(BaseHardwareController):
    """
    Digital Twin / Virtual Hardware Simulator.
    Simulates:
      - 16x2 LCD display (with backlight color and text lines)
      - Tower LED lights (Red & Green)
      - Piezoelectric Buzzer
      - Servo-driven Barrier Gate (0 deg Closed, 90 deg Open)
    Emits real-time state updates to the UI.
    """
    def __init__(self):
        super().__init__()
        self.mode = "simulator"
        self._gate_angle = 0
        self._gate_state = "CLOSED"
        self._green_led = False
        self._red_led = False
        self._buzzer_active = False
        self._buzzer_pattern = "off"
        self._lcd_line1 = "SAFEGUARD AI"
        self._lcd_line2 = "WELCOME - SCAN"
        self._lcd_backlight = "blue"  # blue (standby), green (granted), red (denied)
        self._timer_task = None
        self._lock = threading.RLock()

    @property
    def is_serial_connected(self) -> bool:
        return False

    def get_state(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "hardware_mode": getattr(self, "mode", "simulator"),
                "serial_connected": getattr(self, "is_serial_connected", False),
                "serial_port": getattr(self, "port", None),
                "gate": {
                    "state": self._gate_state,
                    "angle": self._gate_angle,
                },
                "led": {
                    "green": self._green_led,
                    "red": self._red_led,
                },
                "leds": {
                    "green": self._green_led,
                    "red": self._red_led,
                    "amber": not (self._green_led or self._red_led),
                },
                "buzzer": {
                    "active": self._buzzer_active,
                    "pattern": self._buzzer_pattern,
                },
                "lcd": {
                    "line1": self._lcd_line1,
                    "line2": self._lcd_line2,
                    "backlight": self._lcd_backlight,
                },
                "timestamp": time.time(),
            }

    def _emit_state(self, event_type: str = "STATE_UPDATE"):
        state = self.get_state()
        state["event_type"] = event_type
        # Run notify in a non-blocking thread so callers never block or hang on slow listeners
        threading.Thread(target=self.notify, args=(state,), daemon=True).start()

    def grant_access(self, worker_name: str = "", cause: str = "WELCOME", callback_after_close: Optional[Callable] = None):
        welcome_text = "WELCOME"
        with self._lock:
            self._gate_state = "OPENING"
            self._gate_angle = 90
            self._green_led = True
            self._red_led = False
            self._buzzer_active = False
            self._buzzer_pattern = "chime"
            self._lcd_line1 = "ACCESS ALLOWED"
            self._lcd_line2 = welcome_text
            self._lcd_backlight = "green"
        self._emit_state("ACCESS_GRANTED")

        # Background thread to animate gate and auto-close after duration
        def auto_close_routine():
            time.sleep(0.3)
            with self._lock:
                self._gate_state = "OPEN"
                self._buzzer_active = False
            self._emit_state("GATE_OPEN")
            
            time.sleep(GATE_OPEN_DURATION_SECONDS)

            with self._lock:
                self._gate_state = "CLOSING"
                self._gate_angle = 0
            self._emit_state("GATE_CLOSING")

            time.sleep(0.4)
            with self._lock:
                self._gate_state = "CLOSED"
                self._green_led = False
                self._lcd_line1 = "SAFEGUARD AI"
                self._lcd_line2 = "WELCOME - SCAN"
                self._lcd_backlight = "blue"
            self._emit_state("SYSTEM_STANDBY")
            
            if callback_after_close:
                callback_after_close()

        threading.Thread(target=auto_close_routine, daemon=True).start()

    def deny_access(self, missing_items: Optional[List[str]] = None, cause: str = ""):
        if not cause:
            missing_str = ", ".join(missing_items).upper() if missing_items else "PPE INCOMPLETE"
            cause = f"NO: {missing_str}"
        if len(cause) > 16:
            cause = cause[:16]

        with self._lock:
            self._gate_state = "CLOSED"
            self._gate_angle = 0
            self._green_led = False
            self._red_led = True
            self._buzzer_active = True
            self._buzzer_pattern = "alarm"
            self._lcd_line1 = "ACCESS DENIED"
            self._lcd_line2 = cause
            self._lcd_backlight = "red"
        self._emit_state("ACCESS_DENIED")

        def silence_buzzer_routine():
            time.sleep(2.0)
            with self._lock:
                self._buzzer_active = False
            self._emit_state("BUZZER_SILENCED")
            
            time.sleep(2.0)
            with self._lock:
                self._red_led = False
                self._lcd_line1 = "SAFEGUARD AI"
                self._lcd_line2 = "WELCOME - SCAN"
                self._lcd_backlight = "blue"
            self._emit_state("SYSTEM_STANDBY")

        threading.Thread(target=silence_buzzer_routine, daemon=True).start()

    def reset_standby(self):
        with self._lock:
            self._gate_state = "CLOSED"
            self._gate_angle = 0
            self._green_led = False
            self._red_led = False
            self._buzzer_active = False
            self._buzzer_pattern = "off"
            self._lcd_line1 = "SAFEGUARD AI"
            self._lcd_line2 = "WELCOME - SCAN"
            self._lcd_backlight = "blue"
        self._emit_state("SYSTEM_STANDBY")

    def display_custom_lcd(self, line1: str, line2: str = ""):
        with self._lock:
            self._lcd_line1 = (line1 or "")[:16]
            self._lcd_line2 = (line2 or "")[:16]
        self._emit_state("CUSTOM_LCD")


class RaspberryPiHardwareController(BaseHardwareController):
    """
    Physical Raspberry Pi 4 Hardware Controller.
    Interacts directly with:
      - I2C 16x2 LCD display
      - GPIO Green & Red LEDs
      - GPIO Buzzer (Active or PWM passive)
      - GPIO 18 Hardware PWM Servo Motor
    """
    def __init__(self):
        super().__init__()
        self.mode = "raspberry_pi"
        self._init_gpio()

    def _init_gpio(self):
        try:
            GPIO.setmode(GPIO.BCM)
            GPIO.setwarnings(False)

            self.green_pin = RPI_CONFIG["GREEN_LED_PIN"]
            self.red_pin = RPI_CONFIG["RED_LED_PIN"]
            self.buzzer_pin = RPI_CONFIG["BUZZER_PIN"]
            self.servo_pin = RPI_CONFIG["SERVO_PIN"]

            GPIO.setup(self.green_pin, GPIO.OUT, initial=GPIO.LOW)
            GPIO.setup(self.red_pin, GPIO.OUT, initial=GPIO.LOW)
            GPIO.setup(self.buzzer_pin, GPIO.OUT, initial=GPIO.LOW)
            GPIO.setup(self.servo_pin, GPIO.OUT)

            self.servo_pwm = GPIO.PWM(self.servo_pin, RPI_CONFIG["SERVO_FREQUENCY"])
            self.servo_pwm.start(RPI_CONFIG["SERVO_MIN_DUTY"])  # 0 deg (Closed)

            self._init_lcd()
            self.reset_standby()
        except Exception as e:
            print(f"Warning: RPi GPIO init encountered error: {e}")

    def _init_lcd(self):
        try:
            import smbus2  # type: ignore
            self.i2c_bus = smbus2.SMBus(RPI_CONFIG["LCD_I2C_BUS"])
            self.lcd_addr = RPI_CONFIG["LCD_I2C_ADDR"]
        except Exception:
            self.i2c_bus = None

    def _set_servo_angle(self, angle: int):
        duty = 2.5 + (angle / 180.0) * 10.0
        self.servo_pwm.ChangeDutyCycle(duty)
        time.sleep(0.3)
        self.servo_pwm.ChangeDutyCycle(0)

    def _write_lcd(self, line1: str, line2: str):
        l1 = line1[:16].ljust(16)
        l2 = line2[:16].ljust(16)
        print(f"[RPI LCD] |{l1}| / |{l2}|")

    def grant_access(self, worker_name: str = "", cause: str = "WELCOME", callback_after_close: Optional[Callable] = None):
        GPIO.output(self.green_pin, GPIO.HIGH)
        GPIO.output(self.red_pin, GPIO.LOW)
        GPIO.output(self.buzzer_pin, GPIO.LOW)
        self._write_lcd("ACCESS ALLOWED", "WELCOME")
        self._set_servo_angle(90)

        def auto_close():
            time.sleep(GATE_OPEN_DURATION_SECONDS)
            self._set_servo_angle(0)
            GPIO.output(self.green_pin, GPIO.LOW)
            self.reset_standby()
            if callback_after_close:
                callback_after_close()

        threading.Thread(target=auto_close, daemon=True).start()

    def deny_access(self, missing_items: Optional[List[str]] = None, cause: str = ""):
        GPIO.output(self.green_pin, GPIO.LOW)
        GPIO.output(self.red_pin, GPIO.HIGH)
        GPIO.output(self.buzzer_pin, GPIO.HIGH)
        cause_text = cause if cause else ("NO: " + ", ".join(missing_items or []).upper())
        self._write_lcd("ACCESS DENIED", cause_text[:16])
        self._set_servo_angle(0)

        def auto_silence():
            time.sleep(2.0)
            GPIO.output(self.buzzer_pin, GPIO.LOW)
            time.sleep(2.0)
            GPIO.output(self.red_pin, GPIO.LOW)
            self.reset_standby()

        threading.Thread(target=auto_silence, daemon=True).start()

    def reset_standby(self):
        GPIO.output(self.green_pin, GPIO.LOW)
        GPIO.output(self.red_pin, GPIO.LOW)
        GPIO.output(self.buzzer_pin, GPIO.LOW)
        self._set_servo_angle(0)
        self._write_lcd("SAFEGUARD AI", "WELCOME - SCAN")

    def get_state(self) -> Dict[str, Any]:
        return {
            "hardware_mode": "raspberry_pi",
            "serial_connected": False,
            "serial_port": None,
            "gate": {"state": "READY", "angle": 0},
            "led": {"green": False, "red": False},
            "leds": {"green": False, "red": False, "amber": True},
            "buzzer": {"active": False},
            "lcd": {"line1": "SAFEGUARD AI", "line2": "WELCOME - SCAN"},
            "timestamp": time.time()
        }


class ArduinoHardwareController(VirtualHardwareSimulator):
    """
    Physical Arduino Controller over USB Serial (pyserial).
    Simultaneously drives the physical 16x2 LCD, LEDs, buzzer, and servo
    while updating the Web UI Digital Twin in real-time.
    Supports auto-reconnection, dynamic port detection, and LCD sync.
    """
    def __init__(self, port: Optional[str] = None, baudrate: int = 9600):
        super().__init__()
        self.mode = "arduino"
        self.port = port
        self.baudrate = baudrate
        self.serial_conn = None
        self._last_reconnect_attempt = 0.0
        self._conn_lock = threading.RLock()
        
        # Connect in a background daemon thread so app & uvicorn startup immediately without blocking port 8000
        threading.Thread(target=self.connect_port, args=(self.port, self.baudrate), daemon=True).start()

    @property
    def is_serial_connected(self) -> bool:
        return bool(self.serial_conn and self.serial_conn.is_open)

    def get_available_ports(self) -> Dict[str, Any]:
        """Scans system for candidate Arduino/serial ports."""
        port_list = []
        try:
            import serial.tools.list_ports
            for p in serial.tools.list_ports.comports():
                dev = p.device or ""
                desc = p.description or ""
                hwid = p.hwid or ""
                is_candidate = any(
                    k in dev.lower() or k in desc.lower() or k in hwid.lower()
                    for k in ["usb", "usbmodem", "usbserial", "wchusbserial", "arduino", "1a86", "ch340", "cp210", "ftdi", "ttyacm", "ttyusb"]
                )
                port_list.append({
                    "device": dev,
                    "description": desc,
                    "hwid": hwid,
                    "is_arduino_candidate": is_candidate,
                    "is_active": (dev == self.port and self.is_serial_connected),
                })
        except Exception as e:
            print(f"[Hardware] Port scan error: {e}")

        return {
            "ports": port_list,
            "current_port": self.port,
            "connected": self.is_serial_connected,
            "baudrate": self.baudrate,
        }

    def _write_raw(self, cmd: str):
        """Thread-safe direct write to serial port without re-acquiring lock."""
        if self.serial_conn and self.serial_conn.is_open:
            try:
                if not cmd.endswith("\n"):
                    cmd += "\n"
                self.serial_conn.write(cmd.encode("utf-8"))
                self.serial_conn.flush()
            except Exception as e:
                print(f"[Hardware] Serial write error: {e}")
                try:
                    self.serial_conn.close()
                except Exception:
                    pass
                self.serial_conn = None

    def connect_port(self, port: Optional[str] = None, baudrate: int = 9600) -> Tuple[bool, str]:
        with self._conn_lock:
            try:
                import serial
                import serial.tools.list_ports

                # Close any existing connection cleanly
                if self.serial_conn:
                    try:
                        self.serial_conn.close()
                    except Exception:
                        pass
                    self.serial_conn = None

                target_port = port or self.port
                self.baudrate = baudrate

                ports = list(serial.tools.list_ports.comports())
                available_devices = [p.device for p in ports]

                # If saved port no longer exists in current ports list, reset to auto-detect
                if target_port and target_port not in available_devices and not port:
                    target_port = None

                if not target_port:
                    # Priority 1: Match known Arduino Uno CH340/16U2/FTDI identifiers
                    for p in ports:
                        dev = p.device or ""
                        desc = (p.description or "").lower()
                        hwid = (p.hwid or "").lower()
                        dev_lower = dev.lower()
                        if any(k in dev_lower or k in desc or k in hwid for k in ["usbserial", "usbmodem", "wchusbserial", "1a86", "arduino", "ch340"]):
                            target_port = dev
                            break

                    # Priority 2: Any device with "usb" or "acm"
                    if not target_port and ports:
                        for p in ports:
                            dev_l = (p.device or "").lower()
                            if "usb" in dev_l or "acm" in dev_l:
                                target_port = p.device
                                break

                if not target_port:
                    self.port = None
                    print("[Hardware] No active Arduino serial port detected.")
                    return False, "No Arduino or USB serial port detected"

                self.port = target_port
                print(f"[Hardware] Connecting to Arduino on {self.port} @ {self.baudrate} baud...")
                self.serial_conn = serial.Serial(self.port, self.baudrate, timeout=1.0, write_timeout=1.0)
                
                # Wait 1.8s for ATmega328P bootloader initialization
                time.sleep(1.8)
                
                # Send standby screen handshake directly using raw write
                self._write_raw("STANDBY\n")
                print(f"[Hardware] Successfully connected and synced with Arduino on {self.port}")
                self._emit_state("ARDUINO_CONNECTED")
                return True, f"Connected to {self.port} at {self.baudrate} baud"
            except Exception as e:
                self.serial_conn = None
                print(f"[Hardware] Connection to {port or self.port} notice: {e}")
                return False, f"Connection notice: {e}"

    def send_serial_command(self, cmd: str):
        with self._conn_lock:
            # Auto-reconnect if disconnected and at least 3 seconds since last try
            if not self.is_serial_connected:
                now = time.time()
                if now - self._last_reconnect_attempt > 3.0:
                    self._last_reconnect_attempt = now
                    self.connect_port(self.port, self.baudrate)

            self._write_raw(cmd)

    def grant_access(self, worker_name: str = "", cause: str = "WELCOME", callback_after_close: Optional[Callable] = None):
        super().grant_access(worker_name=worker_name, cause=cause, callback_after_close=callback_after_close)
        # Dispatch command to physical Arduino
        self.send_serial_command("ALLOWED:WELCOME\n")
        self.send_serial_command("LCD:ACCESS ALLOWED|WELCOME\n")

    def deny_access(self, missing_items: Optional[List[str]] = None, cause: str = ""):
        super().deny_access(missing_items=missing_items, cause=cause)
        if not cause:
            missing_str = ", ".join(missing_items).upper() if missing_items else "PPE INCOMPLETE"
            cause = f"NO: {missing_str}"
        if len(cause) > 16:
            cause = cause[:16]
        # Dispatch command to physical Arduino
        self.send_serial_command(f"DENIED:{cause}\n")
        self.send_serial_command(f"LCD:ACCESS DENIED|{cause}\n")

    def reset_standby(self):
        super().reset_standby()
        self.send_serial_command("STANDBY\n")
        self.send_serial_command("LCD:SAFEGUARD AI|WELCOME - SCAN\n")

    def display_custom_lcd(self, line1: str, line2: str = ""):
        super().display_custom_lcd(line1, line2)
        l1 = (line1 or "")[:16]
        l2 = (line2 or "")[:16]
        self.send_serial_command(f"LCD:{l1}|{l2}\n")


# Global Singleton Factory
_global_controller = None

def get_hardware_controller() -> BaseHardwareController:
    global _global_controller
    if _global_controller is None:
        if HAS_RPI_GPIO:
            try:
                _global_controller = RaspberryPiHardwareController()
                print("Hardware Controller initialized in RASPBERRY PI GPIO Mode.")
            except Exception as e:
                print(f"Failed to initialize RPi hardware: {e}. Falling back to Simulator.")
                _global_controller = VirtualHardwareSimulator()
        else:
            try:
                import serial
                arduino_ctrl = ArduinoHardwareController()
                _global_controller = arduino_ctrl
                if arduino_ctrl.is_serial_connected:
                    print(f"Hardware Controller initialized in ARDUINO SERIAL Mode on {arduino_ctrl.port}.")
                else:
                    print("Hardware Controller initialized in ARDUINO HYBRID Mode (Ready for serial connection).")
            except Exception as e:
                print(f"Serial subsystem note: {e}. Falling back to Simulator.")
                _global_controller = VirtualHardwareSimulator()
    return _global_controller
