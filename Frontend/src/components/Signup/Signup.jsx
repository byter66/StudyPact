import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Signup.css';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';

const Signup = () => {
    const navigate = useNavigate();
    const { setUser } = useAuth();
    const [fullName, setFullName] = useState('');
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

        if (!fullName.trim()) {
            setError('Please enter your full name.');
            return;
        }

        setLoading(true);
        try {
            const result = await authService.requestOtp(cleanPhone, fullName.trim(), 'signup');
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
            const result = await authService.verifyOtp(normalizePhone(phone), otp, fullName.trim());
            if (result?.user) {
                setUser(result.user);
                navigate('/dashboard');
            }
        } catch (verifyError) {
            setError(verifyError.message || 'OTP verification failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="signup-section">

            <div className="signup-photo">
                <div className="signup-photo-top">
                    <div className="brand-badge">
                        <span className='brand-icon'>📋</span>
                        <span className='brand-name'>StudyPact</span>
                    </div>

                    <div className="signup-photo-content">
                        <h1 className="signup-headline">Welcome back. Your<br />pact is waiting.</h1>
                        <p className="signup-subtext">Sign in to check today's goals and keep your streak going.</p>
                    </div>
                </div>

                <div className="signup-photo-bottom">
                    <div className="signup-stats">
                        <div className="stat">
                            <span className="stat-number">12K+</span>
                            <span className="stat-label">Active aspirants</span>
                        </div>
                        <div className="stat">
                            <span className="stat-number">98%</span>
                            <span className="stat-label">Goal completion</span>
                        </div>
                    </div>
                </div>

            </div>

            <div className="signup-form-panel">
                <button className="menu-dots" aria-label="More options">•••</button>

                <div className="signup-form-wrapper">
                    <h2 className="form-title">Get started</h2>
                    <p className="form-subtitle">Create an account using your phone number.</p>

                    <form className="signup-form" onSubmit={otpSent ? handleVerifyOtp : handleRequestOtp}>
                        <label className="field-label" htmlFor="fullName">Full name</label>
                        <input
                            id="fullName"
                            type="text"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            className="field-input"
                        />

                        <label className="field-label" htmlFor="phone">Phone no.</label>
                        <input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(event) => setPhone(normalizePhone(event.target.value))}
                            className="field-input"
                            inputMode="numeric"
                            maxLength={10}
                        />

                        {otpSent && (
                            <>
                                {generatedOtp && (
                                    <p className="dev-otp-notice">
                                        Your development OTP is <strong>{generatedOtp}</strong>
                                    </p>
                                )}
                                <label className="field-label" htmlFor="otp">OTP</label>
                                <input
                                    id="otp"
                                    type="text"
                                    value={otp}
                                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="field-input"
                                    inputMode="numeric"
                                    maxLength={6}
                                />
                            </>
                        )}

                        <p className="otp-note">
                            <span className="otp-icon">🛡</span>
                            One-time OTP verification for Indian users only.
                        </p>

                        {error && <p className="auth-error">{error}</p>}

                        <div className="signup-actions">
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'Please wait...' : otpSent ? 'Create account' : 'Send OTP'}
                            </button>
                            <Link to="/signin" className="btn btn-outline">Sign in</Link>
                        </div>
                    </form>
                </div>
            </div>

        </section>
    )
}

export default Signup;