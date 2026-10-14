import React, { useState } from 'react';
import { Play, Sparkles, X, ArrowRight, ShieldCheck, CheckCircle2, HardHat, Cpu, Eye, Lock } from 'lucide-react';
import demoBannerImg from '../assets/demo-banner.jpg';

export default function SmartAnalysisBanner({ onOpenScanner }) {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  return (
    <>
      <section className="skinive-analysis-banner-section" id="smart-analysis">
        <div className="container">
          
          {/* Section Header */}
          <div className="section-header text-center">
            <span className="skinive-section-eyebrow">
              <span className="eyebrow-pulse-dot"></span>
              <span>Automated Edge Verification, Operating 24/7</span>
            </span>
            <h2 className="skinive-section-title">
              Smart PPE Verification for <span className="text-electric">Zero-Breach Facilities</span>
            </h2>
            <p className="skinive-section-desc">
              Edge computer vision inspects mandatory protective equipment, actuates barrier turnstiles, and logs audit snapshots in one unified flow.
            </p>
          </div>

          {/* Large Wide Rounded Media Banner Card */}
          <div 
            className="analysis-media-card"
            onClick={() => setIsVideoModalOpen(true)}
            role="button"
            tabIndex={0}
            title="Click to explore interactive access pipeline"
          >
            <img 
              src={demoBannerImg} 
              alt="SafeGuard AI in Action - Modern Industrial Access Gateway and Edge Detection" 
              className="analysis-media-banner-img"
            />

            {/* Floating Play Overlay Badge */}
            <div className="media-play-overlay">
              <div className="media-play-bubble">
                <Play size={22} fill="#FF5E14" color="#FF5E14" />
              </div>
              <span className="media-play-label">Explore End-to-End Gateway Architecture</span>
            </div>
          </div>

        </div>
      </section>

      {/* Interactive Walkthrough Modal */}
      {isVideoModalOpen && (
        <div className="analysis-modal-backdrop" onClick={() => setIsVideoModalOpen(false)}>
          <div className="analysis-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div className="modal-title-col">
                <span className="skinive-section-eyebrow">Industrial Access Architecture</span>
                <h3 className="modal-title">SafeGuard AI End-to-End Verification Pipeline</h3>
              </div>
              <button 
                className="modal-close-btn"
                onClick={() => setIsVideoModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-video-viewport">
              <div className="demo-flow-presentation">
                <div className="flow-step-box">
                  <span className="step-num-pill">Step 1</span>
                  <h4>Optical Frame Capture</h4>
                  <p>Worker stands in front of the kiosk camera. Live video feed captures an uncompressed 1080p frame.</p>
                </div>
                <div className="flow-step-divider">→</div>
                <div className="flow-step-box">
                  <span className="step-num-pill">Step 2</span>
                  <h4>YOLOv8 Edge Inference</h4>
                  <p>ONNX neural network detects Helmet, Vest, Mask, Gloves, and Boots with spatial bounding box HUD in &lt;40ms.</p>
                </div>
                <div className="flow-step-divider">→</div>
                <div className="flow-step-box">
                  <span className="step-num-pill">Step 3</span>
                  <h4>Gate Actuation &amp; Ledger</h4>
                  <p>Servo turnstile opens 90°, Tri-color LED turns Green, and audit entry is stored with snapshot image in SQLite.</p>
                </div>
              </div>

              <div className="modal-cta-bar">
                <button 
                  className="skinive-btn-pill-primary"
                  onClick={() => {
                    setIsVideoModalOpen(false);
                    onOpenScanner();
                  }}
                >
                  <span>Launch Live Scanner Now</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
