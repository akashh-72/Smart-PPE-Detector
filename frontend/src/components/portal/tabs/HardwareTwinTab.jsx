import React, { useState, useEffect, useRef } from 'react';
import { 
  Cpu, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Lock, 
  Unlock, 
  Activity, 
  Sliders, 
  Zap, 
  Radio, 
  CheckCircle2, 
  AlertTriangle,
  Usb,
  RefreshCw,
  Send,
  HelpCircle
} from 'lucide-react';
import { hardwareWs } from '../../../services/hardwareWs';
import { 
  getHardwareState, 
  toggleGate, 
  resetHardware, 
  getHardwarePorts, 
  connectHardware, 
  testHardware 
} from '../../../services/apiService';

export default function HardwareTwinTab() {
  const [hardwareState, setHardwareState] = useState({
    mode: "DIGITAL_TWIN",
    serial_connected: false,
    serial_port: null,
    gate: { angle: 0, state: "CLOSED" },
    leds: { green: false, red: false, amber: true },
    buzzer: { active: false },
    lcd: { line1: "SAFEGUARD AI", line2: "WELCOME - SCAN" }
  });

  const [wsConnected, setWsConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Serial ports state
  const [portsData, setPortsData] = useState({ ports: [], current_port: null, connected: false });
  const [selectedPort, setSelectedPort] = useState("");
  const [isConnectingPort, setIsConnectingPort] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  const audioContextRef = useRef(null);

  const loadPorts = async () => {
    try {
      const data = await getHardwarePorts();
      setPortsData(data);
      if (data.current_port && !selectedPort) {
        setSelectedPort(data.current_port);
      } else if (!selectedPort && data.ports && data.ports.length > 0) {
        const candidate = data.ports.find((p) => p.is_arduino_candidate);
        if (candidate) setSelectedPort(candidate.device);
      }
    } catch (e) {
      console.warn("Ports fetch error:", e);
    }
  };

  // Initialize WebSocket and initial state
  useEffect(() => {
    hardwareWs.connect();
    
    const unsubscribeState = hardwareWs.subscribe((state) => {
      setHardwareState((prev) => ({ ...prev, ...state }));
      if (state.buzzer?.active && soundEnabled) {
        triggerAudioBeep();
      }
    });

    const unsubscribeStatus = hardwareWs.subscribeStatus((connected) => {
      setWsConnected(connected);
    });

    // Fallback initial fetch via HTTP
    getHardwareState()
      .then((data) => {
        setHardwareState(data);
        if (data.serial_port) setSelectedPort(data.serial_port);
      })
      .catch(() => {});

    loadPorts();
    const portTimer = setInterval(loadPorts, 5000);

    return () => {
      unsubscribeState();
      unsubscribeStatus();
      clearInterval(portTimer);
    };
  }, [soundEnabled]);

  // Audio synthesis alert beep
  const triggerAudioBeep = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // AudioContext blocked by user interaction policy
    }
  };

  const handleToggleGate = async (action) => {
    setIsUpdating(true);
    try {
      const res = await toggleGate(action);
      if (res.state) setHardwareState(res.state);
    } catch (err) {
      console.error("Gate toggle error:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetHardware = async () => {
    setIsUpdating(true);
    try {
      const res = await resetHardware();
      if (res.state) setHardwareState(res.state);
      setFeedbackMsg("Hardware reset to STANDBY.");
    } catch (err) {
      console.error("Reset error:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConnectPort = async () => {
    setIsConnectingPort(true);
    setFeedbackMsg("Connecting to selected port...");
    try {
      const res = await connectHardware(selectedPort || null, 9600);
      setFeedbackMsg(res.message);
      if (res.state) setHardwareState(res.state);
      await loadPorts();
    } catch (err) {
      setFeedbackMsg("Connection attempt error: " + err.message);
    } finally {
      setIsConnectingPort(false);
    }
  };

  const handleTestScreen = async (action, options = {}) => {
    setIsUpdating(true);
    try {
      const res = await testHardware(action, options);
      if (res.state) setHardwareState(res.state);
      setFeedbackMsg(`Test executed: ${action}`);
    } catch (err) {
      setFeedbackMsg(`Test failed: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const isGateOpen = hardwareState.gate?.angle > 45 || hardwareState.gate?.state === "OPEN";
  const isSerialConnected = Boolean(hardwareState.serial_connected || portsData.connected);
  const activePortName = hardwareState.serial_port || portsData.current_port;

  return (
    <div className="portal-hardware-suite animate-fadeIn">
      
      {/* Top Welcome Header */}
      <div className="portal-welcome-header">
        <div className="portal-welcome-left">
          <h1>Hardware Gateway &amp; Digital Twin</h1>
          <p>
            Real-time telemetry and dual actuation mirror for physical Arduino Uno, 16x2 I2C LCD, barrier servos, and warning buzzers.
          </p>
        </div>

        <div className="portal-welcome-right-actions">
          {/* Physical Hardware Status Pill */}
          <div className={`hardware-conn-pill ${isSerialConnected ? 'connected' : 'disconnected'}`}>
            <Usb size={14} />
            <span>
              {isSerialConnected 
                ? `Arduino Uno Active (${activePortName})` 
                : 'Arduino Standby / Auto-Detecting'}
            </span>
          </div>

          {/* WebSocket Live Pill */}
          <div className={`hardware-conn-pill ${wsConnected ? 'connected' : 'disconnected'}`}>
            <span className="conn-dot"></span>
            <span>{wsConnected ? 'WebSocket Edge Live' : 'Connecting WebSocket...'}</span>
          </div>
        </div>
      </div>

      {/* Arduino Hardware Connection Manager Bar */}
      <div className="hardware-card" style={{ padding: '1rem 1.5rem', background: '#F8FAFC', border: '1px solid #CBD5E1' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: 36, 
              height: 36, 
              borderRadius: 8, 
              background: isSerialConnected ? '#10B981' : '#F59E0B', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: '#FFFFFF' 
            }}>
              <Usb size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>
                Arduino Serial Hardware Port: {isSerialConnected ? 'CONNECTED' : 'STANDBY (READY TO CONNECT)'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                {activePortName 
                  ? `Active on ${activePortName} @ 9600 baud` 
                  : 'Plug in Arduino Uno via USB and click Connect'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select 
              value={selectedPort} 
              onChange={(e) => setSelectedPort(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem',
                fontSize: '0.82rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#1E293B',
                minWidth: '220px'
              }}
            >
              <option value="">-- Auto-Detect Arduino Port --</option>
              {portsData.ports?.map((p, idx) => (
                <option key={idx} value={p.device}>
                  {p.device} {p.description && p.description !== 'n/a' ? `(${p.description})` : ''} {p.is_arduino_candidate ? '★ Uno' : ''}
                </option>
              ))}
            </select>

            <button 
              className="skinive-btn-pill-primary" 
              onClick={handleConnectPort}
              disabled={isConnectingPort}
              style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <RefreshCw size={14} className={isConnectingPort ? 'animate-spin' : ''} />
              <span>{isConnectingPort ? 'Connecting...' : (isSerialConnected ? 'Re-Sync Arduino' : 'Connect Arduino')}</span>
            </button>
          </div>
        </div>

        {feedbackMsg && (
          <div style={{ marginTop: '0.65rem', fontSize: '0.78rem', color: '#0369A1', fontWeight: 500 }}>
            {feedbackMsg}
          </div>
        )}
      </div>

      {/* Main Grid: Gate Turnstile & Digital Indicators */}
      <div className="hardware-grid-layout">
        
        {/* Left Column: Animated Barrier Gate Actuator */}
        <div className="hardware-card servo-gate-card">
          <div className="card-header-row">
            <div>
              <span className="card-kicker">PIN 9 • SG90 / SERVO TURNSTILE ARM</span>
              <h3 className="card-title">Motorized Turnstile Barrier Gate</h3>
            </div>
            <span className={`gate-status-pill ${isGateOpen ? 'open' : 'closed'}`}>
              {isGateOpen ? 'ARM RAISED (90° ALLOWED)' : 'ARM LOCKED (0° DENIED)'}
            </span>
          </div>

          {/* Animated Turnstile Gate Visual Viewport */}
          <div className="turnstile-visual-viewport">
            <div className="turnstile-floor-grid"></div>

            <div className="turnstile-pedestal">
              <div className="pedestal-top-cap">
                <div className={`pedestal-indicator-light ${isGateOpen ? 'green' : 'red'}`}></div>
              </div>
              <div className="pedestal-body">
                <div className="pedestal-vents">
                  <span></span><span></span><span></span>
                </div>
                <div className="pedestal-branding">
                  <span className="pedestal-logo-text">SAFEGUARD AI</span>
                </div>
              </div>
            </div>

            <div className="turnstile-barrier-pivot">
              <div 
                className={`turnstile-barrier-arm ${isGateOpen ? 'arm-open' : 'arm-closed'}`}
                style={{
                  transform: `rotate(${isGateOpen ? -90 : 0}deg)`
                }}
              >
                <div className="arm-stripes">
                  <span className="stripe red"></span>
                  <span className="stripe white"></span>
                  <span className="stripe red"></span>
                  <span className="stripe white"></span>
                  <span className="stripe red"></span>
                </div>
                <div className="arm-tip-led"></div>
              </div>
            </div>

            <div className="turnstile-angle-badge">
              <span>SERVO ANGLE: <strong>{hardwareState.gate?.angle || 0}°</strong></span>
              <span>STATE: <strong>{hardwareState.gate?.state || "CLOSED"}</strong></span>
            </div>
          </div>

          {/* Manual Gate Actuation Controls */}
          <div className="hardware-manual-controls-row">
            <button 
              className={`skinive-btn-pill-primary ${isGateOpen ? 'active-open' : ''}`}
              onClick={() => handleToggleGate("OPEN")}
              disabled={isUpdating}
            >
              <Unlock size={16} />
              <span>Force Open Barrier</span>
            </button>

            <button 
              className="skinive-btn-pill-secondary"
              onClick={() => handleToggleGate("CLOSE")}
              disabled={isUpdating}
            >
              <Lock size={16} />
              <span>Lock Barrier (Standby)</span>
            </button>

            <button 
              className="skinive-btn-pill-secondary icon-only"
              onClick={handleResetHardware}
              disabled={isUpdating}
              title="Reset hardware controller"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        {/* Right Column: Tri-Color LEDs, Buzzer, 16x2 LCD Display */}
        <div className="hardware-components-column">
          
          {/* 1. Tri-Color LED Indicators Beacon */}
          <div className="hardware-card">
            <div className="card-header-row">
              <div>
                <span className="card-kicker">PINS 6 &amp; 7 • STATUS BEACONS</span>
                <h4 className="card-title">Tri-Color Status Beacon</h4>
              </div>
            </div>

            <div className="tri-color-beacons-strip">
              <div className={`beacon-item ${hardwareState.leds?.green ? 'active green' : ''}`}>
                <div className="beacon-bulb green"></div>
                <div className="beacon-meta">
                  <span className="beacon-title">Access Allowed</span>
                  <span className="beacon-pin">Pin 6 (High)</span>
                </div>
              </div>

              <div className={`beacon-item ${hardwareState.leds?.red ? 'active red' : ''}`}>
                <div className="beacon-bulb red"></div>
                <div className="beacon-meta">
                  <span className="beacon-title">Access Denied</span>
                  <span className="beacon-pin">Pin 7 (High)</span>
                </div>
              </div>

              <div className={`beacon-item ${hardwareState.leds?.amber ? 'active amber' : ''}`}>
                <div className="beacon-bulb amber"></div>
                <div className="beacon-meta">
                  <span className="beacon-title">Standby Loop</span>
                  <span className="beacon-pin">Ready</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Industrial Alert Buzzer */}
          <div className="hardware-card">
            <div className="card-header-row">
              <div>
                <span className="card-kicker">PIN 8 • PIEZO BUZZER</span>
                <h4 className="card-title">Audible Access Chime &amp; Alarm</h4>
              </div>

              <button 
                className={`buzzer-audio-toggle ${soundEnabled ? 'active' : ''}`}
                onClick={() => setSoundEnabled(!soundEnabled)}
                title="Toggle Web Audio browser sound"
              >
                {soundEnabled ? <Volume2 size={16} color="#10B981" /> : <VolumeX size={16} color="#64748B" />}
                <span>{soundEnabled ? 'Audio: ON' : 'Audio: OFF'}</span>
              </button>
            </div>

            <div className="buzzer-status-row">
              <div className={`buzzer-waveform-emblem ${hardwareState.buzzer?.active ? 'buzzing' : ''}`}>
                <div className="buzzer-wave-ring r1"></div>
                <div className="buzzer-wave-ring r2"></div>
                <div className="buzzer-core-icon">
                  <Volume2 size={20} color="#FFFFFF" />
                </div>
              </div>

              <div className="buzzer-meta-details">
                <div className="buzzer-status-line">
                  <strong>STATE:</strong> 
                  <span className={`status-tag ${hardwareState.buzzer?.active ? 'active' : 'idle'}`}>
                    {hardwareState.buzzer?.active ? 'PULSING ALERT (ACTIVE)' : 'SILENT STANDBY'}
                  </span>
                </div>
                <p>Double chime on ACCESS ALLOWED, continuous buzz on ACCESS DENIED.</p>
              </div>
            </div>
          </div>

          {/* 3. 16x2 I2C Dot-Matrix LCD Screen */}
          <div className="hardware-card">
            <div className="card-header-row">
              <div>
                <span className="card-kicker">I2C BUS • A4/SDA &amp; A5/SCL • ADDR 0x27 / 0x3F</span>
                <h4 className="card-title">16x2 Character LCD Display (Physical &amp; Twin Mirror)</h4>
              </div>
            </div>

            {/* Glowing Retro Dot-Matrix Display */}
            <div className="lcd-dot-matrix-screen">
              <div className="lcd-text-row">
                <code>{hardwareState.lcd?.line1 || "SAFEGUARD AI"}</code>
              </div>
              <div className="lcd-text-row">
                <code>{hardwareState.lcd?.line2 || "WELCOME - SCAN"}</code>
              </div>
              <div className="lcd-backlight-glow"></div>
            </div>

            {/* Quick LCD Interactive Test Buttons */}
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button 
                className="skinive-btn-pill-primary"
                onClick={() => handleTestScreen("ALLOWED", { worker_name: "", cause: "WELCOME" })}
                disabled={isUpdating}
                style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem' }}
              >
                <CheckCircle2 size={14} />
                <span>Test "ACCESS ALLOWED / WELCOME"</span>
              </button>

              <button 
                className="skinive-btn-pill-secondary"
                onClick={() => handleTestScreen("DENIED", { cause: "NO: HELMET, VEST" })}
                disabled={isUpdating}
                style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', color: '#DC2626', borderColor: '#FECACA' }}
              >
                <AlertTriangle size={14} />
                <span>Test "ACCESS DENIED / CAUSE"</span>
              </button>

              <button 
                className="skinive-btn-pill-secondary"
                onClick={() => handleTestScreen("STANDBY")}
                disabled={isUpdating}
                style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem' }}
              >
                <RotateCcw size={14} />
                <span>Reset Standby</span>
              </button>
            </div>

            {/* Hardware Contrast Potentiometer Reminder Note */}
            <div style={{ 
              marginTop: '0.85rem', 
              padding: '0.75rem', 
              borderRadius: '8px', 
              background: '#EFF6FF', 
              border: '1px solid #BFDBFE', 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: '0.5rem' 
            }}>
              <HelpCircle size={16} color="#2563EB" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.75rem', color: '#1E40AF', lineHeight: '1.4' }}>
                <strong>Hardware Tip:</strong> If the 16x2 screen backlight turns on but no text appears (or solid white blocks appear), use a small screwdriver to gently adjust the <strong>blue contrast potentiometer screw</strong> on the back of the I2C backpack.
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
