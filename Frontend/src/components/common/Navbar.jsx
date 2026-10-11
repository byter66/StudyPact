import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, LogIn, UserPlus, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Button from './Button';
import './Navbar.css';

export default function Navbar({ transparent = false }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className={`sp-navbar ${transparent ? 'sp-navbar-transparent' : 'glass-panel'}`}>
      <div className="sp-navbar-content">
        <Link to="/" className="sp-brand">
          <div className="sp-brand-icon-wrapper">
            <BookOpen size={20} className="sp-brand-icon" />
          </div>
          <span className="sp-brand-title">StudyPact</span>
          <span className="sp-brand-badge">Focus</span>
        </Link>

        <nav className="sp-nav-menu">
          <a href="#features" className="sp-nav-link">Features</a>
          <a href="#how-it-works" className="sp-nav-link">How it works</a>
          <a href="#exams" className="sp-nav-link">Exams</a>
        </nav>

        <div className="sp-nav-actions">
          {user ? (
            <>
              <Link to="/dashboard">
                <Button variant="secondary" size="sm" icon={LayoutDashboard}>
                  Dashboard
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                icon={LogOut}
                onClick={async () => {
                  await signOut();
                  navigate('/signin');
                }}
              >
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link to="/signin">
                <Button variant="ghost" size="sm" icon={LogIn}>
                  Sign in
                </Button>
              </Link>
              <Link to="/signup">
                <Button variant="primary" size="sm" icon={UserPlus}>
                  Join StudyPact
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
