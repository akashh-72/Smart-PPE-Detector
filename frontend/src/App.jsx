import React, { useState, useEffect } from 'react';
import { ShieldCheck, HardHat } from 'lucide-react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import StatsBanner from './components/StatsBanner';
import AudienceCards from './components/AudienceCards';
import KeyFeatures from './components/KeyFeatures';
import SmartAnalysisBanner from './components/SmartAnalysisBanner';
import FAQSection from './components/FAQSection';
import Footer from './components/Footer';
import ContactPage from './components/ContactPage';
import AuthPage from './components/auth/AuthPage';
import PortalLayout from './components/portal/PortalLayout';
import { getActiveUser, signOutUser, subscribeToAuthChanges, loginAsDemo } from './services/authService';

import './App.css';
import './components/portal/portals.css';
import './components/auth/auth.css';

export default function App() {
  // Single-user state loaded from localStorage
  const [user, setUser] = useState(() => {
    return getActiveUser();
  });

  // Persistent view state: restore wherever the user was on refresh
  const [currentView, setCurrentView] = useState(() => {
    try {
      const savedUser = localStorage.getItem('safeguard_active_user');
      const savedView = localStorage.getItem('safeguard_current_view');
      if (savedUser && savedView && ['portal', 'contact'].includes(savedView)) {
        return savedView;
      }
      return savedView || 'landing';
    } catch {
      return 'landing';
    }
  });

  // Persistent tab state for Workstation Portal
  const [portalTab, setPortalTab] = useState(() => {
    try {
      return localStorage.getItem('safeguard_portal_tab') || 'scanner';
    } catch {
      return 'scanner';
    }
  });

  const [authMode, setAuthMode] = useState('signin');
  const [isAppLoading, setIsAppLoading] = useState(true);

  // Quick restore animation on page reload (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAppLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Safe view & tab navigators that persist state
  const navigateView = (view) => {
    setCurrentView(view);
    try { localStorage.setItem('safeguard_current_view', view); } catch (e) {}
  };

  const navigatePortalTab = (tab) => {
    setPortalTab(tab);
    try { localStorage.setItem('safeguard_portal_tab', tab); } catch (e) {}
  };

  // Sync auth state changes across browser tabs
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Navigation Handlers - Opens Workstation Smoothly for Industrial Gatekeeper
  const handleOpenScanner = () => {
    let currentUser = user;
    if (!currentUser) {
      currentUser = loginAsDemo();
      setUser(currentUser);
    }
    navigatePortalTab('scanner');
    navigateView('portal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenPortalTab = (tab = 'scanner') => {
    let currentUser = user;
    if (!currentUser) {
      currentUser = loginAsDemo();
      setUser(currentUser);
    }
    navigatePortalTab(tab);
    navigateView('portal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAuth = (mode = 'signin') => {
    setAuthMode(mode);
    navigateView(mode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginSuccess = (userObj) => {
    setUser(userObj);
    navigatePortalTab('scanner');
    navigateView('portal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    await signOutUser();
    localStorage.removeItem('safeguard_active_user');
    localStorage.setItem('safeguard_current_view', 'landing');
    localStorage.setItem('safeguard_portal_tab', 'scanner');
    setUser(null);
    navigatePortalTab('scanner');
    navigateView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExploreDemo = () => {
    const el = document.getElementById('smart-analysis');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      handleOpenScanner();
    }
  };

  // Quick reload splash loader with smooth animation
  if (isAppLoading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #FF5E14 0%, #EA580C 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(255, 94, 20, 0.35)',
            animation: 'pulseDot 1.5s infinite'
          }}>
            <ShieldCheck size={28} color="#FFFFFF" strokeWidth={2.8} />
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            SafeGuard<span style={{ color: '#FF5E14' }}>AI</span>
          </h3>

          <div style={{ width: '120px', height: '3px', background: '#F1F5F9', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              width: '100%',
              height: '100%',
              background: '#FF5E14',
              animation: 'spinLoader 1s linear infinite'
            }}></div>
          </div>

          <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 500 }}>
            Restoring Industrial Vision Gateway...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root-container">
      
      {/* 1. Landing Page View */}
      {currentView === 'landing' && (
        <>
          <Navbar 
            currentView={currentView}
            setCurrentView={navigateView}
            user={user}
            onOpenAuth={handleOpenAuth}
            onLogout={handleLogout}
            onOpenScanner={handleOpenScanner}
            onOpenPortalTab={handleOpenPortalTab}
          />

          <main>
            {/* Hero: AI PPE Access Scanner */}
            <Hero 
              onOpenScanner={handleOpenScanner}
              onExploreDemo={handleExploreDemo}
            />

            {/* Modern Stats Banner */}
            <StatsBanner 
              onOpenScanner={handleOpenScanner}
            />

            {/* Universal AI Safety Vision (3 Squircle Cards) */}
            <AudienceCards 
              onOpenScanner={handleOpenScanner}
              onOpenPortalTab={handleOpenPortalTab}
            />

            {/* Core Vision & Access Capabilities */}
            <KeyFeatures 
              onOpenScanner={handleOpenScanner}
            />

            {/* Smart PPE Verification Banner & Walkthrough */}
            <SmartAnalysisBanner 
              onOpenScanner={handleOpenScanner}
            />

            {/* Industrial Safety FAQ */}
            <FAQSection />
          </main>

          <Footer 
            onOpenScanner={handleOpenScanner}
            onOpenPortalTab={handleOpenPortalTab}
            onOpenContact={() => { navigateView('contact'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        </>
      )}

      {/* 2. Dedicated Contact Us Page View */}
      {currentView === 'contact' && (
        <>
          <Navbar 
            currentView={currentView}
            setCurrentView={navigateView}
            user={user}
            onOpenAuth={handleOpenAuth}
            onLogout={handleLogout}
            onOpenScanner={handleOpenScanner}
            onOpenPortalTab={handleOpenPortalTab}
          />

          <main>
            <ContactPage 
              onOpenScanner={handleOpenScanner}
              onBackToLanding={() => { navigateView('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            />
          </main>

          <Footer 
            onOpenScanner={handleOpenScanner}
            onOpenPortalTab={handleOpenPortalTab}
            onOpenContact={() => { navigateView('contact'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        </>
      )}

      {/* 3. Authentication Page (Single User Controller Login/Register/Forgot) */}
      {(currentView === 'signin' || currentView === 'signup') && (
        <AuthPage 
          initialMode={currentView}
          onLoginSuccess={handleLoginSuccess}
          onBackToLanding={() => { navigateView('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        />
      )}

      {/* 4. Dedicated Safety Controller Workstation Portal */}
      {currentView === 'portal' && (
        <PortalLayout 
          user={user}
          onLogout={handleLogout}
          onBackToLanding={() => { navigateView('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          initialTab={portalTab}
          onTabChange={navigatePortalTab}
        />
      )}

    </div>
  );
}
