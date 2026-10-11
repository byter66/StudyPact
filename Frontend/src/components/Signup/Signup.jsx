import React, { useState } from 'react';
import { BookOpen, ArrowLeft, ArrowRight, ShieldCheck, CheckCircle2, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import './Signup.css';
import { authService } from '../../services/authService';

const Signup = () => {
    const navigate = useNavigate();
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const normalizePhone = (value) => value.replace(/\D/g, '').slice(0, 10);

    const handleCreateAccount = async (event) => {
        event.preventDefault();
        setError('');

        const cleanPhone = normalizePhone(phone);
        if (!/^\d{10}$/.test(cleanPhone)) {
            setError('Enter a valid 10-digit Indian mobile number.');
            return;
        }

        if (!fullName.trim()) {
            setError('Please enter your full name.');
            return;
        }

        setLoading(true);
        try {
            await authService.register(cleanPhone, fullName.trim());
            navigate('/signin');
        } catch (registrationError) {
            setError(registrationError.message || 'Unable to create your account.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page signup-page">
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
                        <span className="auth-edition-tag">EST. 2026 // INDUCTION PROTOCOL</span>
                    </div>

                    <div className="auth-masthead-meta">
                        <div className="auth-cohort-pill">
                            <Users size={13} className="cohort-icon" />
                            <span className="cohort-text">12,400+ Active Aspirants</span>
                        </div>
                        <Link to="/" className="auth-nav-link auth-nav-home" title="Return to Home">
                            <ArrowLeft size={13} />
                            <span>Home</span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Asymmetrical Editorial Induction Body */}
            <main className="auth-main-container">
                <div className="auth-grid-frame signup-grid-frame">
                    
                    {/* Left Section: The StudyPact Covenant Charter */}
                    <section className="auth-editorial-pane signup-charter-pane">
                        <div className="editorial-content-stack">
                            <div className="editorial-tag-row">
                                <span className="editorial-tag">INDUCTION 01</span>
                                <span className="editorial-divider">/</span>
                                <span className="editorial-category">ASPIRANT CHARTER</span>
                            </div>

                            <h1 className="editorial-headline">
                                Hold the standard.<br />
                                <span className="headline-italic">Study with serious peers.</span>
                            </h1>

                            <p className="editorial-summary">
                                StudyPact pairs aspirants across competitive exams in synchronized focus rooms with peer-evaluated mock papers. Establish your daily pact to join.
                            </p>

                            {/* The Three Principles Covenant Card */}
                            <div className="covenant-charter-card">
                                <div className="covenant-card-header">
                                    <span className="covenant-badge">THE THREE PILLARS OF STUDYPACT</span>
                                    <span className="covenant-rule-tag">MUTUAL PACT</span>
                                </div>

                                <div className="covenant-rules-list">
                                    <div className="covenant-rule-item">
                                        <div className="rule-number-block">
                                            <span className="rule-num">01</span>
                                        </div>
                                        <div className="rule-content">
                                            <h3 className="rule-title">Unbroken Presence</h3>
                                            <p className="rule-desc">
                                                Engage the 25-minute Pomodoro timer, stay in the room, and eliminate non-study browsing.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="covenant-rule-item">
                                        <div className="rule-number-block">
                                            <span className="rule-num">02</span>
                                        </div>
                                        <div className="rule-content">
                                            <h3 className="rule-title">Calibrated Peer Mock Exams</h3>
                                            <p className="rule-desc">
                                                Solve previous year papers under timed exam conditions. Grade peer answer sheets with rigor and objectivity.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="covenant-rule-item">
                                        <div className="rule-number-block">
                                            <span className="rule-num">03</span>
                                        </div>
                                        <div className="rule-content">
                                            <h3 className="rule-title">Zero-Day Elimination</h3>
                                            <p className="rule-desc">
                                                Even on difficult days, complete at least one synchronized session to protect your streak.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="covenant-footer">
                                    <CheckCircle2 size={14} className="covenant-check-icon" />
                                    <span>Cohorts active across UPSC, GATE, CAT, JEE & Medical</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Right Section: Aspirant Registration Terminal */}
                    <section className="auth-terminal-pane signup-terminal-pane">
                        <div className="auth-terminal-inner">
                            <div className="terminal-header">
                                <span className="terminal-eyebrow">NEW ASPIRANT ENROLLMENT</span>
                                <h2 className="terminal-title">Create Account</h2>
                                <p className="terminal-subtitle">
                                    Set up your aspirant profile using your mobile number to begin.
                                </p>
                            </div>

                            <form className="terminal-form" onSubmit={handleCreateAccount}>
                                <div className="terminal-field-group">
                                    <label className="terminal-label" htmlFor="fullName">
                                        Full Name
                                    </label>
                                    <input
                                        id="fullName"
                                        type="text"
                                        value={fullName}
                                        onChange={(event) => setFullName(event.target.value)}
                                        className="terminal-input field-input-boxed"
                                        placeholder="e.g. Priyanshu Sen"
                                        autoFocus
                                    />
                                    <span className="terminal-field-caption">
                                        Displayed in your room presence and peer evaluation cards
                                    </span>
                                </div>

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
                                        />
                                    </div>
                                    <span className="terminal-field-caption">
                                        Used for one-time passcode login verification
                                    </span>
                                </div>

                                {error && (
                                    <div className="terminal-error-notice" role="alert">
                                        <span className="error-bullet">●</span>
                                        <span className="error-text">{error}</span>
                                    </div>
                                )}

                                <div className="signup-actions-stack">
                                    <button
                                        type="submit"
                                        className="terminal-primary-btn"
                                        disabled={loading}
                                    >
                                        <span>{loading ? 'Please wait...' : 'Establish Pact & Create Account'}</span>
                                        <ArrowRight size={15} />
                                    </button>

                                    <Link to="/signin" className="terminal-secondary-link-btn">
                                        <span>Already registered? Sign In instead</span>
                                        <ArrowRight size={13} />
                                    </Link>
                                </div>
                            </form>

                            <div className="terminal-footer">
                                <p className="signup-pledge-note">
                                    By registering, you commit to mutual respect and active focus in study rooms.
                                </p>

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

export default Signup;
