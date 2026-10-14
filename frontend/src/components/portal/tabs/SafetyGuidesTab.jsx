import React from 'react';
import { 
  ShieldCheck, 
  HardHat, 
  FileText, 
  AlertTriangle, 
  Cpu, 
  Camera, 
  Award,
  Layers
} from 'lucide-react';

export default function SafetyGuidesTab() {
  const guides = [
    {
      id: "osha-helmet",
      standard: "OSHA 1926.100 & EN 397",
      title: "Industrial Head Protection Standards",
      badge: "MANDATORY CLASS E / G",
      points: [
        "Headwear must feature Type I/II impact suspension clearance (minimum 25mm to 50mm crown gap).",
        "Shell must be free of hairline fractures, UV degradation, or unauthorized paint/chemical exposure.",
        "Chin strap must be fastened when working in areas subjected to wind shears or working at height above 2 meters.",
        "YOLOv8 vision system expects hard hat brim/apex clearly framed in top 20% of worker bounding box."
      ]
    },
    {
      id: "high-vis",
      standard: "EN ISO 20471 / ANSI 107",
      title: "High-Visibility Safety Apparel (HVSA)",
      badge: "CLASS 2 REFLECTIVE MINIMUM",
      points: [
        "Fluorescent background material must cover at least 0.50m² (Class 2) or 0.80m² (Class 3).",
        "Retroreflective bands must be at least 50mm in width and circle the torso and shoulders symmetrically.",
        "Vest must be fully zipped or velcroed closed; unfastened flaps are flagged non-compliant by spatial colorimetry.",
        "Color spectrum analysis calibrates for safety fluorescent yellow-green (510nm) and fluorescent orange-red (600nm)."
      ]
    },
    {
      id: "barrier-safety",
      standard: "ISO 13849 / EN 12453",
      title: "Motorized Turnstile Barrier Gate Protocols",
      badge: "AUTO-LOCKDOWN CORRIDOR",
      points: [
        "Servo actuator operates at 50Hz PWM frequency with 2.5% duty cycle (Closed) and 12.5% duty cycle (Open).",
        "Anti-pinch torque limiter prevents motorized gate from exceeding 150N impact force on pedestrian obstructions.",
        "Emergency fire alarm interface must cut power to servo coil, dropping barrier arms into free-swing egress mode.",
        "Tri-color LED beacon illuminates Red (Denied) and Green (Granted) for 5.0s standard pass clearance window."
      ]
    },
    {
      id: "camera-setup",
      standard: "EDGE VISION HARDWARE",
      title: "Camera Calibration & Illumination Specs",
      badge: "EDGE KIOSK SETUP",
      points: [
        "Mount optical lens at 1.70m - 1.90m height angled downwards at 10° to 15° towards the pedestrian approach line.",
        "Maintain diffuse illumination of at least 300 Lux at the turnstile threshold; avoid direct backlighting from sun glare.",
        "Worker must be positioned within 1.2m to 2.5m range from camera for optimal feature resolution (>250px torso).",
        "Raspberry Pi 4 deployment pinout: Green LED (BCM 17), Red LED (BCM 27), Buzzer (BCM 22), Servo PWM (BCM 18)."
      ]
    }
  ];

  return (
    <div className="portal-guides-suite animate-fadeIn">
      
      {/* Top Welcome Header */}
      <div className="portal-welcome-header">
        <div className="portal-welcome-left">
          <h1>Industrial Safety &amp; Access Protocols</h1>
          <p>
            Regulatory guidelines for OSHA 1926, EN 397, EN ISO 20471, and Raspberry Pi GPIO edge hardware wiring specifications.
          </p>
        </div>
      </div>

      {/* Guides Grid */}
      <div className="guides-cards-grid">
        {guides.map((item) => (
          <div key={item.id} className="safety-protocol-card">
            <div className="protocol-card-header">
              <span className="protocol-standard-tag">{item.standard}</span>
              <span className="protocol-badge-pill">{item.badge}</span>
            </div>

            <h3 className="protocol-title">{item.title}</h3>

            <div className="protocol-points-list">
              {item.points.map((pt, idx) => (
                <div key={idx} className="protocol-point-row">
                  <div className="point-bullet-bubble">
                    <ShieldCheck size={13} color="#FF5E14" />
                  </div>
                  <p>{pt}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
