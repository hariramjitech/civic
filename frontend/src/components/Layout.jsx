import React from 'react';
import Navbar from './Navbar';
import { useCivic } from '../context/CivicContext';
import { Toaster } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import AccessibilityWidget from './AccessibilityWidget';

export default function Layout({ children }) {
  const { role, loadingProfile, isSignedIn } = useCivic();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-base)',
      color: 'var(--text-primary)',
    }}>
      {/* Subtle ambient gradient — single, not 3 */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: '-20%',
          left: '30%',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(20,184,166,0.04) 0%, transparent 70%)',
        }} />
      </div>

      {/* Toast config */}
      <Toaster
        position="top-right"
        gutter={8}
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: '10px',
            fontSize: '13px',
            fontFamily: 'var(--font-sans)',
          },
          success: {
            iconTheme: { primary: 'var(--teal-500)', secondary: 'var(--bg-base)' },
          },
          error: {
            iconTheme: { primary: '#f43f5e', secondary: 'var(--bg-base)' },
          },
        }}
      />

      {/* Navbar */}
      <Navbar role={isSignedIn ? role : null} />

      {/* Main content */}
      <main style={{
        flex: 1,
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: 1280,
        margin: '0 auto',
        padding: '24px 20px 40px',
      }}>
        {loadingProfile && isSignedIn ? (
          <div style={{
            height: '60vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}>
            <Loader2
              size={32}
              style={{ color: 'var(--teal-500)', animation: 'spin 0.8s linear infinite' }}
            />
            <p style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>
              Syncing civic profile...
            </p>
          </div>
        ) : (
          children
        )}
      </main>

      {/* Footer */}
      <footer style={{
        position: 'relative',
        zIndex: 10,
        borderTop: '1px solid var(--border-subtle)',
        padding: '20px',
        background: 'var(--bg-translucent)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            © 2026 <span style={{ color: 'var(--teal-500)', fontWeight: 600 }}>CivicTN</span> — AI-Powered Smart Infrastructure Management
          </p>
          <div style={{ display: 'flex', gap: 20 }}>
            {['Privacy Policy', 'Terms of Service', 'Official Portal'].map(link => (
              <a
                key={link}
                href="#"
                style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => e.target.style.color = 'var(--teal-500)'}
                onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
      {/* Floating Accessibility Settings Panel */}
      <AccessibilityWidget />
    </div>
  );
}
