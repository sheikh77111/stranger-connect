import React, { useState } from 'react';
import { Mail, Phone, ShieldCheck, Flame, ArrowRight, Chrome } from 'lucide-react';

export default function AuthScreen({ onAuthSuccess }) {
  const [authMethod, setAuthMethod] = useState(null); // 'email' | 'phone' | null
  const [inputValue, setInputValue] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = (e) => {
    e.preventDefault();
    if (!inputValue) {
      setError('Please fill in the required field');
      return;
    }
    setError('');
    setLoading(true);

    // Simulate OTP Sending
    setTimeout(() => {
      setLoading(false);
      setOtpSent(true);
    }, 1000);
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    if (otpCode.length < 6) {
      setError('Verification code must be 6 digits');
      return;
    }
    setError('');
    setLoading(true);

    // Simulate validation
    setTimeout(() => {
      setLoading(false);
      if (otpCode === '123456' || otpCode === '888888' || otpCode.startsWith('1')) {
        // Authenticate!
        const mockUid = 'user_' + Math.random().toString(36).substr(2, 9);
        onAuthSuccess(mockUid);
      } else {
        setError('Incorrect code. Try "123456" for demo access!');
      }
    }, 1200);
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    setError('');
    
    // Simulate Firebase popup
    setTimeout(() => {
      setLoading(false);
      const mockUid = 'google_user_' + Math.random().toString(36).substr(2, 9);
      onAuthSuccess(mockUid);
    }, 1000);
  };

  const triggerInstantDemo = () => {
    const mockUid = 'demo_user_' + Math.random().toString(36).substr(2, 9);
    onAuthSuccess(mockUid);
  };

  return (
    <div style={styles.container}>
      <div className="glass-card animate-fade-in" style={styles.card}>
        
        {/* Fire/Logo Icon */}
        <div style={styles.logoContainer}>
          <div style={styles.logoBadge}>
            <Flame style={{ color: 'var(--primary)', width: 36, height: 36 }} />
          </div>
          <h2 style={styles.title}>Welcome to AnonMeet AI</h2>
          <p style={styles.subtitle}>Verified real-time connections, safe and toxic-free.</p>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}

        {!authMethod ? (
          <div style={styles.buttonList}>
            {/* Google Firebase Login */}
            <button className="btn btn-secondary" style={styles.authBtn} onClick={handleGoogleLogin} disabled={loading}>
              <Chrome size={18} style={{ color: '#4285F4' }} />
              <span>Continue with Google</span>
            </button>

            {/* Email OTP Login */}
            <button className="btn btn-secondary" style={styles.authBtn} onClick={() => setAuthMethod('email')} disabled={loading}>
              <Mail size={18} style={{ color: 'var(--primary-light)' }} />
              <span>Continue with Email OTP</span>
            </button>

            {/* Phone OTP Login */}
            <button className="btn btn-secondary" style={styles.authBtn} onClick={() => setAuthMethod('phone')} disabled={loading}>
              <Phone size={18} style={{ color: 'var(--accent)' }} />
              <span>Continue with Phone Number</span>
            </button>

            <div style={styles.divider}>
              <span style={styles.dividerText}>or</span>
            </div>

            {/* Instant Demo Access Button */}
            <button className="btn btn-primary" style={styles.demoBtn} onClick={triggerInstantDemo} disabled={loading}>
              <ShieldCheck size={18} />
              <span>Instant Local Demo Login</span>
            </button>
          </div>
        ) : (
          <div className="animate-fade-in">
            {!otpSent ? (
              <form onSubmit={handleSendOtp} style={styles.form}>
                <div className="form-group">
                  <label className="form-label">
                    {authMethod === 'email' ? 'Email Address' : 'Phone Number'}
                  </label>
                  <input
                    type={authMethod === 'email' ? 'email' : 'tel'}
                    className="form-input"
                    placeholder={authMethod === 'email' ? 'rahul@example.com' : '+91 99999 88888'}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>
                
                <div style={styles.formActions}>
                  <button type="button" className="btn btn-secondary" onClick={() => setAuthMethod(null)} disabled={loading}>
                    Back
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Sending...' : 'Send OTP'}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} style={styles.form}>
                <div style={styles.infoBox}>
                  We sent a 6-digit confirmation OTP to <strong>{inputValue}</strong>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Enter 6-Digit OTP</label>
                  <input
                    type="text"
                    maxLength={6}
                    className="form-input"
                    placeholder="123456"
                    style={styles.otpInput}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    required
                    disabled={loading}
                    autoFocus
                  />
                  <small style={styles.helpText}>Enter <b>123456</b> to log in immediately!</small>
                </div>

                <div style={styles.formActions}>
                  <button type="button" className="btn btn-secondary" onClick={() => setOtpSent(false)} disabled={loading}>
                    Resend
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Verifying...' : 'Verify & Sign In'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    padding: '2rem 1rem',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    textAlign: 'center',
  },
  logoContainer: {
    marginBottom: '2rem',
  },
  logoBadge: {
    width: '72px',
    height: '72px',
    borderRadius: '20px',
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.25rem',
    boxShadow: '0 8px 24px rgba(139, 92, 246, 0.2)',
  },
  title: {
    fontSize: '1.65rem',
    color: 'var(--text-white)',
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
  },
  errorBanner: {
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: '#f87171',
    padding: '0.75rem',
    borderRadius: '10px',
    fontSize: '0.85rem',
    marginBottom: '1.25rem',
    textAlign: 'left',
  },
  buttonList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  authBtn: {
    width: '100%',
    justifyContent: 'flex-start',
    padding: '0.85rem 1.25rem',
    gap: '1rem',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '0.75rem 0',
  },
  dividerText: {
    padding: '0 0.75rem',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    textTransform: 'uppercase',
  },
  demoBtn: {
    width: '100%',
    padding: '0.9rem 1.25rem',
  },
  form: {
    textAlign: 'left',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '1.5rem',
    gap: '1rem',
  },
  infoBox: {
    background: 'rgba(6, 182, 212, 0.08)',
    border: '1px solid rgba(6, 182, 212, 0.15)',
    color: 'var(--accent)',
    fontSize: '0.85rem',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    lineHeight: 1.4,
    marginBottom: '1.25rem',
  },
  otpInput: {
    letterSpacing: '0.5em',
    textAlign: 'center',
    fontSize: '1.5rem',
    fontWeight: 'bold',
  },
  helpText: {
    display: 'block',
    marginTop: '0.4rem',
    color: 'var(--primary-light)',
    fontSize: '0.8rem',
  }
};
