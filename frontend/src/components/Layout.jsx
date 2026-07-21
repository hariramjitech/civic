import React from 'react';
import Navbar from './Navbar';
import { useCivic } from '../context/CivicContext';
import { Toaster } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import AccessibilityWidget from './AccessibilityWidget';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

export default function Layout({ children }) {
  const { role, loadingProfile, isSignedIn } = useCivic();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-[var(--text-primary)] transition-colors duration-200">

      {/* Multi-layered ambient gradient orbs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Primary top-left teal orb */}
        <div className="absolute -top-32 -left-24 w-[600px] h-[600px] rounded-full opacity-60"
          style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.07) 0%, transparent 68%)' }} />
        {/* Secondary bottom-right accent orb */}
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full opacity-40"
          style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.05) 0%, transparent 70%)' }} />
        {/* Bottom center subtle warmth */}
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[800px] h-[300px] rounded-full opacity-30"
          style={{ background: 'radial-gradient(ellipse, rgba(13,148,136,0.04) 0%, transparent 70%)' }} />
      </div>

      {/* Toast notifications — aligned with design system */}
      <Toaster
        position="top-right"
        gutter={8}
        containerStyle={{ top: 80 }}
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: '12px',
            fontSize: '13px',
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            backdropFilter: 'blur(12px)',
          },
          success: {
            iconTheme: { primary: 'var(--teal-500)', secondary: '#fff' },
            duration: 3500,
          },
          error: {
            iconTheme: { primary: '#f43f5e', secondary: '#fff' },
            duration: 5000,
          },
          loading: {
            iconTheme: { primary: 'var(--teal-400)', secondary: '#fff' },
          },
        }}
      />

      {/* Skip to Main Content — accessibility */}
      <a href="#main-content" className="skip-link">Skip to Main Content</a>

      {/* Navbar */}
      <Navbar role={isSignedIn ? role : null} />

      {/* Main page content — padded to clear fixed navbar */}
      <main
        id="main-content"
        className="flex-1 relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        style={{ paddingTop: 'calc(var(--nav-height) + 24px)', paddingBottom: '48px' }}
      >
        {loadingProfile && isSignedIn ? (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="text-[var(--teal-500)] animate-spin" />
            <p className="text-[var(--text-muted)] text-sm font-semibold animate-pulse">
              Syncing civic profile...
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Footer */}
      <footer
        className="relative z-10 py-8 px-4"
        style={{
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-translucent)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Brand blurb */}
          <div className="flex items-center gap-3">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center shadow-sm"
              style={{ background: 'linear-gradient(135deg, var(--teal-500), var(--teal-400))' }}
            >
              <span className="text-white text-[10px] font-black">C</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              © 2026{' '}
              <span style={{ color: 'var(--teal-500)', fontWeight: 700 }}>CivicTN</span>
              {' '}— AI-Powered Smart Infrastructure Management
            </p>
          </div>

          {/* Footer links */}
          <nav className="flex gap-5" aria-label="Footer navigation">
            {['Privacy Policy', 'Terms of Service', 'Official Portal'].map((link) => (
              <a
                key={link}
                href="#"
                className="text-xs transition-colors duration-150 hover:underline"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--teal-500)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                {link}
              </a>
            ))}
          </nav>
        </div>
      </footer>

      {/* Floating Accessibility Settings Panel */}
      <AccessibilityWidget />
    </div>
  );
}
