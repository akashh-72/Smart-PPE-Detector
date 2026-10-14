import React from 'react';
import { ShieldCheck, ArrowUp, Mail, Smartphone, Lock, HardHat, Cpu } from 'lucide-react';

export default function Footer({ onOpenScanner, onOpenPortalTab, onOpenContact }) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="skinive-clean-light-footer">
      <div className="container">
        
        {/* Safety Notice Capsule Bar */}
        <div className="clean-medical-notice-capsule">
          <div className="clean-shield-icon-bubble">
            <ShieldCheck size={22} color="#FF5E14" strokeWidth={2.4} />
          </div>
          <p className="clean-notice-text">
            <strong>Industrial Safety Notice:</strong> SafeGuard AI is an automated PPE compliance verification and physical access control gateway designed to support HSE workplace safety enforcement. Always maintain physical emergency egress corridors and manual emergency override switches at all barrier gates.
          </p>
        </div>

        {/* 4-Column Clean Modern Footer Grid */}
        <div className="clean-footer-grid">
          {/* Brand Col */}
          <div className="clean-footer-col brand-col">
            <div className="clean-footer-brand-wrap" onClick={scrollToTop} role="button" tabIndex={0}>
              <div className="clean-footer-circle-logo">
                <ShieldCheck size={20} color="#FFFFFF" strokeWidth={2.8} />
              </div>
              <span className="clean-footer-brand-title">SafeGuard<span className="text-electric">AI</span></span>
            </div>
            <p className="clean-footer-tagline">
              Industrial edge computer vision access control and automated barrier gate actuation for civil construction and manufacturing plants.
            </p>
            <div className="clean-footer-trust-tags">
              <span className="trust-pill"><Lock size={12} /> OSHA 1926 Compliant</span>
              <span className="trust-pill">ISO 45001 Standard</span>
            </div>
          </div>

          {/* Platform Links */}
          <div className="clean-footer-col">
            <h4 className="clean-footer-heading">Platform</h4>
            <ul className="clean-footer-links-list">
              <li><button onClick={onOpenScanner} className="clean-footer-link-btn">Launch AI Scanner</button></li>
              <li><button onClick={() => onOpenPortalTab ? onOpenPortalTab('hardware') : onOpenScanner()} className="clean-footer-link-btn">Digital Twin Simulator</button></li>
              <li><button onClick={() => onOpenPortalTab ? onOpenPortalTab('logs') : onOpenScanner()} className="clean-footer-link-btn">Audit Ledger</button></li>
              <li><a href="#key-features" className="clean-footer-link-btn">Core Features</a></li>
            </ul>
          </div>

          {/* Gate Automation */}
          <div className="clean-footer-col">
            <h4 className="clean-footer-heading">Edge Deployment</h4>
            <ul className="clean-footer-links-list">
              <li><button onClick={onOpenScanner} className="clean-footer-link-btn">Live Kiosk Station</button></li>
              <li><button onClick={() => onOpenPortalTab ? onOpenPortalTab('hardware') : onOpenScanner()} className="clean-footer-link-btn">Raspberry Pi 4 GPIO</button></li>
              <li><button onClick={() => onOpenPortalTab ? onOpenPortalTab('settings') : onOpenScanner()} className="clean-footer-link-btn">Safety Gear Config</button></li>
              <li><a href="#faq" className="clean-footer-link-btn">Technical FAQ</a></li>
            </ul>
          </div>

          {/* Direct Support */}
          <div className="clean-footer-col">
            <h4 className="clean-footer-heading">Site Operations</h4>
            <ul className="clean-footer-links-list">
              <li><button onClick={onOpenContact} className="clean-footer-link-btn" style={{ color: '#FF5E14', fontWeight: 600 }}>Contact Safety Desk →</button></li>
              <li><span className="clean-footer-contact-item"><Mail size={14} color="#FF5E14" /> hse@safeguard-ai.internal</span></li>
              <li><span className="clean-footer-contact-item"><Smartphone size={14} color="#FF5E14" /> +1 (800) 555-SAFE</span></li>
              <li><span className="clean-footer-meta-pill">Gate Cycle Time &lt; 40ms</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar with Rounded Back-to-Top Button */}
        <div className="clean-footer-bottom-bar">
          <p className="clean-footer-copyright">
            © 2026 SafeGuard AI Platform. Real-Time Computer Vision PPE Access Control &amp; Gate Automation.
          </p>

          <button 
            className="clean-back-to-top-circle-btn"
            onClick={scrollToTop}
            title="Scroll back to top"
            aria-label="Back to Top"
          >
            <span>Back to Top</span>
            <ArrowUp size={15} />
          </button>
        </div>

      </div>
    </footer>
  );
}
