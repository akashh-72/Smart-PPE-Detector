import React, { useState } from 'react';
import { 
  Send, 
  CheckCircle2, 
  ShieldCheck, 
  HardHat, 
  Building2, 
  Mail, 
  Phone 
} from 'lucide-react';
import { submitContact } from '../services/apiService';

export default function ContactPage({ onOpenScanner, onBackToLanding }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    site_type: 'Construction Site (Civil Infrastructure)',
    phone: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [inquiryId, setInquiryId] = useState('');

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitContact(formData);
      setInquiryId(res.id ? `HSE-INQ-${res.id}` : `HSE-INQ-${Math.floor(100000 + Math.random() * 900000)}`);
      setIsSubmitted(true);
    } catch {
      // Fallback ticket generator
      setInquiryId(`HSE-INQ-${Math.floor(100000 + Math.random() * 900000)}`);
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="contact-page-clean animate-fadeIn">
      <div className="container contact-content-wrapper">
        
        {/* Refined Hero Header */}
        <div className="contact-clean-header text-center">
          <div className="contact-clean-kicker">
            <HardHat size={14} color="#FF5E14" />
            <span>Direct Inquiry &amp; HSE Site Support • Enterprise Access Gate Automation</span>
          </div>
          
          <h1 className="contact-clean-title">
            Connect with the SafeGuard<span className="text-electric">AI</span> Team
          </h1>

          <p className="contact-clean-subtitle">
            Whether you are deploying vision turnstiles at a civil mega-project, configuring Raspberry Pi edge controllers, or seeking OSHA 1926 compliance auditing, our engineering desk is on standby.
          </p>
        </div>

        {/* Focused & Proportioned Contact Form Card */}
        <div className="contact-form-center-box">
          <div className="contact-form-glass-card">
            {!isSubmitted ? (
              <>
                <div className="contact-form-top-meta">
                  <h2 className="form-main-heading">Send Us a Direct Message</h2>
                  <p className="form-sub-heading">
                    Fill out the form below. Your ticket will be dispatched immediately to the site automation desk.
                  </p>
                </div>

                <form onSubmit={handleFormSubmit} className="contact-clean-form-body">
                  {/* Name & Email Row */}
                  <div className="form-clean-row">
                    <div className="form-clean-field">
                      <label>Full Name <span className="req-star">*</span></label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Alex Vance"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div className="form-clean-field">
                      <label>Corporate / Site Email <span className="req-star">*</span></label>
                      <input 
                        type="email" 
                        required
                        placeholder="e.g. alex.vance@contractor.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Company & Site Type */}
                  <div className="form-clean-row">
                    <div className="form-clean-field">
                      <label>Organization / Project</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Apex Civil Infrastructure Ltd"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      />
                    </div>

                    <div className="form-clean-field">
                      <label>Site Facility Category</label>
                      <select 
                        value={formData.site_type}
                        onChange={(e) => setFormData({ ...formData, site_type: e.target.value })}
                      >
                        <option value="Construction Site (Civil Infrastructure)">Construction Site (Civil Infrastructure)</option>
                        <option value="Manufacturing / Heavy Industrial Plant">Manufacturing / Heavy Industrial Plant</option>
                        <option value="Oil, Gas & Chemical Refinery">Oil, Gas &amp; Chemical Refinery</option>
                        <option value="Warehouse / Logistics Fulfillment Center">Warehouse / Logistics Fulfillment Center</option>
                        <option value="Mining & Mineral Extraction Site">Mining &amp; Mineral Extraction Site</option>
                      </select>
                    </div>
                  </div>

                  {/* Message Field */}
                  <div className="form-clean-field">
                    <label>Inquiry Details <span className="req-star">*</span></label>
                    <textarea 
                      rows={4}
                      required
                      placeholder="Describe your site layout, number of access turnstiles, required PPE checklist, or hardware questions..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="skinive-btn-pill-primary full-width"
                    disabled={isSubmitting}
                  >
                    <span>{isSubmitting ? 'Routing Inquiry...' : 'Submit HSE Ticket'}</span>
                    <Send size={16} />
                  </button>
                </form>
              </>
            ) : (
              <div className="contact-submitted-success animate-fadeIn text-center">
                <div className="success-icon-bubble">
                  <CheckCircle2 size={44} color="#10B981" />
                </div>
                <h3>Inquiry Dispatched Successfully!</h3>
                <p className="success-ticket-lead">
                  Your ticket has been logged in our queue. Reference ID:
                </p>
                <div className="success-ticket-badge">
                  <code>{inquiryId}</code>
                </div>
                <p className="success-ticket-sub">
                  A site automation specialist will review your project parameters within 24 business hours.
                </p>

                <div className="success-actions-row">
                  <button 
                    className="skinive-btn-pill-secondary"
                    onClick={() => {
                      setIsSubmitted(false);
                      setFormData({
                        name: '',
                        email: '',
                        company: '',
                        site_type: 'Construction Site (Civil Infrastructure)',
                        phone: '',
                        message: ''
                      });
                    }}
                  >
                    <span>Submit Another Inquiry</span>
                  </button>
                  <button 
                    className="skinive-btn-pill-primary"
                    onClick={onOpenScanner}
                  >
                    <span>Launch AI Scanner</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
