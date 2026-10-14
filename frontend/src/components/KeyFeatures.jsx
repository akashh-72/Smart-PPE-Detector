import React from 'react';
import { 
  Eye, 
  Cpu, 
  Layers, 
  ArrowRight,
  ShieldCheck,
  HardHat
} from 'lucide-react';

import keyFeaturesImg from '../assets/key-features.jpg';

export default function KeyFeatures({ onOpenScanner }) {
  const features = [
    {
      id: "edge-yolo",
      icon: <Eye size={26} color="#FFFFFF" strokeWidth={2.3} />,
      title: "Real-Time Edge YOLOv8 Inference (<40ms)",
      text: "Edge-optimized deep neural network performs sub-40ms spatial anatomical localization, detecting multiple PPE items simultaneously without thermal throttling."
    },
    {
      id: "gate-actuation",
      icon: <Cpu size={26} color="#FFFFFF" strokeWidth={2.3} />,
      title: "Automated Barrier Gate & Tri-Color LED Actuation",
      text: "Actuates physical servo turnstiles to 90° for authorized staff. Non-compliant attempts trigger immediate gate lockdown, amber/red LED beacons, and alert buzzer tones."
    },
    {
      id: "audit-archival",
      icon: <Layers size={26} color="#FFFFFF" strokeWidth={2.3} />,
      title: "Tamper-Proof Audit Trail & Snapshot Archival",
      text: "SQLite persistent database records every worker access event with timestamped snapshot captures, confidence metrics, and one-click regulatory CSV export."
    }
  ];

  return (
    <section className="skinive-features-section" id="key-features">
      {/* Background Decorative Ambient Elements */}
      <div className="features-ambient-backdrop">
        <div className="features-ambient-glow left"></div>
        <div className="features-ambient-glow right"></div>
        <svg className="features-bg-svg-lines" viewBox="0 0 1440 600" preserveAspectRatio="none">
          <path 
            d="M 0 180 Q 400 80 800 220 T 1440 140" 
            fill="none" 
            stroke="#FF5E14" 
            strokeWidth="1.2" 
            opacity="0.08" 
          />
          <path 
            d="M 0 320 Q 500 420 1000 260 T 1440 380" 
            fill="none" 
            stroke="#FF5E14" 
            strokeWidth="1.5" 
            opacity="0.05" 
          />
        </svg>
      </div>

      <div className="container relative-z">
        <div className="features-layout-grid">
          
          {/* Left Column: Consolidated High-Fidelity 3D Graphic Showcase */}
          <div className="features-phone-col">
            <div className="features-showcase-container">
              <img 
                src={keyFeaturesImg} 
                alt="SafeGuard AI Key Features - Smart Safety Station & Barrier Gate" 
                className="features-real-graphic-img"
              />
            </div>
          </div>

          {/* Right Column: Key Features Content */}
          <div className="features-content-col">
            <div className="features-header-wrap">
              <span className="features-kicker">Core Vision &amp; Access Capabilities</span>
              <h2 className="features-main-title">Key Features</h2>
            </div>

            <div className="features-rows-stack">
              {features.map((item) => (
                <div key={item.id} className="feature-row-item">
                  <div className="feature-squircle-icon">
                    {item.icon}
                  </div>
                  <div className="feature-row-text">
                    <h3 className="feature-row-headline">{item.title}</h3>
                    <p className="feature-row-paragraph">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="features-action-row">
              <button className="skinive-btn-pill-primary" onClick={onOpenScanner}>
                <span>Launch Interactive Scanner</span>
                <ArrowRight size={17} />
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
