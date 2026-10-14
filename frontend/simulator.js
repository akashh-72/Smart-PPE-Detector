/**
 * Hardware Digital Twin Simulator & Acoustic Synthesizer
 * Simulates physical Raspberry Pi 4 GPIO hardware:
 * - 16x2 I2C Character LCD (PCF8574)
 * - Green & Red Tower Stack LEDs (GPIO 17/27)
 * - 2.4kHz Piezoelectric Buzzer (GPIO 22)
 * - PWM SG90/MG996R Servo Barrier Gate (GPIO 18)
 */

class HardwareSimulator {
  constructor() {
    this.soundEnabled = true;
    this.audioCtx = null;
    this.currentGateAngle = 0;
    this.ws = null;
    this.pollInterval = null;

    // DOM Elements
    this.lcdScreen = document.getElementById("lcdScreen");
    this.lcdLine1 = document.getElementById("lcdLine1");
    this.lcdLine2 = document.getElementById("lcdLine2");

    this.towerRed = document.getElementById("towerRedLight");
    this.towerGreen = document.getElementById("towerGreenLight");

    this.buzzerFixture = document.getElementById("buzzerFixture");
    this.buzzerStatusText = document.getElementById("buzzerStatusText");

    this.barrierArm = document.getElementById("barrierArmGroup");
    this.counterWeight = document.getElementById("counterWeight");
    this.servoBadge = document.getElementById("servoAngleBadge");

    this.initAudio();
    this.initFirebaseSubscription();
    this.connectWebSocket();
  }

  initFirebaseSubscription() {
    const attach = () => {
      if (window.SafeGuardFirebase?.subscribeHardware) {
        window.SafeGuardFirebase.subscribeHardware((hwState) => {
          if (hwState) {
            this.applyState(hwState);
          }
        });
      }
    };
    if (window.SafeGuardFirebase?.isReady) {
      attach();
    } else {
      window.addEventListener("firebase-ready", () => attach());
    }
  }

  initAudio() {
    const audioBtn = document.getElementById("toggleAudioBtn");
    const audioIcon = document.getElementById("audioIcon");
    const audioLabel = document.getElementById("audioLabel");

    if (audioBtn) {
      audioBtn.addEventListener("click", () => {
        this.soundEnabled = !this.soundEnabled;
        audioIcon.textContent = this.soundEnabled ? "🔊" : "🔇";
        audioLabel.textContent = this.soundEnabled ? "Sound ON" : "Muted";
        if (this.soundEnabled && !this.audioCtx) {
          this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
      });
    }

    // Initialize audio context on first user click
    window.addEventListener("click", () => {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
    }, { once: true });
  }

  playBuzzerAlarm() {
    if (!this.soundEnabled) return;
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

      // Industrial buzzer: 2 beeps at 2400 Hz (piezo peak frequency)
      const now = this.audioCtx.currentTime;
      const beeps = [0, 0.25, 0.5];

      beeps.forEach((delay) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = "square";
        osc.frequency.setValueAtTime(2400, now + delay);

        gain.gain.setValueAtTime(0.18, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.18);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 0.18);
      });
    } catch (e) {
      console.warn("Audio synth warning:", e);
    }
  }

  playGrantChime() {
    if (!this.soundEnabled) return;
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

      // Pleasant double harmonic chime for access grant
      const now = this.audioCtx.currentTime;
      const notes = [587.33, 880.00]; // D5, A5

      notes.forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0.15, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.35);
      });
    } catch (e) {
      console.warn("Chime error:", e);
    }
  }

  updateLcd(line1, line2, backlight = "blue") {
    if (this.lcdLine1) this.lcdLine1.textContent = (line1 || "").padEnd(16, " ");
    if (this.lcdLine2) this.lcdLine2.textContent = (line2 || "").padEnd(16, " ");

    if (this.lcdScreen) {
      this.lcdScreen.classList.remove("backlight-blue", "backlight-green", "backlight-red");
      this.lcdScreen.classList.add(`backlight-${backlight}`);
    }
  }

  setLeds(greenOn, redOn) {
    if (this.towerGreen) {
      this.towerGreen.className = `light-section green-light ${greenOn ? "active on" : "off"}`;
    }
    if (this.towerRed) {
      this.towerRed.className = `light-section red-light ${redOn ? "active on" : "off"}`;
    }
  }

  grantAccess() {
    this.updateLcd("ACCESS GRANTED", "PLEASE PROCEED", "green");
    this.setLeds(true, false);
    this.setBarrierAngle(90);
    this.playGrantChime();

    // Call backend API
    fetch(`${API_BASE}/api/hardware/gate/toggle?action=OPEN`, { method: "POST" }).catch(() => {});

    // Automatically close after hold duration
    setTimeout(() => {
      this.resetStandby();
    }, 5000);
  }

  denyAccess(missingItems = []) {
    const missingStr = Array.isArray(missingItems) && missingItems.length ? missingItems[0].toUpperCase() : "PPE";
    this.updateLcd("ACCESS DENIED", `MISSING ${missingStr}`, "red");
    this.setLeds(false, true);
    this.setBarrierAngle(0);
    this.playBuzzerAlarm();

    // Call backend API
    fetch(`${API_BASE}/api/hardware/gate/toggle?action=CLOSE`, { method: "POST" }).catch(() => {});

    // Automatically reset after 4s
    setTimeout(() => {
      this.resetStandby();
    }, 4000);
  }

  resetStandby() {
    this.updateLcd("SYSTEM READY", "WAITING SCAN...", "blue");
    this.setLeds(false, false);
    this.setBarrierAngle(0);
    this.setBuzzer(false);

    // Call backend API
    fetch(`${API_BASE}/api/hardware/reset`, { method: "POST" }).catch(() => {});
  }

  setBuzzer(active, pattern = "off") {
    if (this.buzzerFixture) {
      if (active) {
        this.buzzerFixture.classList.add("active");
        this.buzzerStatusText.textContent = `ALERT (${pattern.toUpperCase()})`;
        if (pattern === "alarm") {
          this.playBuzzerAlarm();
        }
      } else {
        this.buzzerFixture.classList.remove("active");
        this.buzzerStatusText.textContent = "IDLE / QUIET";
      }
    }
  }

  setBarrierAngle(angle) {
    this.currentGateAngle = angle;
    // In SVG pivot coordinates, rotating upward is negative rotation
    const svgAngle = -angle;

    if (this.barrierArm) {
      this.barrierArm.setAttribute("transform", `rotate(${svgAngle}, 110, 85)`);
    }
    if (this.counterWeight) {
      this.counterWeight.setAttribute("transform", `rotate(${svgAngle}, 110, 85)`);
    }

    if (this.servoBadge) {
      const stateStr = angle >= 70 ? "[OPEN]" : angle <= 10 ? "[CLOSED]" : "[MOVING]";
      this.servoBadge.textContent = `Angle: ${angle}° ${stateStr}`;
      this.servoBadge.style.color = angle >= 70 ? "#10B981" : "#F59E0B";
    }
  }

  applyState(state) {
    if (!state) return;

    // Apply LCD
    if (state.lcd) {
      this.updateLcd(state.lcd.line1, state.lcd.line2, state.lcd.backlight);
    }

    // Apply LEDs
    if (state.led) {
      this.setLeds(state.led.green, state.led.red);
    }

    // Apply Buzzer
    if (state.buzzer) {
      this.setBuzzer(state.buzzer.active, state.buzzer.pattern);
    }

    // Apply Barrier Gate Angle
    if (state.gate && state.gate.angle !== undefined) {
      this.setBarrierAngle(state.gate.angle);
    }

    // Trigger audio cues on events
    if (state.event_type === "ACCESS_GRANTED") {
      this.playGrantChime();
    } else if (state.event_type === "ACCESS_DENIED") {
      this.playBuzzerAlarm();
    }
  }

  connectWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let host = window.location.host;
    if (!host || host.includes(":5500") || host.includes(":3000")) {
      host = `${window.location.hostname || "localhost"}:8000`;
    }
    const wsUrl = `${protocol}//${host}/ws/hardware`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("Connected to Hardware WebSocket Gateway.");
        const healthText = document.getElementById("systemHealthText");
        const healthDot = document.getElementById("systemHealthDot");
        const popoverHwDot = document.getElementById("popoverHwDot");
        const popoverHwText = document.getElementById("popoverHwText");
        if (healthText) healthText.textContent = "Gate Online";
        if (healthDot) healthDot.className = "pulsing-dot green";
        if (popoverHwDot) popoverHwDot.className = "item-dot green";
        if (popoverHwText) popoverHwText.textContent = "Virtual Twin Live";

        if (this.pollInterval) {
          clearInterval(this.pollInterval);
          this.pollInterval = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const state = JSON.parse(event.data);
          this.applyState(state);
        } catch (e) {
          console.error("WS Parse error:", e);
        }
      };

      this.ws.onclose = () => {
        console.warn("WebSocket closed. Falling back to HTTP state polling.");
        const popoverHwDot = document.getElementById("popoverHwDot");
        const popoverHwText = document.getElementById("popoverHwText");
        if (popoverHwDot) popoverHwDot.className = "item-dot amber";
        if (popoverHwText) popoverHwText.textContent = "Polling Mode (HTTP)";

        this.startPolling();
        setTimeout(() => this.connectWebSocket(), 3000);
      };

      this.ws.onerror = () => {
        this.ws.close();
      };
    } catch (e) {
      this.startPolling();
    }
  }

  startPolling() {
    if (this.pollInterval) return;
    const apiBase = (window.location.protocol === "http:" || window.location.protocol === "https:")
      ? (window.location.port === "5500" || window.location.port === "3000" ? `http://${window.location.hostname}:8000` : "")
      : "http://localhost:8000";

    this.pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/api/hardware/state`);
        if (res.ok) {
          const state = await res.json();
          this.applyState(state);
        }
      } catch (e) {
        // Silently retry
      }
    }, 1000);
  }
}

// Global instance
window.hardwareSimulator = new HardwareSimulator();
