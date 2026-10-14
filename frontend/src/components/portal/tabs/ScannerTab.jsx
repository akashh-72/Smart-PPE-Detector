import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  UploadCloud, 
  Play, 
  RotateCcw, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  HardHat, 
  RefreshCw, 
  Sparkles,
  Layers,
  ArrowRight,
  Unlock,
  Lock,
  Volume2,
  Radio,
  Eye,
  Check,
  X as XIcon,
  Zap,
  SwitchCamera
} from 'lucide-react';
import { verifyWebcam, verifyUpload, runBenchmark, getBenchmarks, toggleGate } from '../../../services/apiService';
import { BENCHMARK_SCENARIOS, PPE_ITEMS_CATALOG } from '../../../data/mockData';

// Web Audio API Synthesizer for Industrial Gateway Sound Cues
function playGatewayTone(type) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'scan') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'granted') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc2.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.1); // C6
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start();
      osc2.start(ctx.currentTime + 0.1);
      osc1.stop(ctx.currentTime + 0.35);
      osc2.stop(ctx.currentTime + 0.35);
    } else if (type === 'denied') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.32);
    }
  } catch (err) {
    // Audio context not allowed without prior interaction or unsupported
  }
}

// Laptop Speaker Text-To-Speech Voice Synthesis Engine
function speakGatewayAnnouncement(text) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // Cancel any prior speech backlog

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;  // Clear, authoritative cadence
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => 
      v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Alex') || v.name.includes('Daniel'))
    ) || voices.find(v => v.lang.startsWith('en'));

    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("Speech synthesis unavailable:", err);
  }
}

function speakGatewayVerdict(result) {
  try {
    if (!result) return;
    if (result.is_compliant) {
      speakGatewayAnnouncement("Access allowed. Welcome to the workshop.");
      return;
    }

    const missing = (result.missing_items || []).map(m => m.toLowerCase());
    const hasHelmet = !missing.includes('helmet');
    const hasVest = !missing.includes('vest');

    if (!hasHelmet && !hasVest) {
      speakGatewayAnnouncement("Access denied. Safety helmet and high visibility vest are missing. Please wear the helmet and vest, and try again.");
    } else if (!hasHelmet) {
      speakGatewayAnnouncement("Access denied. Safety helmet is missing. Please wear the helmet, and try again.");
    } else if (!hasVest) {
      speakGatewayAnnouncement("Access denied. High visibility vest is missing. Please wear the vest, and try again.");
    } else if (missing.length > 0) {
      speakGatewayAnnouncement(`Access denied. Missing ${missing.join(' and ')}. Please wear required safety gear, and try again.`);
    } else {
      speakGatewayAnnouncement("Access denied. Please wear required safety gear, and try again.");
    }
  } catch (e) {
    console.warn("Speech error:", e);
  }
}

export default function ScannerTab({ onNavigateTab }) {
  const [activeSource, setActiveSource] = useState('webcam'); // 'webcam' | 'benchmarks' | 'upload'
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [gateCountdown, setGateCountdown] = useState(null);
  const [viewMode, setViewMode] = useState('live'); // 'live' | 'annotated'
  const [cameraFacing, setCameraFacing] = useState('user'); // 'user' | 'environment'

  // Scan results & images
  const [analysisResult, setAnalysisResult] = useState(null);
  const [annotatedImgUrl, setAnnotatedImgUrl] = useState(null);

  // Simulated / live hardware gate state
  const [gateOpen, setGateOpen] = useState(false);

  // Scenarios
  const [benchmarks, setBenchmarks] = useState(BENCHMARK_SCENARIOS);
  const [selectedBenchmark, setSelectedBenchmark] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const continuousTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Helper to normalize image URLs
  const normalizeImageDataUrl = (val) => {
    if (!val || typeof val !== 'string') return null;
    if (val.startsWith('data:image/') || val.startsWith('blob:') || val.startsWith('/') || val.startsWith('http')) {
      return val;
    }
    return `data:image/jpeg;base64,${val}`;
  };

  // Load benchmarks from backend
  useEffect(() => {
    getBenchmarks()
      .then((data) => {
        if (data && data.length) setBenchmarks(data);
      })
      .catch(() => {});
  }, []);

  // Auto-start camera when operator workstation loads
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (continuousTimerRef.current) clearInterval(continuousTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  // Keyboard shortcut: Spacebar triggers immediate Scan
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!isProcessing) {
          handleCaptureVerify();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProcessing, isCameraActive, activeSource]);

  // Handle countdown timer for barrier open state
  const startGateCountdown = (duration = 5) => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setGateCountdown(duration);
    setGateOpen(true);
    countdownTimerRef.current = setInterval(() => {
      setGateCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          setGateOpen(false);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Start Webcam Stream (with front/rear camera support for mobile)
  const startCamera = async (facing = cameraFacing) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: facing },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
      setActiveSource('webcam');
      setViewMode('live');
    } catch (err) {
      console.warn("Webcam access error with facingMode:", err);
      // Fallback without exact facing constraint
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play();
        }
        setIsCameraActive(true);
        setActiveSource('webcam');
        setViewMode('live');
      } catch (e2) {
        console.warn("Camera unavailable:", e2);
        setIsCameraActive(false);
      }
    }
  };

  // Flip front/rear camera on mobile devices
  const flipCamera = async () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    await startCamera(nextFacing);
  };

  // Stop Webcam Stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsContinuous(false);
    if (continuousTimerRef.current) clearInterval(continuousTimerRef.current);
  };

  // Capture Frame from Video
  const captureFrameBase64 = () => {
    if (!videoRef.current || !isCameraActive) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  // Run Verification on Current Frame
  const handleCaptureVerify = async () => {
    if (isProcessing) return;

    // If using benchmarks or upload, re-run that
    if (activeSource === 'benchmarks' && selectedBenchmark) {
      const b = benchmarks.find(x => x.id === selectedBenchmark) || benchmarks[0];
      handleRunBenchmark(b);
      return;
    }

    if (activeSource === 'upload') {
      if (fileInputRef.current) fileInputRef.current.click();
      return;
    }

    // Live Camera Mode: Ensure camera is on and frame is grabbed directly
    setViewMode('live');
    if (!isCameraActive || !streamRef.current) {
      await startCamera();
      await new Promise(r => setTimeout(r, 250));
    }

    const b64 = captureFrameBase64();
    if (!b64) {
      console.warn("Camera frame capture unavailable. Please check camera permissions.");
      return;
    }

    playGatewayTone('scan');
    setIsProcessing(true);
    try {
      const res = await verifyWebcam(b64);
      setAnalysisResult(res);
      if (res.annotated_image) {
        setAnnotatedImgUrl(normalizeImageDataUrl(res.annotated_image));
        setViewMode('annotated');
      }
      if (res.is_compliant) {
        playGatewayTone('granted');
        speakGatewayAnnouncement("Access allowed. Welcome to the workshop.");
        startGateCountdown(5);
      } else {
        playGatewayTone('denied');
        speakGatewayVerdict(res);
        setGateOpen(false);
      }
    } catch (err) {
      console.error("Verification error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Dedicated Re-Scan Handler: Re-scans live camera or currently selected source (Zero dummy fallbacks)
  const handleReScan = async () => {
    if (isProcessing) return;
    setAnalysisResult(null);
    setViewMode('live');

    if (activeSource === 'webcam') {
      if (!isCameraActive || !streamRef.current) {
        await startCamera();
        await new Promise(r => setTimeout(r, 200));
      }
      handleCaptureVerify();
    } else if (activeSource === 'upload') {
      if (fileInputRef.current) fileInputRef.current.click();
    } else if (activeSource === 'benchmarks' && selectedBenchmark) {
      const b = benchmarks.find(x => x.id === selectedBenchmark) || benchmarks[0];
      if (b) handleRunBenchmark(b);
    }
  };

  // Toggle Continuous Inspection Mode
  const toggleContinuous = () => {
    if (!isCameraActive) {
      startCamera().then(() => {
        setIsContinuous(true);
        startContinuousLoop();
      });
      return;
    }

    if (isContinuous) {
      setIsContinuous(false);
      if (continuousTimerRef.current) clearInterval(continuousTimerRef.current);
    } else {
      setIsContinuous(true);
      startContinuousLoop();
    }
  };

  const startContinuousLoop = () => {
    if (continuousTimerRef.current) clearInterval(continuousTimerRef.current);
    continuousTimerRef.current = setInterval(() => {
      if (!isProcessing && isCameraActive) {
        handleCaptureVerify();
      }
    }, 1900);
  };

  // Run Benchmark Scenario
  const handleRunBenchmark = async (scenario) => {
    setSelectedBenchmark(scenario.id);
    setActiveSource('benchmarks');
    if (scenario.image) {
      setAnnotatedImgUrl(scenario.image);
      setViewMode('annotated');
    }
    playGatewayTone('scan');
    setIsProcessing(true);
    try {
      const res = await runBenchmark(scenario.id);
      setAnalysisResult(res);
      if (res.annotated_image) {
        setAnnotatedImgUrl(normalizeImageDataUrl(res.annotated_image));
      }
      if (res.is_compliant) {
        playGatewayTone('granted');
        speakGatewayAnnouncement("Access allowed. Welcome to the workshop.");
        startGateCountdown(5);
      } else {
        playGatewayTone('denied');
        speakGatewayVerdict(res);
        setGateOpen(false);
      }
    } catch (err) {
      console.error("Benchmark error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Upload File Verification
  const handleFileUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setActiveSource('upload');
    try {
      const localUrl = URL.createObjectURL(file);
      setAnnotatedImgUrl(localUrl);
      setViewMode('annotated');
    } catch (err) {}

    playGatewayTone('scan');
    setIsProcessing(true);
    try {
      const res = await verifyUpload(file);
      setAnalysisResult(res);
      if (res.annotated_image) {
        setAnnotatedImgUrl(normalizeImageDataUrl(res.annotated_image));
      }
      if (res.is_compliant) {
        playGatewayTone('granted');
        speakGatewayAnnouncement("Access allowed. Welcome to the workshop.");
        startGateCountdown(5);
      } else {
        playGatewayTone('denied');
        speakGatewayVerdict(res);
        setGateOpen(false);
      }
    } catch (err) {
      console.error("File upload error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Manual Gate Release (Supervisor / Operator Override)
  const handleManualGateRelease = async () => {
    try {
      playGatewayTone('granted');
      startGateCountdown(5);
      await toggleGate("OPEN");
    } catch (e) {
      // Hardware call fallback
    }
  };

  // Reset to Standby
  const handleResetStandby = () => {
    setAnalysisResult(null);
    setAnnotatedImgUrl(null);
    setViewMode('live');
    setGateOpen(false);
    setGateCountdown(null);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (!isCameraActive && activeSource === 'webcam') {
      startCamera();
    }
  };

  return (
    <div className="operator-station-suite animate-fadeIn">
      
      {/* 1. Station Status Bar */}
      <div className="operator-header-strip">
        <div className="operator-header-left">
          <div className="operator-title-row">
            <h1>Workshop Entrance Access Gateway</h1>
            <span className="operator-badge-live">GATE-01 ACTIVE</span>
          </div>
          <p className="operator-subtitle">
            Stand worker in front of the lens. Click <strong>SCAN WORKER</strong> to verify mandatory PPE.
          </p>
        </div>

        <div className="operator-header-telemetry">
          <div className="op-telemetry-item">
            <span className="op-tel-label">BARRIER SERVO</span>
            <span className={`op-tel-val ${gateOpen ? 'text-emerald' : 'text-slate'}`}>
              {gateOpen ? 'OPEN (90°)' : 'LOCKED (0°)'}
            </span>
          </div>
          <div className="op-telemetry-item">
            <span className="op-tel-label">BEACON</span>
            <span className={`op-tel-val ${analysisResult ? (analysisResult.is_compliant ? 'text-emerald' : 'text-crimson') : 'text-amber'}`}>
              {analysisResult ? (analysisResult.is_compliant ? 'GREEN' : 'RED') : 'STANDBY'}
            </span>
          </div>
          <div className="op-telemetry-item">
            <span className="op-tel-label">LATENCY</span>
            <span className="op-tel-val text-electric">
              {analysisResult?.inference_time_ms ? `${analysisResult.inference_time_ms}ms` : '<40ms'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main 2-Column Workstation Layout */}
      <div className="operator-grid-layout">
        
        {/* LEFT COLUMN: Worker Camera Viewport & Primary SCAN Bar */}
        <div className="operator-camera-card">
          
          {/* Streamlined Source Bar: Live Gate | Test Scenarios | File */}
          <div className="operator-source-bar">
            <button
              className={`op-source-btn ${activeSource === 'webcam' ? 'active' : ''}`}
              onClick={() => {
                setActiveSource('webcam');
                setViewMode('live');
                if (!isCameraActive) startCamera();
              }}
            >
              <Camera size={15} />
              <span>Live Gate Camera</span>
            </button>

            <button
              className={`op-source-btn ${activeSource === 'benchmarks' ? 'active' : ''}`}
              onClick={() => {
                setActiveSource('benchmarks');
                stopCamera();
                if (!selectedBenchmark && benchmarks.length > 0) {
                  handleRunBenchmark(benchmarks[0]);
                }
              }}
            >
              <Play size={15} />
              <span>Simulated Workers</span>
            </button>

            <button
              className={`op-source-btn ${activeSource === 'upload' ? 'active' : ''}`}
              onClick={() => {
                setActiveSource('upload');
                stopCamera();
                if (fileInputRef.current) fileInputRef.current.click();
              }}
            >
              <UploadCloud size={15} />
              <span>Inspect Photo</span>
            </button>

            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*"
              onChange={handleFileUpload}
            />
          </div>

          {/* Camera Viewfinder Screen */}
          <div className="operator-viewfinder">
            
            {/* Live Video Feed - Kept active for immediate frame grabs & zero-lag re-scans */}
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="op-view-video"
              style={{
                display: 'block',
                position: viewMode === 'annotated' && annotatedImgUrl ? 'absolute' : 'relative',
                opacity: viewMode === 'annotated' && annotatedImgUrl ? 0 : 1,
                zIndex: 1
              }}
            />

            {/* AI Annotated Scan Overlay Image */}
            {viewMode === 'annotated' && annotatedImgUrl && (
              <img 
                src={annotatedImgUrl} 
                alt="AI Annotated PPE Scan Result" 
                className="op-annotated-img"
                style={{ zIndex: 2 }}
              />
            )}

            {/* Camera Standby Screen (if webcam inactive) */}
            {!isCameraActive && activeSource === 'webcam' && (
              <div className="op-standby-overlay">
                <div className="op-standby-icon">
                  <Camera size={34} color="#FF5E14" />
                </div>
                <h3>Camera Standby</h3>
                <p>Allow camera permissions or click below to activate edge camera.</p>
                <button className="op-btn-start-camera" onClick={startCamera}>
                  <span>Activate Live Camera</span>
                </button>
              </div>
            )}

            {/* Worker Position Targeting HUD */}
            <div className="op-targeting-hud">
              <div className="hud-corner top-left"></div>
              <div className="hud-corner top-right"></div>
              <div className="hud-corner bottom-left"></div>
              <div className="hud-corner bottom-right"></div>
              <div className="hud-center-marker">
                <span className="hud-position-text">WORKER POSITION GUIDE</span>
              </div>
            </div>

            {/* Laser scanning sweep animation */}
            {isProcessing && (
              <div className="op-laser-scanner-line">
                <span className="op-laser-label">SCANNING WORKER PPE...</span>
              </div>
            )}

            {/* Top Viewport Header HUD */}
            <div className="op-view-top-hud">
              <div className="op-live-tag">
                <span className="op-live-dot"></span>
                <span>{activeSource === 'webcam' ? 'LIVE GATE FEED' : 'TEST SCENARIO'}</span>
              </div>

              {annotatedImgUrl && (
                <div className="op-view-toggle-capsule">
                  <button 
                    className={`op-view-toggle-btn ${viewMode === 'live' ? 'active' : ''}`}
                    onClick={() => setViewMode('live')}
                  >
                    Live Video
                  </button>
                  <button 
                    className={`op-view-toggle-btn ${viewMode === 'annotated' ? 'active' : ''}`}
                    onClick={() => setViewMode('annotated')}
                  >
                    AI Detections
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Quick Simulation Benchmark Shortcuts (When in Benchmark mode) */}
          {activeSource === 'benchmarks' && (
            <div className="op-quick-benchmarks-row">
              {benchmarks.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  className={`op-quick-scenario-btn ${selectedBenchmark === item.id ? 'active' : ''}`}
                  onClick={() => handleRunBenchmark(item)}
                >
                  <span className={`op-quick-dot ${item.expected === 'GRANTED' ? 'granted' : 'denied'}`}></span>
                  <span className="op-quick-name">{item.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* PRIMARY OPERATOR CONTROL BAR - High Visibility & Ease of Use */}
          <div className="operator-command-bar">
            
            {/* The Main SCAN Button: High-visibility, prominent, impossible to miss! */}
            <button 
              className={`op-main-scan-btn ${isProcessing ? 'scanning' : ''}`}
              onClick={handleCaptureVerify}
              disabled={isProcessing}
              title="Click or press Spacebar to scan worker"
            >
              <Zap size={22} className="op-scan-bolt" />
              <div className="op-scan-btn-text">
                <span className="op-scan-primary-title">
                  {isProcessing ? 'ANALYZING...' : 'SCAN WORKER'}
                </span>
                <span className="op-scan-hotkey-hint">TAP OR PRESS SPACEBAR</span>
              </div>
            </button>

            {/* Secondary Operational Actions */}
            <div className="op-secondary-controls">
              
              {/* Hands-Free Auto-Scan Mode */}
              <button 
                className={`op-aux-btn ${isContinuous ? 'active-continuous' : ''}`}
                onClick={toggleContinuous}
                title="Continuous auto-scanning every 2 seconds"
              >
                <RefreshCw size={16} className={isContinuous ? 'spin-icon' : ''} />
                <span>{isContinuous ? 'Auto ON' : 'Auto'}</span>
              </button>

              {/* Manual Gate Release (Override) */}
              <button 
                className={`op-aux-btn manual-gate ${gateOpen ? 'gate-is-open' : ''}`}
                onClick={handleManualGateRelease}
                title="Manually actuate barrier gate open for 5 seconds"
              >
                <Unlock size={16} />
                <span>Gate</span>
              </button>

              {/* Mobile Camera Flip Switcher */}
              {activeSource === 'webcam' && (
                <button 
                  className="op-aux-btn flip-btn"
                  onClick={flipCamera}
                  title="Flip Front / Rear Camera"
                >
                  <SwitchCamera size={16} />
                  <span>Flip</span>
                </button>
              )}

              {/* Reset Standby */}
              <button 
                className="op-aux-btn icon-btn"
                onClick={handleResetStandby}
                title="Clear and reset to Standby"
              >
                <RotateCcw size={16} />
              </button>
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: Gate Access Decision & Mandatory PPE Checklist */}
        <div className="operator-decision-card">
          
          {/* 1. DYNAMIC VERDICT BANNER */}
          {analysisResult ? (
            <div className={`op-verdict-box ${analysisResult.is_compliant ? 'granted' : 'denied'} animate-fadeIn`}>
              <div className="op-verdict-header">
                <div className="op-verdict-icon-box">
                  {analysisResult.is_compliant ? (
                    <CheckCircle2 size={32} strokeWidth={2.8} />
                  ) : (
                    <AlertTriangle size={32} strokeWidth={2.8} />
                  )}
                </div>

                <div className="op-verdict-title-col">
                  <span className="op-verdict-eyebrow">
                    {analysisResult.is_compliant ? 'GATE ACCESS AUTHORIZED' : 'GATE ACCESS RESTRICTED'}
                  </span>
                  <h2 className="op-verdict-main-title">
                    {analysisResult.is_compliant ? 'ACCESS ALLOWED' : 'ACCESS DENIED'}
                  </h2>
                </div>
              </div>

              <p className="op-verdict-desc">
                {analysisResult.is_compliant 
                  ? 'Access Allowed • Welcome to the Workshop! All mandatory safety gear verified.'
                  : 'PPE violation detected! Turnstile barrier locked. Instruct worker to equip missing safety gear.'}
              </p>

              {/* Sliding Marquee Ticker for Missing Items (When Denied) */}
              {!analysisResult.is_compliant && analysisResult.missing_items && analysisResult.missing_items.length > 0 && (
                <div className="op-sliding-ticker-track">
                  <div className="op-sliding-ticker-content">
                    <span>
                      ⛔ ACCESS DENIED • MISSING: {analysisResult.missing_items.map(i => i.toUpperCase()).join(' & ')} • PLEASE WEAR REQUIRED SAFETY GEAR TO ENTER • ⛔ ACCESS DENIED • MISSING: {analysisResult.missing_items.map(i => i.toUpperCase()).join(' & ')} • PLEASE WEAR REQUIRED SAFETY GEAR TO ENTER • 
                    </span>
                  </div>
                </div>
              )}

              {/* Specific Missing Gear Alert Pills (When Denied) */}
              {!analysisResult.is_compliant && analysisResult.missing_items && analysisResult.missing_items.length > 0 && (
                <div className="op-missing-items-wrap">
                  {analysisResult.missing_items.map((itemKey) => (
                    <div key={itemKey} className="op-missing-pill">
                      <AlertTriangle size={13} />
                      <span>MISSING: {itemKey.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Re-Scan Action button when denied */}
              {!analysisResult.is_compliant && (
                <button className="op-rescan-btn" onClick={handleReScan}>
                  <RotateCcw size={15} />
                  <span>Re-Scan Worker (Live)</span>
                </button>
              )}

              {/* Barrier Release Countdown Timer if Compliant */}
              {analysisResult.is_compliant && gateCountdown !== null && (
                <div className="op-gate-timer-box animate-fadeIn">
                  <Clock size={16} />
                  <span>Barrier open: auto-relocking in <strong>{gateCountdown}s</strong></span>
                </div>
              )}
            </div>
          ) : (
            <div className="op-verdict-box standby">
              <div className="op-verdict-header">
                <div className="op-verdict-icon-box standby">
                  <ShieldCheck size={32} color="#64748B" strokeWidth={2.5} />
                </div>
                <div className="op-verdict-title-col">
                  <span className="op-verdict-eyebrow">STANDBY INSPECTION MODE</span>
                  <h2 className="op-verdict-main-title">Ready for Worker</h2>
                </div>
              </div>
              <p className="op-verdict-desc">
                Worker step up to the yellow entrance marking. Click <strong>SCAN WORKER</strong> or press <strong>Spacebar</strong> to verify.
              </p>
            </div>
          )}

          {/* 2. MANDATORY GEAR CHECKLIST MATRIX */}
          <div className="op-checklist-card">
            <div className="op-checklist-header">
              <span className="op-checklist-title">MANDATORY SAFETY GEAR CHECKLIST</span>
              <span className="op-checklist-badge">OSHA 1926</span>
            </div>

            <div className="op-checklist-stack">
              {PPE_ITEMS_CATALOG.map((item) => {
                const isCompliant = analysisResult?.compliant_items?.includes(item.id);
                const isMissing = analysisResult?.missing_items?.includes(item.id);
                
                let stateClass = 'awaiting';
                let stateLabel = 'Awaiting';

                if (analysisResult) {
                  if (isCompliant) {
                    stateClass = 'verified';
                    stateLabel = 'VERIFIED';
                  } else if (isMissing) {
                    stateClass = 'missing';
                    stateLabel = 'MISSING';
                  } else {
                    stateClass = 'optional';
                    stateLabel = 'Optional';
                  }
                }

                return (
                  <div key={item.id} className={`op-gear-row ${stateClass}`}>
                    <div className="op-gear-icon-circle">
                      <HardHat size={17} />
                    </div>

                    <div className="op-gear-text">
                      <div className="op-gear-name-line">
                        <span className="op-gear-name">{item.label}</span>
                        {item.defaultReq && (
                          <span className="op-mandatory-pill">REQUIRED</span>
                        )}
                      </div>
                      <span className="op-gear-standard">{item.standard}</span>
                    </div>

                    <div className="op-gear-verdict">
                      <span className={`op-status-badge ${stateClass}`}>
                        {stateClass === 'verified' && <Check size={12} />}
                        {stateClass === 'missing' && <XIcon size={12} />}
                        <span>{stateLabel}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. PHYSICAL GATE & ARDUINO HARDWARE TELEMETRY STRIP */}
          <div className="op-hardware-strip">
            <div className="op-hw-box">
              <div className="op-hw-icon-col">
                {gateOpen ? <Unlock size={17} color="#10B981" /> : <Lock size={17} color="#64748B" />}
              </div>
              <div className="op-hw-info">
                <span className="op-hw-label">TURNSTILE BARRIER</span>
                <span className={`op-hw-status ${gateOpen ? 'open' : 'locked'}`}>
                  {gateOpen ? 'OPEN (90°)' : 'LOCKED (0°)'}
                </span>
              </div>
            </div>

            <div className="op-hw-box">
              <div className="op-hw-icon-col">
                <Radio size={17} color={analysisResult?.is_compliant ? '#10B981' : '#FF5E14'} />
              </div>
              <div className="op-hw-info">
                <span className="op-hw-label">BEACON STATUS</span>
                <span className="op-hw-status">
                  {analysisResult ? (analysisResult.is_compliant ? '🟢 GREEN BEACON' : '🔴 RED ALARM') : 'STANDBY'}
                </span>
              </div>
            </div>

            <div className="op-hw-box">
              <div className="op-hw-icon-col">
                <Volume2 size={17} color={analysisResult && !analysisResult.is_compliant ? '#EF4444' : '#64748B'} />
              </div>
              <div className="op-hw-info">
                <span className="op-hw-label">ALARM BUZZER</span>
                <span className="op-hw-status">
                  {analysisResult && !analysisResult.is_compliant ? 'ACTIVE (BEEP)' : 'SILENT'}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
