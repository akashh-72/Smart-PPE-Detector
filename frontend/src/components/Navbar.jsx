import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheck, 
  Menu, 
  X, 
  LogOut, 
  ArrowRight, 
  User, 
  HardHat, 
  Layers, 
  Cpu, 
  ChevronDown, 
  Sparkles, 
  Sliders,
  RotateCcw
} from 'lucide-react';

export default function Navbar({ 
  currentView, 
  setCurrentView, 
  user, 
  onOpenAuth, 
  onLogout, 
  onOpenScanner,
  onOpenPortalTab
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileMenuRef = useRef(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { label: 'Overview', target: '#hero' },
    { label: 'Safety Standards', target: '#audience' },
    { label: 'Key Features', target: '#key-features' },
    { label: 'How It Works', target: '#smart-analysis' },
    { label: 'FAQ', target: '#faq' },
    { label: 'Contact', action: 'contact' },
  ];

  const handleNavClick = (link) => {
    setMobileMenuOpen(false);
    if (link.action === 'contact' || link.label === 'Contact') {
      setCurrentView('contact');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (currentView !== 'landing') {
      setCurrentView('landing');
      setTimeout(() => {
        const el = document.querySelector(link.target);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 120);
    } else {
      const el = document.querySelector(link.target);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <div className="floating-nav-outer-container">
        <header className="skinive-pill-navbar">
          {/* Brand Logo - Circular Icon + Vibrant Text */}
          <div 
            className="skinive-pill-brand" 
            onClick={() => { setCurrentView('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            role="button"
            tabIndex={0}
          >
            <div className="skinive-circle-logo">
              <ShieldCheck size={20} color="#FFFFFF" strokeWidth={2.8} />
            </div>
            <span className="skinive-pill-brand-text">SafeGuard<span className="text-electric">AI</span></span>
          </div>

          {/* Clean Desktop Navigation Links */}
          <nav className="skinive-pill-links">
            {navLinks.map((link) => {
              const isContactActive = currentView === 'contact' && link.label === 'Contact';
              return (
                <button
                  key={link.label}
                  className={`skinive-pill-link-btn ${isContactActive ? 'active' : ''}`}
                  onClick={() => handleNavClick(link)}
                >
                  <span>{link.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action: User Profile Capsule & CTA Button */}
          <div className="skinive-pill-actions">
            {user ? (
              <div className="pro-user-capsule-wrapper" ref={profileMenuRef}>
                <div 
                  className={`pro-user-capsule ${profileDropdownOpen ? 'active' : ''}`}
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  role="button"
                  tabIndex={0}
                  aria-haspopup="true"
                  aria-expanded={profileDropdownOpen}
                  title="View Controller Menu"
                >
                  <div className="pro-user-avatar-circle">
                    <User size={15} color="#FFFFFF" strokeWidth={2.5} />
                  </div>
                  <div className="pro-user-text-col">
                    <span className="pro-user-name">{user.name || 'Safety Controller'}</span>
                    <span className="pro-user-role-badge">GATE-01 ADMIN</span>
                  </div>
                  <ChevronDown size={14} className={`pro-chevron ${profileDropdownOpen ? 'rotated' : ''}`} />
                </div>

                {/* Dropdown Menu */}
                {profileDropdownOpen && (
                  <div className="pro-dropdown-menu animate-fadeIn">
                    <div className="pro-dropdown-header">
                      <div className="pro-dropdown-avatar">
                        <User size={18} color="#FF5E14" />
                      </div>
                      <div className="pro-dropdown-meta">
                        <span className="pro-dropdown-name">{user.name || 'Safety Controller'}</span>
                        <span className="pro-dropdown-email">{user.email}</span>
                      </div>
                    </div>

                    <div className="pro-dropdown-divider"></div>

                    <button 
                      className="pro-dropdown-item"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onOpenScanner();
                      }}
                    >
                      <HardHat size={16} color="#FF5E14" />
                      <span>Live Vision Gateway</span>
                    </button>

                    <button 
                      className="pro-dropdown-item"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        if (onOpenPortalTab) onOpenPortalTab('hardware');
                        else onOpenScanner();
                      }}
                    >
                      <Cpu size={16} color="#10B981" />
                      <span>Hardware Digital Twin</span>
                    </button>

                    <button 
                      className="pro-dropdown-item"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        if (onOpenPortalTab) onOpenPortalTab('logs');
                        else onOpenScanner();
                      }}
                    >
                      <Layers size={16} color="#3B82F6" />
                      <span>Access Audit Ledger</span>
                    </button>

                    <button 
                      className="pro-dropdown-item"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        if (onOpenPortalTab) onOpenPortalTab('settings');
                        else onOpenScanner();
                      }}
                    >
                      <Sliders size={16} color="#8B5CF6" />
                      <span>Safety Gear Thresholds</span>
                    </button>

                    <div className="pro-dropdown-divider"></div>

                    <button 
                      className="pro-dropdown-item danger"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onLogout();
                      }}
                    >
                      <LogOut size={16} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="guest-nav-actions">
                <button 
                  className="guest-login-btn"
                  onClick={() => onOpenAuth('signin')}
                >
                  <span>Sign In</span>
                </button>
              </div>
            )}

            {/* Primary Action Button */}
            <button 
              className="skinive-btn-pill-primary nav-main-cta"
              onClick={onOpenScanner}
              id="nav-launch-scanner-btn"
            >
              <span className="nav-cta-text-full">{user ? 'Open Workstation' : 'Launch AI Scanner'}</span>
              <span className="nav-cta-text-mobile">{user ? 'Workstation' : 'Scan'}</span>
              <ArrowRight size={15} />
            </button>

            {/* Mobile Hamburger Button */}
            <button 
              className="skinive-mobile-toggle-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="skinive-mobile-drawer animate-fadeIn">
            <nav className="mobile-drawer-links">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  className="mobile-drawer-link"
                  onClick={() => handleNavClick(link)}
                >
                  <span>{link.label}</span>
                </button>
              ))}

              <div className="mobile-drawer-divider"></div>

              {user ? (
                <>
                  <div className="mobile-user-info-card">
                    <User size={18} color="#FF5E14" />
                    <div>
                      <strong>{user.name}</strong>
                      <p>{user.email}</p>
                    </div>
                  </div>
                  <button 
                    className="skinive-btn-pill-primary full-width"
                    onClick={() => { setMobileMenuOpen(false); onOpenScanner(); }}
                  >
                    <span>Open Workstation Portal</span>
                    <ArrowRight size={16} />
                  </button>
                  <button 
                    className="mobile-drawer-logout-btn"
                    onClick={() => { setMobileMenuOpen(false); onLogout(); }}
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <div className="mobile-guest-buttons">
                  <button 
                    className="skinive-btn-pill-secondary full-width"
                    onClick={() => { setMobileMenuOpen(false); onOpenAuth('signin'); }}
                  >
                    <span>Sign In</span>
                  </button>
                  <button 
                    className="skinive-btn-pill-primary full-width"
                    onClick={() => { setMobileMenuOpen(false); onOpenScanner(); }}
                  >
                    <span>Launch AI Scanner</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </>
  );
}
