import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  ShieldCheck, 
  HardHat, 
  Save, 
  RotateCcw, 
  Clock, 
  Volume2, 
  CheckCircle2, 
  AlertCircle 
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
  const [gateHoldDuration, setGateHoldDuration] = useState(5);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    getConfig()
      .then((data) => {
        if (data.required_items) setRequiredItems(data.required_items);
        if (data.thresholds) setThresholds((prev) => ({ ...prev, ...data.thresholds }));
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
        thresholds: thresholds
      });
      setToastMsg('Safety parameters successfully updated and active on gateway.');
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
    setGateHoldDuration(5);
    try {
      await resetHardware();
      setToastMsg('Hardware reset to STANDBY default state.');
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
          <h1>Safety Gear &amp; Gateway Configuration</h1>
          <p>
            Dynamically customize mandatory PPE gear checklists, neural network confidence thresholds, and barrier gate timing parameters.
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
        
        {/* 1. Mandatory PPE Checklist Matrix */}
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

        {/* 2. Neural Confidence Thresholds & Timing */}
        <div className="config-card">
          <div className="card-header-row">
            <div>
              <span className="card-kicker">EDGE YOLOv8 NEURAL TUNING</span>
              <h3 className="card-title">Confidence Sliders &amp; Gate Hold Timing</h3>
            </div>
          </div>

          <p className="config-section-desc">
            Fine-tune minimum detection probabilities required before marking an item compliant.
          </p>

          <div className="thresholds-sliders-stack">
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
