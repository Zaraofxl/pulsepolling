import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  BarChart3, 
  PlusCircle, 
  LayoutDashboard, 
  Sun, 
  Moon, 
  LogOut, 
  LogIn, 
  UserPlus,
  Radio
} from 'lucide-react';

// ============================================================================
// TOP NAVIGATION BAR
// Provides application branding, live indicator, route navigation,
// dark/light theme toggle, and authenticated user controls.
// ============================================================================

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--bg-secondary)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        maxWidth: '1240px',
        margin: '0 auto',
        padding: '0.85rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Brand Logo & Name */}
        <Link to="/" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          textDecoration: 'none',
          color: 'var(--text-primary)',
          fontWeight: 800,
          fontSize: '1.25rem',
          letterSpacing: '-0.02em',
        }}>
          <div style={{
            background: 'var(--accent-gradient)',
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: 'var(--accent-glow)',
          }}>
            <BarChart3 size={22} />
          </div>
          <span style={{
            background: 'var(--accent-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            PulsePoll
          </span>
          <span className="badge badge-live" style={{ marginLeft: '0.25rem' }}>
            LIVE
          </span>
        </Link>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isAuthenticated ? (
            <>
              <Link 
                to="/dashboard" 
                className="btn btn-secondary"
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  borderColor: location.pathname === '/dashboard' ? 'var(--accent-primary)' : 'var(--border-subtle)'
                }}
              >
                <LayoutDashboard size={16} />
                <span>Dashboard</span>
              </Link>

              <Link 
                to="/create" 
                className="btn btn-primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                <PlusCircle size={16} />
                <span>Create Poll</span>
              </Link>

              {/* User Dropdown / Logout */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {user?.name}
                </span>
                <button 
                  onClick={handleLogout} 
                  className="btn btn-outline btn-icon"
                  title="Log out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </>
          ) : (
            <>
              <Link 
                to="/login" 
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                <LogIn size={16} />
                <span>Sign In</span>
              </Link>
              <Link 
                to="/register" 
                className="btn btn-primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                <UserPlus size={16} />
                <span>Get Started</span>
              </Link>
            </>
          )}

          {/* Theme Toggle Button */}
          <button 
            onClick={toggleTheme} 
            className="btn btn-secondary btn-icon"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            style={{ marginLeft: '0.25rem' }}
          >
            {theme === 'dark' ? <Sun size={17} color="#fbbf24" /> : <Moon size={17} color="#6366f1" />}
          </button>
        </nav>
      </div>
    </header>
  );
}
