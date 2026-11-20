import React, { useState, useEffect } from 'react';
import { 
  HardHat, 
  Save, 
  RotateCcw, 
  CheckCircle2,
  ScanFace
} from 'lucide-react';
import { getConfig, updateConfig, resetHardware } from '../../../services/apiService';
import { PPE_ITEMS_CATALOG } from '../../../data/mockData';

export default function GearConfigTab() {
  const [requiredItems, setRequiredItems] = useState(['helmet', 'vest']);
  const [thresholds, setThresholds] = useState({
    helmet: 0.60,
    vest: 0.60,
    mask: 0.55,
    gloves: 0.55,
    shoes: 0.55
  });
  const [requireFaceAuth, setRequireFaceAuth] = useState(true);
  const [faceThreshold, setFaceThreshold] = useState(0.38);
  const [gateHoldDuration, setGateHoldDuration] = useState(5);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    getConfig()
      .then((data) => {
        if (data.required_items) setRequiredItems(data.required_items);
        if (data.thresholds) setThresholds((prev) => ({ ...prev, ...data.thresholds }));
        if (typeof data.require_face_auth === 'boolean') setRequireFaceAuth(data.require_face_auth);
        if (typeof data.face_threshold === 'number') setFaceThreshold(data.face_threshold);
      })
      .catch((err) => console.error("Error loading config:", err));
  }, []);

  const toggleItem = (itemId) => {
    setRequiredItems((prev) => {
      if (prev.includes(itemId)) {
        if (prev.length <= 1) {
          alert("At least one safety gear item must remain mandatory for access enforcement.");
          return prev;
        }
        return prev.filter((id) => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const handleThresholdChange = (key, val) => {
    setThresholds((prev) => ({ ...prev, [key]: parseFloat(val) }));
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setToastMsg('');
    try {
      await updateConfig({
        required_items: requiredItems,
        thresholds: thresholds,
        require_face_auth: requireFaceAuth,
        face_threshold: faceThreshold
      });
      setToastMsg('Safety & Biometric Face ID parameters updated and active on gateway.');
      setTimeout(() => setToastMsg(''), 3500);
    } catch (err) {
      alert("Failed to save configuration: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    setRequiredItems(['helmet', 'vest']);
    setThresholds({
      helmet: 0.60,
      vest: 0.60,
      mask: 0.55,
      gloves: 0.55,
      shoes: 0.55
    });
    setRequireFaceAuth(true);
    setFaceThreshold(0.38);
    setGateHoldDuration(5);
    try {
      await updateConfig({
        required_items: ['helmet', 'vest'],
        thresholds: { helmet: 0.60, vest: 0.60, mask: 0.55, gloves: 0.55, shoes: 0.55 },
        require_face_auth: true,
        face_threshold: 0.38
      });
      await resetHardware();
      setToastMsg('Gateway parameters and hardware reset to STANDBY defaults.');
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      console.warn("Reset error:", err);
    }
  };

  return (
    <div className="portal-config-suite animate-fadeIn">
      
      {/* Top Welcome Header */}
      <div className="portal-welcome-header">
        <div className="portal-welcome-left">
          <h1>Safety Gear &amp; Biometric Gateway Configuration</h1>
          <p>
            Dynamically customize mandatory PPE gear checklists, biometric face recognition enforcement, and neural confidence thresholds.
          </p>
        </div>

        <div className="portal-welcome-right-actions">
          <button 
            className="skinive-btn-pill-secondary"
            onClick={handleResetDefaults}
          >
            <RotateCcw size={15} />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="auth-clean-alert success animate-fadeIn" style={{ marginBottom: '1.5rem' }}>
          <CheckCircle2 size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      <form onSubmit={handleSaveConfig} className="config-form-layout">

        {/* 1. Biometric Face Authorization Policy */}
        <div className="config-card">
          <div className="card-header-row">
            <div>
              <span className="card-kicker">BIOMETRIC IDENTITY VERIFICATION</span>
              <h3 className="card-title">Worker Face Recognition Gate Check</h3>
            </div>
            <span className="config-active-count-tag">
              {requireFaceAuth ? 'BIOMETRIC ACTIVE' : 'PPE ONLY MODE'}
            </span>
          </div>

          <p className="config-section-desc">
            When enabled, the gate verifies both mandatory PPE gear AND checks that the worker&apos;s face matches an authorized profile in the Worker Directory.
          </p>

          <div className="config-toggles-grid">
            <div
              className={`config-toggle-item-card ${requireFaceAuth ? 'active' : ''}`}
              onClick={() => setRequireFaceAuth((prev) => !prev)}
              role="button"
              tabIndex={0}
            >
              <div className="toggle-card-top">
                <div className="toggle-icon-wrap">
                  <ScanFace size={20} color={requireFaceAuth ? '#FF5E14' : '#64748B'} />
                </div>
                <div className={`custom-switch ${requireFaceAuth ? 'on' : 'off'}`}>
                  <div className="switch-knob"></div>
                </div>
              </div>

              <div className="toggle-card-body">
                <span className="toggle-item-title">Require Authorized Worker Face ID</span>
                <span className="toggle-item-sub">128-D OpenCV YuNet + SFace Biometric Engine</span>
              </div>

              <span className={`toggle-policy-badge ${requireFaceAuth ? 'required' : 'optional'}`}>
                {requireFaceAuth ? 'BLOCK UNAUTHORIZED PERSONS' : 'BYPASS FACE CHECK'}
              </span>
            </div>
          </div>
        </div>
        
        {/* 2. Mandatory PPE Checklist Matrix */}
        <div className="config-card">
          <div className="card-header-row">
            <div>
              <span className="card-kicker">WORKPLACE ENTRANCE POLICY</span>
              <h3 className="card-title">Mandatory PPE Checklist</h3>
            </div>
            <span className="config-active-count-tag">
              {requiredItems.length} ITEMS MANDATORY
            </span>
          </div>

          <p className="config-section-desc">
            Toggle which safety items are strictly required to grant entrance through the barrier turnstile.
          </p>

          <div className="config-toggles-grid">
            {PPE_ITEMS_CATALOG.map((item) => {
              const isMandatory = requiredItems.includes(item.id);
              return (
                <div 
                  key={item.id}
                  className={`config-toggle-item-card ${isMandatory ? 'active' : ''}`}
                  onClick={() => toggleItem(item.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="toggle-card-top">
                    <div className="toggle-icon-wrap">
                      <HardHat size={20} color={isMandatory ? '#FF5E14' : '#64748B'} />
                    </div>
                    <div className={`custom-switch ${isMandatory ? 'on' : 'off'}`}>
                      <div className="switch-knob"></div>
                    </div>
                  </div>

                  <div className="toggle-card-body">
                    <span className="toggle-item-title">{item.label}</span>
                    <span className="toggle-item-sub">{item.standard}</span>
                  </div>

                  <span className={`toggle-policy-badge ${isMandatory ? 'required' : 'optional'}`}>
                    {isMandatory ? 'REQUIRED FOR GATE PASS' : 'OPTIONAL INSPECTION'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Neural Confidence Thresholds & Timing */}
        <div className="config-card">
          <div className="card-header-row">
            <div>
              <span className="card-kicker">EDGE NEURAL TUNING</span>
              <h3 className="card-title">Confidence Sliders &amp; Gate Hold Timing</h3>
            </div>
          </div>

          <p className="config-section-desc">
            Fine-tune minimum detection probabilities required before marking PPE or biometric identity compliant.
          </p>

          <div className="thresholds-sliders-stack">
            {/* Face Match Similarity Slider */}
            <div className="threshold-slider-row">
              <div className="slider-label-col">
                <strong>Face Recognition Cosine Threshold</strong>
                <span>SFace Biometric Strictness (0.38 recommended)</span>
              </div>

              <div className="slider-input-col">
                <input
                  type="range"
                  min="0.28"
                  max="0.60"
                  step="0.02"
                  value={faceThreshold}
                  onChange={(e) => setFaceThreshold(parseFloat(e.target.value))}
                  className="range-slider-control"
                />
              </div>

              <div className="slider-value-col">
                <span className="pct-badge">{faceThreshold.toFixed(2)}</span>
              </div>
            </div>

            {PPE_ITEMS_CATALOG.map((item) => {
              const currentVal = thresholds[item.id] !== undefined ? thresholds[item.id] : 0.60;
              const pct = Math.round(currentVal * 100);
              return (
                <div key={item.id} className="threshold-slider-row">
                  <div className="slider-label-col">
                    <strong>{item.label}</strong>
                    <span>Confidence Threshold</span>
                  </div>

                  <div className="slider-input-col">
                    <input 
                      type="range"
                      min="0.30"
                      max="0.95"
                      step="0.05"
                      value={currentVal}
                      onChange={(e) => handleThresholdChange(item.id, e.target.value)}
                      className="range-slider-control"
                    />
                  </div>

                  <div className="slider-value-col">
                    <span className="pct-badge">{pct}%</span>
                  </div>
                </div>
              );
            })}

            {/* Gate Open Duration */}
            <div className="threshold-slider-row duration-row">
              <div className="slider-label-col">
                <strong>Barrier Gate Hold Duration</strong>
                <span>Seconds arm remains upright at 90° before closing</span>
              </div>

              <div className="slider-input-col">
                <input 
                  type="range"
                  min="2"
                  max="15"
                  step="1"
                  value={gateHoldDuration}
                  onChange={(e) => setGateHoldDuration(parseInt(e.target.value))}
                  className="range-slider-control"
                />
              </div>

              <div className="slider-value-col">
                <span className="pct-badge amber">{gateHoldDuration}s</span>
              </div>
            </div>
          </div>

          {/* Form Save Submit Button */}
          <div className="config-submit-bar">
            <button 
              type="submit" 
              className="skinive-btn-pill-primary"
              disabled={isSaving}
            >
              <Save size={16} />
              <span>{isSaving ? 'Applying Settings...' : 'Save & Deploy Parameters'}</span>
            </button>
          </div>
        </div>

      </form>

    </div>
  );
}
