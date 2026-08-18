import React from 'react';
import { Link } from 'react-router-dom';
import './Signin.css';

const Signin = () => {
    return (
        <section className="signin-section">

            <div className="signin-photo">
                <div className="signin-photo-top">
                    <div className="brand-badge">
                        <span className='brand-icon'>📋</span>
                        <span className='brand-name'>StudyPact</span>
                    </div>

                    <div className="signin-photo-content">
                        <h1 className="signin-headline">Welcome back. Your<br />pact is waiting.</h1>
                        <p className="signin-subtext">Sign in to check today's goals and keep your streak going.</p>
                    </div>
                </div>

                <div className="signin-photo-bottom">
                    <div className="signin-stats">
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

                <div className="scroll-icon">↓</div>
            </div>

            <div className="signin-form-panel">
                <button className="menu-dots" aria-label="More options">•••</button>

                <div className="signin-form-wrapper">
                    <h2 className="form-title">Sign in</h2>
                    <p className="form-subtitle">Enter your details to continue.</p>

                    <form className="signin-form" onSubmit={(e) => e.preventDefault()}>
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

                        <a href="#forgot-password" className="forgot-link">Forgot password?</a>

                        <button type="submit" className="btn btn-primary">Sign in</button>
                    </form>

                    <p className="signup-prompt">
                        New here? <Link to="/signup" className="signup-link">Create an account</Link>
                    </p>
                </div>
            </div>

        </section>
    )
}

export default Signin;