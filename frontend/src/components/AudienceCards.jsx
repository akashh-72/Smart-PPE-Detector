import React from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  Layers, 
  ArrowRight, 
  Lock, 
  Award,
  HardHat
} from 'lucide-react';

export default function AudienceCards({ onOpenScanner, onOpenPortalTab }) {
  const cards = [
    {
      id: "turnstiles",
      tag: "CONSTRUCTION SITES & PLANTS",
      title: "Automated Gate Barriers",
      description: "Real-time physical turnstile barrier gate release with automated tri-color LED beacon and 16x2 LCD status feedback.",
      bgClass: "card-gradient-amber",
      iconColor: "#FF5E14",
      icon: <ShieldCheck size={28} color="#FF5E14" strokeWidth={2.4} />,
      action: onOpenScanner,
      btnText: "Launch Access Scanner"
    },
    {
      id: "hardware",
      tag: "EDGE HARDWARE & RASPBERRY PI",
      title: "Digital Twin Simulation",
      description: "Live interactive simulation of SG90 / MG996R servo barrier arm, alert buzzer, and tri-color LEDs over WebSockets.",
      bgClass: "card-gradient-orange",
      iconColor: "#EA580C",
      icon: <Cpu size={28} color="#EA580C" strokeWidth={2.4} />,
      action: () => onOpenPortalTab ? onOpenPortalTab('hardware') : onOpenScanner(),
      btnText: "Hardware Digital Twin"
    },
    {
      id: "ledger",
      tag: "HSE AUDIT & REGULATORY COMPLIANCE",
      title: "Tamper-Proof Audit Ledger",
      description: "Permanent SQLite audit trail with worker snapshots, compliance scores, missing item logs, and one-click CSV export.",
      bgClass: "card-gradient-slate",
      iconColor: "#059669",
      icon: <Layers size={28} color="#059669" strokeWidth={2.4} />,
      action: () => onOpenPortalTab ? onOpenPortalTab('logs') : onOpenScanner(),
      btnText: "Access Audit Ledger"
    }
  ];

  return (
    <section className="skinive-audience-section" id="audience">
      <div className="container">
        
        {/* Header Row: Title on Left, Regulatory Trust Badges on Right */}
        <div className="audience-header-row">
          <div className="audience-header-left">
            <span className="audience-eyebrow">Safety Technology for Industrial Operations</span>
            <h2 className="audience-title">Universal AI Safety Vision</h2>
          </div>

          <div className="audience-header-right">
            {/* Regulatory Compliance Badges */}
            <div className="regulatory-badges-group">
              {/* CE Mark */}
              <div className="reg-badge ce-badge">
                <span className="ce-symbol">CE</span>
              </div>

              {/* OSHA Compliant */}
              <div className="reg-badge gdpr-badge">
                <div className="gdpr-star-ring">
                  <ShieldCheck size={14} className="gdpr-lock-icon" />
                </div>
                <div className="gdpr-text-col">
                  <span className="gdpr-title">OSHA 1926</span>
                  <span className="gdpr-sub">PPE COMPLIANT</span>
                </div>
              </div>

              {/* ISO 45001 */}
              <div className="reg-badge iso-badge">
                <div className="iso-check-icon">
                  <Award size={15} />
                </div>
                <div className="iso-text-col">
                  <span className="iso-title">ISO 45001</span>
                  <span className="iso-sub">OH&amp;S STANDARD</span>
                </div>
              </div>
            </div>

            <p className="regulatory-compliance-subtext">
              SafeGuard AI is engineered to meet OSHA 1926.100, EN 397 (Hard Hats), and EN ISO 20471 (High-Vis Vests) industrial safety access protocols.
            </p>
          </div>
        </div>

        {/* 3 High-Contrast Rounded Squircle Cards */}
        <div className="audience-squircles-grid">
          {cards.map((c) => (
            <div 
              key={c.id} 
              className={`audience-squircle-card ${c.bgClass}`}
              onClick={c.action}
              role="button"
              tabIndex={0}
            >
              <div className="squircle-card-content">
                {/* White Rounded Squircle Icon Box */}
                <div className="squircle-icon-box">
                  {c.icon}
                </div>

                <div className="squircle-body">
                  <span className="squircle-badge-tag">{c.tag}</span>
                  <h3 className="squircle-title">{c.title}</h3>
                  <p className="squircle-desc">{c.description}</p>
                </div>

                {/* Bottom Action Arrow */}
                <div className="squircle-footer">
                  <span className="squircle-action-hint">{c.btnText}</span>
                  <div className="squircle-arrow-bubble">
                    <ArrowRight size={18} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
