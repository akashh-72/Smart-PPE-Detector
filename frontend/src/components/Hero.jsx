import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Play, 
  Star, 
  ShieldCheck, 
  HardHat, 
  Activity, 
  CheckCircle2, 
  Sparkles,
  Lock
} from 'lucide-react';

import hero1 from '../assets/hero1.jpg';
import hero2 from '../assets/hero2.jpg';
import hero3 from '../assets/hero3.jpg';

const HERO_CASES = [
  {
    id: 'compliant-worker',
    image: hero1,
    name: 'Full PPE Compliant Worker',
    category: 'Turnstile Access Point',
    status: 'ACCESS GRANTED',
    badgeClass: 'badge-success',
    confidence: '99.4%',
    description: 'Enforces Hard Hat (EN 397), High-Vis Class 2 Vest, Protective Eyewear and Work Gloves before barrier actuation.'
  },
  {
    id: 'vision-hud',
    image: hero2,
    name: 'Real-Time Edge YOLOv8 HUD',
    category: 'Computer Vision Inference',
    status: 'SPATIAL TELEMETRY',
    badgeClass: 'badge-primary',
    confidence: '98.9%',
    description: 'Sub-40ms spatial anatomical localization detecting multiple gear classes simultaneously with zero cloud latency.'
  },
  {
    id: 'smart-barrier',
    image: hero3,
    name: 'Automated Hardware Barrier Gate',
    category: 'Digital Twin & Physical Actuator',
    status: 'SERVO OPEN 90°',
    badgeClass: 'badge-success',
    confidence: '100%',
    description: 'Tri-color LED indicator beacon, 16x2 I2C feedback display, and timed servo gate pass release cycle.'
  }
];

export default function Hero({ onOpenScanner, onExploreDemo }) {
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0);

  // Auto-slide every 3.8s with smooth fade
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentCaseIndex((prev) => (prev + 1) % HERO_CASES.length);
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  const activeCase = HERO_CASES[currentCaseIndex];

  return (
    <section className="skinive-hero-section" id="hero">
      <div className="container skinive-hero-container">
        
        {/* Left Column: Bold Typography & Actions */}
        <div className="skinive-hero-left">
          <div className="skinive-hero-eyebrow">
            <span className="eyebrow-pulse-dot"></span>
            <span>EDGE COMPUTER VISION &amp; GATE AUTOMATION</span>
          </div>

          <h1 className="skinive-hero-title">
            AI PPE ACCESS<br />GATEWAY
          </h1>

          <p className="skinive-hero-subtitle">
            Enforce real-time industrial safety compliance before granting entrance. Edge YOLOv8 neural network verifies Hard Hats, High-Vis Vests, Face Masks, Gloves, and Steel-Toe Boots with sub-40ms automated barrier gate actuation.
          </p>

          <div className="skinive-hero-cta-row">
            <button 
              className="skinive-btn-pill-primary"
              onClick={onOpenScanner}
              id="hero-start-scan-btn"
            >
              <span>Launch Live Gateway</span>
              <ArrowRight size={18} />
            </button>

            <button 
              className="skinive-btn-pill-secondary"
              onClick={onExploreDemo}
              id="hero-watch-demo-btn"
            >
              <div className="play-icon-circle">
                <Play size={13} fill="#FF5E14" />
              </div>
              <span>EXPLORE PIPELINE</span>
            </button>
          </div>

          {/* Bottom Floating Stats Cards */}
          <div className="skinive-hero-stats-cards">
            <div className="skinive-stat-card">
              <span className="stat-card-number">99.4%</span>
              <span className="stat-card-label">Detection precision score</span>
            </div>

            <div className="skinive-stat-card">
              <div className="stat-card-rating-row">
                <span className="stat-card-number">4.9</span>
                <div className="rating-stars">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={15} fill="#FF9500" color="#FF9500" />
                  ))}
                </div>
              </div>
              <span className="stat-card-label">Industrial safety audit rating</span>
            </div>
          </div>
        </div>

        {/* Right Column: Borderless High-Fidelity Diagnostic Screen with Auto-Slide Smooth Fade */}
        <div className="skinive-hero-right">
          <div className="hero-stage-card-wrapper">
            <div className="hero-showcase-frame">
              {HERO_CASES.map((item, index) => {
                const isActive = index === currentCaseIndex;
                return (
                  <img 
                    key={item.id}
                    src={item.image} 
                    alt={`${item.name} - SafeGuard AI Access System`}
                    className={`hero-showcase-img ${isActive ? 'active' : ''}`}
                    aria-hidden={!isActive}
                  />
                );
              })}

              {/* Floating Glassmorphic Status Overlay Card */}
              <div className="hero-glass-floating-card animate-fadeIn">
                <div className="hero-glass-card-top">
                  <div className="glass-status-pill">
                    <span className="status-dot-active"></span>
                    <span>{activeCase.status}</span>
                  </div>
                  <span className="glass-confidence-badge">{activeCase.confidence}</span>
                </div>

                <div className="hero-glass-card-body">
                  <h4 className="glass-card-title">{activeCase.name}</h4>
                  <p className="glass-card-desc">{activeCase.description}</p>
                </div>

                <div className="hero-glass-card-bottom">
                  <span className="glass-meta-tag">{activeCase.category}</span>
                  <div className="hero-slide-indicators">
                    {HERO_CASES.map((_, i) => (
                      <span 
                        key={i} 
                        className={`slide-dot ${i === currentCaseIndex ? 'active' : ''}`}
                        onClick={() => setCurrentCaseIndex(i)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
