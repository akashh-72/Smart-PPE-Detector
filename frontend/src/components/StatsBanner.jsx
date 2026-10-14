import React from 'react';
import { Activity, Clock, ShieldAlert, Cpu, CheckCircle2 } from 'lucide-react';

export default function StatsBanner({ onOpenScanner }) {
  const stats = [
    { value: "98.72%", label: "COMPLIANCE PASS RATE", detail: "Zero unauthorized gate entries" },
    { value: "482,104", label: "HARD HAT VERIFIED", detail: "EN 397 headgear confirmed" },
    { value: "519,830", label: "HIGH-VIS VEST CHECKS", detail: "EN ISO 20471 reflective gear" },
    { value: "14,892", label: "BREACHES BLOCKED", detail: "Immediate barrier lock & alert" },
    { value: "<38ms", label: "EDGE INFERENCE", detail: "Ultra-low latency gate cycle" }
  ];

  return (
    <section className="skinive-stats-banner-section" id="statistics">
      <div className="container">
        <div className="skinive-stats-card-shell">
          
          {/* Subtle Dynamic Neural Wave Vectors in Background */}
          <div className="stats-card-bg-waves">
            <svg viewBox="0 0 1200 400" preserveAspectRatio="none" className="bg-waves-svg">
              <path 
                d="M 0 120 Q 300 40 600 130 T 1200 80" 
                fill="none" 
                stroke="#FFFFFF" 
                strokeWidth="1.2" 
                opacity="0.16" 
              />
              <path 
                d="M 0 200 Q 350 290 700 160 T 1200 240" 
                fill="none" 
                stroke="#FFFFFF" 
                strokeWidth="1.5" 
                opacity="0.12" 
              />
              <path 
                d="M 0 80 Q 400 180 800 60 T 1200 140" 
                fill="none" 
                stroke="#FFFFFF" 
                strokeWidth="0.9" 
                opacity="0.2" 
              />
            </svg>
          </div>

          {/* Top Row: Heading on Left, Glass Stat Box on Right */}
          <div className="stats-card-top-row">
            <div className="stats-card-title-col">
              <span className="stats-card-eyebrow">SafeGuard AI Industrial Analytics</span>
              <h2 className="stats-card-heading">
                Gate Entrances and Safety Compliance Indicators
              </h2>
            </div>

            <div className="stats-card-glass-counter">
              <div className="counter-inner">
                <span className="counter-big-number">1,248,900+</span>
                <span className="counter-sub-label">Worker safety scans completed</span>
                <div className="counter-timestamp-pill">
                  <span className="timestamp-dot"></span>
                  <span>Edge Synced • Live telemetry</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: 5 Metric Columns */}
          <div className="stats-metrics-strip">
            {stats.map((s, idx) => (
              <div key={idx} className="metric-strip-item">
                <span className="metric-strip-value">{s.value}</span>
                <span className="metric-strip-label">{s.label}</span>
                <span className="metric-strip-detail">{s.detail}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
