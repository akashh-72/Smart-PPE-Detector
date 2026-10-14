
/*
 * Smart PPE Access Control Gateway - Arduino Hardware Controller
 *
 * Hardware:
 * - Arduino Uno / Nano / Mega / Leonardo
 * - 16x2 I2C LCD (auto-detects address 0x27 or 0x3F)
 * - SG90 / MG996R Servo Motor on Pin 9
 * - Piezo Buzzer on Pin 8
 * - Green LED on Pin 6
 * - Red LED on Pin 7
 *
 * Serial commands at 9600 baud:
 *   ALLOWED
 *   ALLOWED:Akash
 *   GRANTED:Akash
 *   DENIED:NO HELMET
 *   LCD:Line 1|Line 2
 *   STANDBY
 *   RESET
 *
 * LCD wiring (Arduino Uno):
 *   GND -> GND
 *   VCC -> 5V
 *   SDA -> A4
 *   SCL -> A5
 */

#include <LiquidCrystal_I2C.h>
#include <Servo.h>
#include <Wire.h>

// --------------------------------------------------
// LCD CONFIGURATION
// --------------------------------------------------

LiquidCrystal_I2C lcd27(0x27, 16, 2);
LiquidCrystal_I2C lcd3F(0x3F, 16, 2);

bool use3F = false;

// --------------------------------------------------
// HARDWARE PIN DEFINITIONS
// --------------------------------------------------

const int PIN_BUZZER = 8;
const int PIN_LED_RED = 7;
const int PIN_LED_GRN = 6;
const int PIN_SERVO = 9;

// --------------------------------------------------
// SERVO AND STATE VARIABLES
// --------------------------------------------------

Servo barrierServo;
bool servoAttached = false;

unsigned long stateResetTime = 0;
bool isTemporaryState = false;

// IMPORTANT: Declare scrolling variables before loop()
String scrollText = "";
int scrollPos = 0;
unsigned long lastScrollTime = 0;

const unsigned long SCROLL_INTERVAL = 350;

// --------------------------------------------------
// LCD WRAPPER FUNCTIONS
// --------------------------------------------------

void lcdClear() {
  if (use3F) {
    lcd3F.clear();
  } else {
    lcd27.clear();
  }
}

void lcdSetCursor(uint8_t col, uint8_t row) {
  if (use3F) {
    lcd3F.setCursor(col, row);
  } else {
    lcd27.setCursor(col, row);
  }
}

void lcdPrint(String text) {
  if (use3F) {
    lcd3F.print(text);
  } else {
    lcd27.print(text);
  }
}

void lcdBacklight(bool on) {
  if (use3F) {
    if (on)
      lcd3F.backlight();
    else
      lcd3F.noBacklight();
  } else {
    if (on)
      lcd27.backlight();
    else
      lcd27.noBacklight();
  }
}

// --------------------------------------------------
// LCD INITIALIZATION AND ADDRESS DETECTION
// --------------------------------------------------

void initLCD() {
  Wire.begin();
  delay(120);

  // Check address 0x27
  Wire.beginTransmission(0x27);
  byte err27 = Wire.endTransmission();

  // Check address 0x3F
  Wire.beginTransmission(0x3F);
  byte err3F = Wire.endTransmission();

  if (err27 == 0) {
    use3F = false;
    Serial.println("I2C_LCD:FOUND_0x27");
  } else if (err3F == 0) {
    use3F = true;
    Serial.println("I2C_LCD:FOUND_0x3F");
  } else {
    // Scan the I2C bus for another responding device
    byte found = 0;

    for (byte addr = 1; addr < 127; addr++) {
      Wire.beginTransmission(addr);

      if (Wire.endTransmission() == 0) {
        found = addr;
        Serial.print("I2C_DEVICE_FOUND:0x");
        Serial.println(found, HEX);
        break;
      }
    }

    // Select a known LCD address if found.
    // Other addresses require changing the LCD objects above.
    use3F = (found == 0x3F);

    if (found != 0x27 && found != 0x3F) {
      Serial.println("WARNING: LCD address not recognized");
    }
  }

  if (use3F) {
    lcd3F.init();
    lcd3F.backlight();
    lcd3F.clear();
  } else {
    lcd27.init();
    lcd27.backlight();
    lcd27.clear();
  }
}

// --------------------------------------------------
// SETUP
// --------------------------------------------------

void setup() {
  Serial.begin(9600);
  Serial.setTimeout(100);

  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_GRN, OUTPUT);

  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_LED_GRN, LOW);

  // Initialize servo; 0 degrees means barrier closed
  barrierServo.attach(PIN_SERVO);
  servoAttached = true;
  barrierServo.write(0);

  // Initialize LCD
  initLCD();

  // Boot screen
  lcdClear();
  lcdSetCursor(0, 0);
  lcdPrint("SAFEGUARD AI");

  lcdSetCursor(0, 1);
  lcdPrint("ARDUINO READY");

  // Backlight confirmation
  delay(300);
  lcdBacklight(false);
  delay(150);
  lcdBacklight(true);
  delay(1000);

  showStandbyScreen();

  Serial.println("ARDUINO_PPE_GATEWAY_READY");
}

// --------------------------------------------------
// MAIN LOOP
// --------------------------------------------------

void loop() {
  // Read commands from the Python backend
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd.length() > 0) {
      handleCommand(cmd);
    }
  }

  // Scroll long text across LCD line 2
  if (scrollText.length() > 16 &&
      millis() - lastScrollTime >= SCROLL_INTERVAL) {

    lastScrollTime = millis();

    scrollPos++;

    // Repeat the message from the beginning
    if (scrollPos > scrollText.length() - 16) {
      scrollPos = 0;
    }

    lcdSetCursor(0, 1);
    lcdPrint(scrollText.substring(scrollPos, scrollPos + 16));
  }

  // Return to standby when the message duration expires
  if (isTemporaryState && (long)(millis() - stateResetTime) >= 0) {

    showStandbyScreen();
  }
}

// --------------------------------------------------
// SERIAL COMMAND HANDLER
// --------------------------------------------------

void handleCommand(String cmd) {
  if (cmd.startsWith("ALLOWED") || cmd.startsWith("GRANTED")) {

    handleAccessAllowed(cmd);

  } else if (cmd.startsWith("DENIED")) {

    handleAccessDenied(cmd);

  } else if (cmd.startsWith("LCD:")) {

    handleCustomLcd(cmd.substring(4));

  } else if (cmd.equalsIgnoreCase("STANDBY") || cmd.equalsIgnoreCase("RESET")) {

    showStandbyScreen();
  }
}

// --------------------------------------------------
// STANDBY SCREEN
// --------------------------------------------------

void showStandbyScreen() {
  isTemporaryState = false;
  scrollText = "";
  scrollPos = 0;

  digitalWrite(PIN_LED_GRN, LOW);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_BUZZER, LOW);

  // Close the barrier
  if (servoAttached) {
    barrierServo.write(0);
  }

  lcdClear();

  lcdSetCursor(0, 0);
  lcdPrint("SAFEGUARD AI");

  lcdSetCursor(0, 1);
  lcdPrint("WELCOME - SCAN");
}

// --------------------------------------------------
// ACCESS ALLOWED
// --------------------------------------------------

void handleAccessAllowed(String cmd) {
  scrollText = "";
  scrollPos = 0;

  String welcomeMsg = "WELCOME";

  // Extract name/message after the colon
  int colonIdx = cmd.indexOf(':');

  if (colonIdx != -1 && colonIdx < cmd.length() - 1) {
    welcomeMsg = cmd.substring(colonIdx + 1);
    welcomeMsg.trim();

    if (welcomeMsg.length() == 0) {
      welcomeMsg = "WELCOME";
    }
  }

  // Green LED ON, red LED OFF
  digitalWrite(PIN_LED_GRN, HIGH);
  digitalWrite(PIN_LED_RED, LOW);

  // Open the barrier
  if (servoAttached) {
    barrierServo.write(90);
  }

  // Double confirmation chime
  digitalWrite(PIN_BUZZER, HIGH);
  delay(70);
  digitalWrite(PIN_BUZZER, LOW);
  delay(60);
  digitalWrite(PIN_BUZZER, HIGH);
  delay(70);
  digitalWrite(PIN_BUZZER, LOW);

  // Display access result
  lcdClear();

  lcdSetCursor(0, 0);
  lcdPrint("ACCESS ALLOWED");

  lcdSetCursor(0, 1);

  if (welcomeMsg.length() > 16) {
    scrollText = welcomeMsg + "   " + welcomeMsg;
    scrollPos = 0;
    lastScrollTime = millis();

    lcdPrint(welcomeMsg.substring(0, 16));
  } else {
    scrollText = "";
    lcdPrint(welcomeMsg);
  }

  // Hold result for 4.5 seconds
  stateResetTime = millis() + 4500;
  isTemporaryState = true;

  Serial.println("STATUS:ALLOWED_ACK");
}

// --------------------------------------------------
// ACCESS DENIED
// --------------------------------------------------

void handleAccessDenied(String cmd) {
  scrollText = "";
  scrollPos = 0;

  String causeMsg = "NO: PPE";

  // Extract denial reason after the colon
  int colonIdx = cmd.indexOf(':');

  if (colonIdx != -1 && colonIdx < cmd.length() - 1) {
    causeMsg = cmd.substring(colonIdx + 1);
    causeMsg.trim();

    if (causeMsg.length() == 0) {
      causeMsg = "NO: PPE";
    }
  }

  // Red LED ON, green LED OFF
  digitalWrite(PIN_LED_GRN, LOW);
  digitalWrite(PIN_LED_RED, HIGH);

  // Keep the barrier closed
  if (servoAttached) {
    barrierServo.write(0);
  }

  // Warning buzzer
  digitalWrite(PIN_BUZZER, HIGH);
  delay(350);
  digitalWrite(PIN_BUZZER, LOW);

  // Display denial result
  lcdClear();

  lcdSetCursor(0, 0);
  lcdPrint("ACCESS DENIED");

  lcdSetCursor(0, 1);

  if (causeMsg.length() > 16) {
    scrollText = causeMsg + "   " + causeMsg;
    scrollPos = 0;
    lastScrollTime = millis();

    lcdPrint(causeMsg.substring(0, 16));
  } else {
    scrollText = "";
    lcdPrint(causeMsg);
  }

  // Hold result for 5 seconds
  stateResetTime = millis() + 5000;
  isTemporaryState = true;

  Serial.println("STATUS:DENIED_ACK");
}

// --------------------------------------------------
// CUSTOM LCD COMMAND
// Format: LCD:First line|Second line
// --------------------------------------------------

void handleCustomLcd(String payload) {
  scrollText = "";
  scrollPos = 0;

  int splitIdx = payload.indexOf('|');

  String line1 = "";
  String line2 = "";

  if (splitIdx != -1) {
    line1 = payload.substring(0, splitIdx);
    line2 = payload.substring(splitIdx + 1);
  } else {
    line1 = payload;
  }

  line1.trim();
  line2.trim();

  lcdClear();

  lcdSetCursor(0, 0);

  if (line1.length() > 16) {
    lcdPrint(line1.substring(0, 16));
  } else {
    lcdPrint(line1);
  }

  lcdSetCursor(0, 1);

  if (line2.length() > 16) {
    scrollText = line2 + "   " + line2;
    scrollPos = 0;
    lastScrollTime = millis();

    lcdPrint(line2.substring(0, 16));
  } else {
    lcdPrint(line2);
  }

  // Hold custom screen for 4 seconds
  stateResetTime = millis() + 4000;
  isTemporaryState = true;

  Serial.println("STATUS:LCD_ACK");
}
