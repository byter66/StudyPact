import React from 'react';
import { Link } from 'react-router-dom';
import './Signup.css';

const Signup = () => {
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
                    <p className="form-subtitle">Sign in, or create an account below.</p>

                    <form className="signup-form" onSubmit={(e) => e.preventDefault()}>
                        <label className="field-label" htmlFor="username">Username</label>
                        <input
                            id="username"
                            type="text"
                            placeholder="your_username"
                            className="field-input"
                        />

                        <label className="field-label" htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            className="field-input"
                        />

                        <label className="field-label" htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="name@email.com"
                            className="field-input"
                        />

                        <label className="field-label" htmlFor="phone">Phone no.</label>
                        <input
                            id="phone"
                            type="tel"
                            placeholder="+91 98765 43210"
                            className="field-input"
                        />
                        <p className="otp-note">
                            <span className="otp-icon">🛡</span>
                            For one-time OTP verification (India only)
                        </p>

                        <div className="signup-actions">
                            <Link to="/dashboard" className="btn btn-primary">Login</Link>
                            <Link to="/signin" className="btn btn-outline">Sign in</Link>
                        </div>
                    </form>
                </div>
            </div>

        </section>
    )
}

export default Signup;