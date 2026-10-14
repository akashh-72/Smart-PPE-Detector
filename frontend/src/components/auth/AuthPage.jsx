import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  User, 
  HardHat, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  KeyRound,
  RotateCcw,
  Sparkles,
  Building
} from 'lucide-react';
import { signInUser, signUpUser, signInWithGoogle, loginAsDemo } from '../../services/authService';

export default function AuthPage({ 
  initialMode = 'signin', 
  onLoginSuccess, 
  onBackToLanding 
}) {
  const [authMode, setAuthMode] = useState(initialMode); // 'signin' | 'signup' | 'forgot'
  
  // Sign In / Sign Up fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Sign Up fields
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('HSE & Security Operations');
  const [termsAgreed, setTermsAgreed] = useState(false);

  // Forgot Password Flow State
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resendCooldown, setResendCooldown] = useState(45);
  const otpInputRefs = useRef([]);

  useEffect(() => {
    let timer;
    if (authMode === 'forgot' && forgotStep === 2 && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [authMode, forgotStep, resendCooldown]);

  // Google Authentication
  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const result = await signInWithGoogle();
      setIsSubmitting(false);
      if (result.success) {
        setSuccessToast(`Signed in with Google as ${result.user.name}`);
        setTimeout(() => {
          onLoginSuccess(result.user);
        }, 350);
      } else {
        setErrorMsg(result.error || 'Google authentication could not be completed.');
      }
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Error communicating with authentication service.');
    }
  };

  // Instant 1-Click Demo Login
  const handleQuickDemoLogin = () => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const demoUser = loginAsDemo();
      setSuccessToast(`Welcome back, ${demoUser.name} (Safety Controller)`);
      setTimeout(() => {
        setIsSubmitting(false);
        onLoginSuccess(demoUser);
      }, 300);
    } catch (e) {
      setIsSubmitting(false);
      setErrorMsg("Demo login: " + e.message);
    }
  };

  // Sign In Submit
  const handleSignInSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessToast('');

    if (!email.trim()) {
      setErrorMsg('Please enter your controller email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    const result = await signInUser(email.trim(), password);
    setIsSubmitting(false);

    if (result.success) {
      setSuccessToast(`Access granted! Welcome, ${result.user.name}.`);
      setTimeout(() => {
        onLoginSuccess(result.user);
      }, 350);
    } else {
      setErrorMsg(result.error);
    }
  };

  // Sign Up Submit
  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessToast('');

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid work email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password should be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!termsAgreed) {
      setErrorMsg('Please agree to the Safety Operations & Protocol agreement to proceed.');
      return;
    }

    setIsSubmitting(true);
    const result = await signUpUser(email.trim(), password, {
      name: fullName.trim(),
      employeeId: employeeId.trim() || `SEC-${Math.floor(1000 + Math.random() * 9000)}`,
      department: department
    });
    setIsSubmitting(false);

    if (result.success) {
      setSuccessToast(`Controller account created! Welcome, ${result.user.name}.`);
      setTimeout(() => {
        onLoginSuccess(result.user);
      }, 400);
    } else {
      setErrorMsg(result.error);
    }
  };

  // Forgot Password: OTP Handlers
  const handleSendOtp = (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setErrorMsg('Please enter your registered controller email.');
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setForgotStep(2);
      setResendCooldown(45);
      setSuccessToast(`Security code dispatched to ${forgotEmail}`);
    }, 500);
  };

  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = digit;
    setOtpDigits(nextDigits);
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleVerifyOtpAndReset = (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (otpDigits.join('').length < 6) {
      setErrorMsg('Please enter the complete 6-digit OTP verification code.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setForgotStep(3);
    }, 600);
  };

  return (
    <div className="auth-clean-page-wrapper">
      
      {/* 1. Dynamic Top Navigation Bar */}
      <div className="auth-clean-nav-bar">
        <div 
          className="auth-clean-brand" 
          onClick={onBackToLanding}
          role="button"
          tabIndex={0}
        >
          <div className="auth-clean-circle-logo">
            <ShieldCheck size={20} color="#FFFFFF" strokeWidth={2.8} />
          </div>
          <span className="auth-clean-brand-text">SafeGuard<span className="text-electric">AI</span></span>
        </div>

        {/* Right Navigation Actions */}
        <div className="auth-nav-action-buttons">
          {authMode === 'signin' ? (
            <button 
              type="button"
              className="auth-nav-pill-btn secondary"
              onClick={() => { setAuthMode('signup'); setErrorMsg(''); }}
            >
              <User size={14} />
              <span>Register Controller</span>
            </button>
          ) : (
            <button 
              type="button"
              className="auth-nav-pill-btn outline"
              onClick={() => { setAuthMode('signin'); setErrorMsg(''); }}
            >
              <span>Back to Login</span>
            </button>
          )}

          <button 
            type="button"
            className="auth-clean-back-btn"
            onClick={onBackToLanding}
          >
            <ArrowLeft size={15} />
            <span>Return to Site</span>
          </button>
        </div>
      </div>

      {/* 2. Main Centered Card Container */}
      <div className="auth-clean-card-container">
        <div className="auth-clean-card">
          
          {/* Card Eyebrow / Hero Section */}
          <div className="auth-clean-header text-center">
            {authMode === 'forgot' ? (
              <>
                <div className="auth-forgot-icon-bubble">
                  {forgotStep === 3 ? (
                    <CheckCircle2 size={28} color="#10B981" />
                  ) : (
                    <KeyRound size={26} color="#FF5E14" />
                  )}
                </div>
                <h1 className="auth-clean-title">
                  {forgotStep === 1 && 'Reset Access Password'}
                  {forgotStep === 2 && 'Enter Security Code'}
                  {forgotStep === 3 && 'Credentials Updated'}
                </h1>
                <p className="auth-clean-subtitle">
                  {forgotStep === 1 && "Enter your registered controller email to receive an authorized OTP code."}
                  {forgotStep === 2 && `Enter the 6-digit verification code sent to ${forgotEmail}.`}
                  {forgotStep === 3 && "Your credentials have been securely reset. You can now log into the gate workstation."}
                </p>
              </>
            ) : authMode === 'signin' ? (
              <>
                <div className="auth-role-hero-badge">
                  <HardHat size={14} />
                  <span>GATE CONTROL TERMINAL</span>
                </div>
                <h1 className="auth-clean-title">Safety Controller Login</h1>
                <p className="auth-clean-subtitle">
                  Sign in to oversee live AI vision feeds, manage gate barriers, and review site audit logs.
                </p>
              </>
            ) : (
              <>
                <div className="auth-role-hero-badge">
                  <ShieldCheck size={14} />
                  <span>NEW CONTROLLER CREDENTIALING</span>
                </div>
                <h1 className="auth-clean-title">Register Safety Officer</h1>
                <p className="auth-clean-subtitle">
                  Enroll an authorized HSE officer for Site Gate 01 access management and barrier control.
                </p>
              </>
            )}
          </div>

          {/* Feedback Banners */}
          {errorMsg && (
            <div className="auth-clean-alert error animate-fadeIn">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successToast && (
            <div className="auth-clean-alert success animate-fadeIn">
              <CheckCircle2 size={16} />
              <span>{successToast}</span>
            </div>
          )}

          {/* ========================================================
              VIEW A: SIGN IN FORM
              ======================================================== */}
          {authMode === 'signin' && (
            <>
              {/* Quick 1-Click Fast Instant Test Access */}
              <div className="auth-quick-demo-box">
                <div className="demo-box-label-row">
                  <span className="demo-lightning-icon">⚡</span>
                  <span className="demo-box-label">Instant 1-Click Test Access:</span>
                </div>
                <button
                  type="button"
                  className="auth-instant-demo-btn"
                  onClick={handleQuickDemoLogin}
                  disabled={isSubmitting}
                >
                  <HardHat size={15} color="#FF5E14" />
                  <span>Sign In as Safety Officer (Alex Vance)</span>
                </button>
              </div>

              {/* Google Sign In Button */}
              <button 
                type="button"
                className="auth-clean-google-btn"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
              >
                <svg className="google-svg-icon" viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Continue with Corporate Google ID</span>
              </button>

              <div className="auth-clean-divider">
                <span>or authenticate with credentials</span>
              </div>

              <form onSubmit={handleSignInSubmit} className="auth-clean-form">
                <div className="auth-field-group">
                  <label className="auth-label">Controller Email</label>
                  <div className="auth-input-wrapper">
                    <Mail size={17} className="auth-field-icon" />
                    <input 
                      type="email"
                      placeholder="alex.vance@safeguard.ai"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="auth-input-control"
                      required
                    />
                  </div>
                </div>

                <div className="auth-field-group">
                  <label className="auth-label">Password</label>
                  <div className="auth-input-wrapper">
                    <Lock size={17} className="auth-field-icon" />
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="auth-input-control"
                      required
                    />
                    <button 
                      type="button" 
                      className="auth-eye-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="auth-remember-forgot-row">
                  <label className="auth-checkbox-label">
                    <input 
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember terminal</span>
                  </label>

                  <button 
                    type="button" 
                    className="auth-forgot-link"
                    onClick={() => { setAuthMode('forgot'); setForgotStep(1); }}
                  >
                    Forgot password?
                  </button>
                </div>

                <button 
                  type="submit" 
                  className="skinive-btn-pill-primary full-width"
                  disabled={isSubmitting}
                >
                  <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Workstation'}</span>
                  <ArrowRight size={17} />
                </button>
              </form>

              <div className="auth-clean-footer-text">
                <p>
                  Need new controller credentials?{' '}
                  <button 
                    type="button" 
                    className="auth-switch-link"
                    onClick={() => { setAuthMode('signup'); setErrorMsg(''); }}
                  >
                    Register Here
                  </button>
                </p>
              </div>
            </>
          )}

          {/* ========================================================
              VIEW B: SIGN UP FORM
              ======================================================== */}
          {authMode === 'signup' && (
            <form onSubmit={handleSignUpSubmit} className="auth-clean-form">
              <div className="auth-field-group">
                <label className="auth-label">Full Name</label>
                <div className="auth-input-wrapper">
                  <User size={17} className="auth-field-icon" />
                  <input 
                    type="text"
                    placeholder="Alex Vance"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="auth-input-control"
                    required
                  />
                </div>
              </div>

              <div className="auth-row-2col">
                <div className="auth-field-group">
                  <label className="auth-label">Employee / Badge ID</label>
                  <div className="auth-input-wrapper">
                    <Building size={17} className="auth-field-icon" />
                    <input 
                      type="text"
                      placeholder="SEC-8492"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      className="auth-input-control"
                    />
                  </div>
                </div>

                <div className="auth-field-group">
                  <label className="auth-label">Department</label>
                  <div className="auth-input-wrapper">
                    <input 
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="auth-input-control"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="auth-field-group">
                <label className="auth-label">Site Operations Email</label>
                <div className="auth-input-wrapper">
                  <Mail size={17} className="auth-field-icon" />
                  <input 
                    type="email"
                    placeholder="alex.vance@safeguard.ai"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="auth-input-control"
                    required
                  />
                </div>
              </div>

              <div className="auth-row-2col">
                <div className="auth-field-group">
                  <label className="auth-label">Password</label>
                  <div className="auth-input-wrapper">
                    <Lock size={17} className="auth-field-icon" />
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 6 chars"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="auth-input-control"
                      required
                    />
                  </div>
                </div>

                <div className="auth-field-group">
                  <label className="auth-label">Confirm Password</label>
                  <div className="auth-input-wrapper">
                    <Lock size={17} className="auth-field-icon" />
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Confirm"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="auth-input-control"
                      required
                    />
                  </div>
                </div>
              </div>

              <label className="auth-checkbox-label">
                <input 
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                />
                <span>I agree to HSE site security protocols and audit policies.</span>
              </label>

              <button 
                type="submit" 
                className="skinive-btn-pill-primary full-width"
                disabled={isSubmitting}
              >
                <span>{isSubmitting ? 'Creating Profile...' : 'Complete Registration'}</span>
                <ArrowRight size={17} />
              </button>

              <div className="auth-clean-footer-text">
                <p>
                  Already have an account?{' '}
                  <button 
                    type="button" 
                    className="auth-switch-link"
                    onClick={() => { setAuthMode('signin'); setErrorMsg(''); }}
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* ========================================================
              VIEW C: FORGOT PASSWORD FLOW
              ======================================================== */}
          {authMode === 'forgot' && (
            <div className="auth-clean-form">
              {forgotStep === 1 && (
                <form onSubmit={handleSendOtp}>
                  <div className="auth-field-group">
                    <label className="auth-label">Registered Controller Email</label>
                    <div className="auth-input-wrapper">
                      <Mail size={17} className="auth-field-icon" />
                      <input 
                        type="email"
                        placeholder="controller@safeguard.ai"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="auth-input-control"
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="skinive-btn-pill-primary full-width"
                    disabled={isSubmitting}
                  >
                    <span>{isSubmitting ? 'Sending...' : 'Send Security Code'}</span>
                    <ArrowRight size={17} />
                  </button>
                </form>
              )}

              {forgotStep === 2 && (
                <form onSubmit={handleVerifyOtpAndReset}>
                  <div className="auth-field-group">
                    <label className="auth-label">6-Digit Verification Code</label>
                    <div className="otp-inputs-row">
                      {otpDigits.map((digit, idx) => (
                        <input 
                          key={idx}
                          ref={(el) => (otpInputRefs.current[idx] = el)}
                          type="text"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(idx, e.target.value)}
                          className="otp-digit-box"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="auth-field-group">
                    <label className="auth-label">New Password</label>
                    <div className="auth-input-wrapper">
                      <Lock size={17} className="auth-field-icon" />
                      <input 
                        type="password"
                        placeholder="New password (min 6 characters)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="auth-input-control"
                        required
                      />
                    </div>
                  </div>

                  <div className="auth-field-group">
                    <label className="auth-label">Confirm New Password</label>
                    <div className="auth-input-wrapper">
                      <Lock size={17} className="auth-field-icon" />
                      <input 
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="auth-input-control"
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="skinive-btn-pill-primary full-width"
                    disabled={isSubmitting}
                  >
                    <span>Update Password &amp; Login</span>
                    <ArrowRight size={17} />
                  </button>
                </form>
              )}

              {forgotStep === 3 && (
                <div className="text-center">
                  <button 
                    type="button" 
                    className="skinive-btn-pill-primary full-width"
                    onClick={() => { setAuthMode('signin'); setForgotStep(1); }}
                  >
                    <span>Proceed to Sign In</span>
                    <ArrowRight size={17} />
                  </button>
                </div>
              )}

              <div className="auth-clean-footer-text">
                <button 
                  type="button" 
                  className="auth-switch-link"
                  onClick={() => { setAuthMode('signin'); setErrorMsg(''); }}
                >
                  Return to Sign In
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
