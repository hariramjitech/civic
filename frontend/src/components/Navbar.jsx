import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserButton, SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react';
import {
  Megaphone, Map, MessageSquare, Flame,
  PlusCircle, User, Shield, Menu, X, Bell
} from 'lucide-react';

export default function Navbar({ role }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isActive = (path) => location.pathname === path;

  // Close mobile menu on route change
  useEffect(() => { setIsOpen(false); }, [location.pathname]);

  // Add shadow on scroll
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const links = [
    { path: '/feed', label: 'Feed', icon: Megaphone },
    { path: '/map', label: 'Civic Map', icon: Map },
    { path: '/chat', label: 'Discussion', icon: MessageSquare },
    { path: '/strikes', label: 'Strikes', icon: Flame },
    { path: '/submit', label: 'Report', icon: PlusCircle },
    { path: '/my-account', label: 'Account', icon: User },
  ];

  return (
    <>
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'var(--bg-translucent)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-subtle)',
          boxShadow: scrolled ? 'var(--shadow-md)' : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0 20px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          {/* Logo */}
          <Link
            to="/"
            style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, textDecoration: 'none' }}
          >
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 20,
              background: 'linear-gradient(135deg, var(--teal-400), #6ee7b7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.02em',
            }}>
              CivicTN
            </span>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              padding: '1px 6px',
              borderRadius: 4,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              TN
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div style={{
            display: 'none',
            alignItems: 'center',
            gap: 2,
            flex: 1,
            justifyContent: 'center',
          }}
            className="lg-flex"
          >
            {links.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    color: active ? 'var(--teal-500)' : 'var(--text-secondary)',
                    background: active ? 'var(--teal-glow)' : 'transparent',
                    border: `1px solid ${active ? 'var(--border-default)' : 'transparent'}`,
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.color = 'var(--text-primary)';
                      e.currentTarget.style.background = 'var(--bg-elevated)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <Icon size={14} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right Side — Auth */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <SignedIn>
              {/* Notification bell — UI only */}
              <div style={{ position: 'relative', display: 'none' }} className="lg-block">
                <button style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  <Bell size={15} />
                </button>
              </div>

              {/* Role chip + avatar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 24,
                padding: '4px 10px 4px 4px',
              }}
                className="lg-only"
              >
                {role && role !== 'citizen' && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--teal-500)',
                    background: 'var(--teal-glow)',
                    border: '1px solid var(--border-default)',
                    padding: '1px 7px',
                    borderRadius: 4,
                  }}>
                    {role}
                  </span>
                )}
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: 'w-7 h-7 border border-teal-500/40',
                    }
                  }}
                />
              </div>

              {/* Mobile: just avatar */}
              <div className="lg-hidden">
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: 'w-7 h-7 border border-teal-500/40',
                    }
                  }}
                />
              </div>
            </SignedIn>

            <SignedOut>
              <SignInButton mode="modal">
                <button className="btn btn-primary btn-sm" style={{ display: 'none' }} id="join-btn-desktop">
                  Join Platform
                </button>
              </SignInButton>
              <SignInButton mode="modal">
                <button className="btn btn-primary btn-sm">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>

            {/* Mobile hamburger */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                padding: '7px 8px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              className="lg-hidden-btn"
              aria-label="Toggle navigation"
            >
              {isOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div
            className="animate-slideInDown"
            style={{
              borderTop: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface)',
              padding: '8px 16px 16px',
            }}
          >
            {links.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '11px 12px',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    color: active ? 'var(--teal-500)' : 'var(--text-secondary)',
                    background: active ? 'var(--teal-glow)' : 'transparent',
                    textDecoration: 'none',
                    borderLeft: active ? '2px solid var(--teal-500)' : '2px solid transparent',
                    marginBottom: 2,
                  }}
                >
                  <Icon size={16} />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            <SignedOut>
              <div style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)', marginTop: 8 }}>
                <SignInButton mode="modal">
                  <button className="btn btn-primary" style={{ width: '100%' }}>
                    Join Platform
                  </button>
                </SignInButton>
              </div>
            </SignedOut>
          </div>
        )}
      </nav>

      {/* Responsive style helper — avoids Tailwind dependency for lg: breakpoints */}
      <style>{`
        @media (min-width: 1024px) {
          .lg-flex { display: flex !important; }
          .lg-block { display: block !important; }
          .lg-only { display: flex !important; }
          .lg-hidden { display: none !important; }
          .lg-hidden-btn { display: none !important; }
          #join-btn-desktop { display: inline-flex !important; }
        }
        @media (max-width: 1023px) {
          .lg-only { display: none !important; }
        }
      `}</style>
    </>
  );
}
