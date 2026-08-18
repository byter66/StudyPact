import React from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

const Landing = () => {
    return (
        <section className="hero-section">
            <nav className='hero-nav'>
                <div className="brand-badge">
                    {/* //need to change image */}
                    <span className='brand-icon'>📋</span>
                    <span className='brand-name'>StudyPact</span>
                </div>

                <div className="nav-links">
                    <a href="#how-it-works" className="nav-link">How it works</a>
                    <Link to="/signin" className="btn btn-light">Sign in</Link>
                </div>
            </nav>

            <div className="hero-content">
                <div className="category-pill">
                    Built for UPSC · GATE · CAT · SSC aspirants
                </div>
                <h1 className='hero-title'>Study with people who hold<br />you accountable.</h1>
                <p className='hero-subtitle'>Form a pact, set daily goals, and keep your streak alive alongside peers preparing for the same exam.</p>
            </div>

        </section>
    )
}

export default Landing;