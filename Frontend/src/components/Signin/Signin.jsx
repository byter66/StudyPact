import React, { useState, useEffect } from 'react';
import { BookOpen, ArrowLeft, ArrowRight, ShieldCheck, Flame, Radio } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './Signin.css';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';

const Signin = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, setUser } = useAuth();

    useEffect(() => {
        if (user) {
            const destination = location.state?.from?.pathname || '/dashboard';
            navigate(destination, { replace: true });
        }
    }, [user, location.state, navigate]);
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [generatedOtp, setGeneratedOtp] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const normalizePhone = (value) => value.replace(/\D/g, '').slice(0, 10);

    const handleRequestOtp = async (event) => {
        event.preventDefault();
        setError('');

        const cleanPhone = normalizePhone(phone);
        if (!/^\d{10}$/.test(cleanPhone)) {
            setError('Enter a valid 10-digit Indian mobile number.');
            return;
        }

        setLoading(true);
        try {
            const result = await authService.requestOtp(cleanPhone, undefined, 'signin');
            setGeneratedOtp(result?.otp || '');
            setOtpSent(true);
        } catch (requestError) {
            setError(requestError.message || 'Unable to send OTP.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (event) => {
        event.preventDefault();
        setError('');

        if (!/^\d{6}$/.test(otp)) {
            setError('Enter the 6-digit OTP sent to your phone number.');
            return;
        }

        setLoading(true);
        try {
            const result = await authService.verifyOtp(normalizePhone(phone), otp);
            if (result?.user) {
                setUser(result.user);
                const destination = location.state?.from?.pathname || '/dashboard';
                navigate(destination, { replace: true });
            }
        } catch (verifyError) {
            setError(verifyError.message || 'OTP verification failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            {/* Architectural Top Masthead */}
            <header className="auth-masthead">
                <div className="auth-masthead-inner">
                    <div className="auth-brand">
                        <Link to="/" className="auth-brand-link">
                            <span className="auth-brand-symbol">
                                <BookOpen size={16} />
                            </span>
                            <span className="auth-brand-name">StudyPact</span>
                        </Link>
                        <span className="auth-edition-tag">EST. 2026 // ACADEMIC COHORT</span>
                    </div>

                    <div className="auth-masthead-meta">
                        <div className="auth-pulse-badge">
                            <span className="pulse-dot"></span>
                            <span className="pulse-text">1,420 Aspirants in Live Rooms</span>
                        </div>
                        <Link to="/" className="auth-nav-link auth-nav-home" title="Return to Home">
                            <ArrowLeft size={13} />
                            <span>Home</span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Asymmetrical Editorial Body */}
            <main className="auth-main-container">
                <div className="auth-grid-frame">
                    
                    {/* Left Editorial Section: The Focus Ledger */}
                    <section className="auth-editorial-pane">
                        <div className="editorial-content-stack">
                            <div className="editorial-tag-row">
                                <span className="editorial-tag">PORTAL 01</span>
                                <span className="editorial-divider">/</span>
                                <span className="editorial-category">STUDENT ACCESS TERMINAL</span>
                            </div>

                            <h1 className="editorial-headline">
                                Focus is not found.<br />
                                <span className="headline-italic">It is contracted.</span>
                            </h1>

                            <p className="editorial-summary">
                                StudyPact pairs dedicated aspirants in synchronized study rooms with peer-evaluated mock papers. Sign in to uphold your daily pact.
                            </p>

                            {/* Active Peer Rooms Ledger */}
                            <div className="peer-ledger-card">
                                <div className="ledger-card-header">
                                    <div className="ledger-title-wrap">
                                        <Radio size={12} className="ledger-live-icon" />
                                        <span className="ledger-title">LIVE STUDY ROOMS PULSE</span>
                                    </div>
                                    <span className="ledger-sync-tag">REALTIME</span>
                                </div>

                                <div className="ledger-rooms-list">
                                    <div className="ledger-room-row">
                                        <div className="room-meta">
                                            <span className="room-index">01</span>
                                            <div className="room-info">
                                                <span className="room-title">UPSC General Studies</span>
                                                <span className="room-mode">Pomodoro Round 3 of 4</span>
                                            </div>
                                        </div>
                                        <span className="room-badge">32 Active</span>
                                    </div>

                                    <div className="ledger-room-row">
                                        <div className="room-meta">
                                            <span className="room-index">02</span>
                                            <div className="room-info">
                                                <span className="room-title">GATE CS & Algorithms</span>
                                                <span className="room-mode">Deep Focus Sprint</span>
                                            </div>
                                        </div>
                                        <span className="room-badge">24 Active</span>
                                    </div>

                                    <div className="ledger-room-row">
                                        <div className="room-meta">
                                            <span className="room-index">03</span>
                                            <div className="room-info">
                                                <span className="room-title">CAT Quantitative Prep</span>
                                                <span className="room-mode">Peer Mock Evaluation</span>
                                            </div>
                                        </div>
                                        <span className="room-badge">19 Active</span>
                                    </div>
                                </div>

                                <div className="ledger-footer-note">
                                    <Flame size={13} className="streak-icon" />
                                    <span>Average daily focus among pact holders: <strong>5.4 hours</strong></span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Right Lightweight Form Pane */}
                    <section className="auth-terminal-pane">
                        <div className="auth-terminal-inner">
                            <div className="terminal-header">
                                <span className="terminal-eyebrow">MEMBER AUTHENTICATION</span>
                                <h2 className="terminal-title">Sign In</h2>
                                <p className="terminal-subtitle">
                                    Enter your registered phone number to receive a secure session code.
                                </p>
                            </div>

                            <form className="terminal-form" onSubmit={otpSent ? handleVerifyOtp : handleRequestOtp}>
                                <div className="terminal-field-group">
                                    <label className="terminal-label" htmlFor="phone">
                                        Mobile Number
                                    </label>
                                    <div className="phone-input-composite">
                                        <span className="phone-prefix">+91</span>
                                        <input
                                            id="phone"
                                            type="tel"
                                            value={phone}
                                            onChange={(event) => setPhone(normalizePhone(event.target.value))}
                                            className="terminal-input phone-input"
                                            placeholder="Enter 10-digit number"
                                            inputMode="numeric"
                                            maxLength={10}
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                {otpSent && (
                                    <div className="terminal-field-group otp-reveal-group">
                                        {generatedOtp && (
                                            <div className="dev-otp-capsule">
                                                <span className="capsule-label">DEMO SESSION CODE:</span>
                                                <strong className="capsule-code">{generatedOtp}</strong>
                                            </div>
                                        )}
                                        <label className="terminal-label" htmlFor="otp">
                                            One-Time Passcode
                                        </label>
                                        <input
                                            id="otp"
                                            type="text"
                                            value={otp}
                                            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                            className="terminal-input otp-code-input"
                                            placeholder="• • • • • •"
                                            inputMode="numeric"
                                            maxLength={6}
                                            autoFocus
                                        />
                                        <span className="terminal-field-caption">
                                            Enter the 6-digit code received
                                        </span>
                                    </div>
                                )}

                                {error && (
                                    <div className="terminal-error-notice" role="alert">
                                        <span className="error-bullet">●</span>
                                        <span className="error-text">{error}</span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="terminal-primary-btn"
                                    disabled={loading}
                                >
                                    <span>{loading ? 'Please wait...' : otpSent ? 'Verify Code & Enter Dashboard' : 'Send Verification OTP'}</span>
                                    <ArrowRight size={15} />
                                </button>
                            </form>

                            <div className="terminal-footer">
                                <div className="auth-switch-prompt">
                                    <span>New to StudyPact?</span>
                                    <Link to="/signup" className="auth-switch-link">
                                        Create an account <ArrowRight size={12} className="switch-arrow" />
                                    </Link>
                                </div>

                                <div className="auth-security-badge">
                                    <ShieldCheck size={13} />
                                    <span>Encrypted session protocol • Zero spam</span>
                                </div>
                            </div>
                        </div>
                    </section>

                </div>
            </main>
        </div>
    );
};

export default Signin;
