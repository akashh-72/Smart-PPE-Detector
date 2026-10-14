import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Cpu, 
  Layers, 
  Sliders, 
  UserCheck, 
  FileText, 
  ShieldCheck, 
  LogOut, 
  ChevronDown, 
  ArrowLeft,
  Menu,
  X,
  User,
  MoreHorizontal,
  Wrench
} from 'lucide-react';
import ScannerTab from './tabs/ScannerTab';
import HardwareTwinTab from './tabs/HardwareTwinTab';
import AuditLogsTab from './tabs/AuditLogsTab';
import GearConfigTab from './tabs/GearConfigTab';
import StaffDirectoryTab from './tabs/StaffDirectoryTab';
import SafetyGuidesTab from './tabs/SafetyGuidesTab';

export default function PortalLayout({ 
  user, 
  onLogout, 
  onBackToLanding, 
  initialTab = 'scanner',
  onTabChange
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const profileMenuRef = useRef(null);
  const moreMenuRef = useRef(null);

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Click outside listener for dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setMoreDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    if (onTabChange) onTabChange(tabId);
    setProfileDropdownOpen(false);
    setMoreDropdownOpen(false);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 3 Primary Operational Views for Entrance Gate Operator
  const primaryTabs = [
    { id: 'scanner', label: 'Gate Scanner', icon: <Camera size={16} /> },
    { id: 'logs', label: 'Access Ledger', icon: <Layers size={16} /> },
    { id: 'hardware', label: 'Digital Twin', icon: <Cpu size={16} /> },
  ];

  // Secondary Administrative & Configuration Tools (tucked into dropdown to prevent clutter)
  const secondaryTabs = [
    { id: 'settings', label: 'Gear Thresholds', icon: <Sliders size={15} /> },
    { id: 'staff', label: 'Staff Directory', icon: <UserCheck size={15} /> },
    { id: 'guides', label: 'Safety Guidelines', icon: <FileText size={15} /> },
  ];

  const isSecondaryActive = secondaryTabs.some(t => t.id === activeTab);
  const currentSecondaryTab = secondaryTabs.find(t => t.id === activeTab);

  return (
    <div className="portal-suite-root">
      
      {/* 1. Sleek, Uncluttered Industrial Pill Navbar */}
      <div className="portal-floating-nav-wrapper">
        <header className="portal-pill-navbar">
          
          {/* Brand & Entrance Station Identity */}
          <div 
            className="portal-brand-pill"
            onClick={onBackToLanding}
            title="Return to Public Landing Page"
            role="button"
            tabIndex={0}
          >
            <div className="portal-brand-icon">
              <ShieldCheck size={18} strokeWidth={2.8} />
            </div>
            <div className="portal-brand-text-col">
              <span className="portal-brand-title">SafeGuard<span className="text-electric">AI</span></span>
            </div>
            <div className="portal-station-pill">
              <span className="portal-station-beacon"></span>
              <span className="portal-station-text">GATE-01 WORKSHOP</span>
            </div>
          </div>

          {/* Clean, Focused Primary Navigation Tabs */}
          <nav className="portal-nav-links">
            {primaryTabs.map((t) => (
              <button
                key={t.id}
                className={`portal-tab-btn ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => handleSelectTab(t.id)}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}

            {/* Admin & System Tools Dropdown */}
            <div className="portal-more-tools-wrapper" ref={moreMenuRef}>
              <button
                className={`portal-tab-btn more-btn ${isSecondaryActive ? 'active' : ''}`}
                onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
                title="System Settings & Admin Tools"
              >
                <Wrench size={15} />
                <span>{isSecondaryActive ? currentSecondaryTab?.label : 'Tools'}</span>
                <ChevronDown size={13} className={`portal-chevron ${moreDropdownOpen ? 'rotated' : ''}`} />
              </button>

              {moreDropdownOpen && (
                <div className="portal-more-dropdown animate-fadeIn">
                  <div className="portal-more-dropdown-header">
                    <span>Admin &amp; Configuration</span>
                  </div>
                  {secondaryTabs.map((t) => (
                    <button
                      key={t.id}
                      className={`portal-more-dropdown-item ${activeTab === t.id ? 'active' : ''}`}
                      onClick={() => handleSelectTab(t.id)}
                    >
                      {t.icon}
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Right Action: Operator Profile & Exit */}
          <div className="portal-right-actions">
            <div className="portal-user-capsule-wrapper" ref={profileMenuRef}>
              <div 
                className="portal-user-capsule"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                role="button"
                tabIndex={0}
                title="Operator Account"
              >
                <div className="portal-user-avatar">
                  <User size={14} color="#FFFFFF" strokeWidth={2.5} />
                </div>
                <div className="portal-user-meta-col">
                  <span className="portal-user-name">{user?.name || 'Gate Operator'}</span>
                  <span className="portal-user-role-badge">OPERATOR</span>
                </div>
                <ChevronDown size={13} className={`portal-chevron ${profileDropdownOpen ? 'rotated' : ''}`} />
              </div>

              {profileDropdownOpen && (
                <div className="portal-dropdown-menu animate-fadeIn">
                  <div className="portal-dropdown-header">
                    <span className="portal-dropdown-title">{user?.name || 'Gate Operator'}</span>
                    <span className="portal-dropdown-email">{user?.email || 'operator@safeguard.ai'}</span>
                    <span className="portal-dropdown-role">HSE Workshop Access Controller</span>
                  </div>

                  <div className="portal-dropdown-divider"></div>

                  <button 
                    className="portal-dropdown-item"
                    onClick={onBackToLanding}
                  >
                    <ArrowLeft size={15} />
                    <span>Return to Site Overview</span>
                  </button>

                  <div className="portal-dropdown-divider"></div>

                  <button 
                    className="portal-dropdown-item danger"
                    onClick={onLogout}
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>

            <button 
              className="portal-exit-site-btn"
              onClick={onBackToLanding}
              title="Return to Main Website"
            >
              <ArrowLeft size={15} />
              <span>Exit</span>
            </button>

            {/* Mobile Hamburger Button */}
            <button 
              className="portal-mobile-toggle-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Portal Menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="portal-mobile-drawer animate-fadeIn">
            <nav className="portal-mobile-links-list">
              <div className="portal-mobile-section-label">Operational Station</div>
              {primaryTabs.map((t) => (
                <button
                  key={t.id}
                  className={`portal-mobile-link ${activeTab === t.id ? 'active' : ''}`}
                  onClick={() => handleSelectTab(t.id)}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}

              <div className="portal-mobile-divider"></div>
              <div className="portal-mobile-section-label">Configuration &amp; Records</div>
              {secondaryTabs.map((t) => (
                <button
                  key={t.id}
                  className={`portal-mobile-link ${activeTab === t.id ? 'active' : ''}`}
                  onClick={() => handleSelectTab(t.id)}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}

              <div className="portal-mobile-divider"></div>

              <button 
                className="portal-mobile-link"
                onClick={onBackToLanding}
              >
                <ArrowLeft size={16} />
                <span>Return to Main Website</span>
              </button>

              <button 
                className="portal-mobile-link danger"
                onClick={onLogout}
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* 2. Main Workstation Body View */}
      <main className="portal-main-content container">
        {activeTab === 'scanner' && (
          <ScannerTab onNavigateTab={handleSelectTab} />
        )}
        {activeTab === 'hardware' && (
          <HardwareTwinTab />
        )}
        {activeTab === 'logs' && (
          <AuditLogsTab />
        )}
        {activeTab === 'settings' && (
          <GearConfigTab />
        )}
        {activeTab === 'staff' && (
          <StaffDirectoryTab />
        )}
        {activeTab === 'guides' && (
          <SafetyGuidesTab />
        )}
      </main>

    </div>
  );
}
