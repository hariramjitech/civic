import React from 'react';
import Navbar from './Navbar';
import { useCivic } from '../context/CivicContext';
import { Toaster } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import AccessibilityWidget from './AccessibilityWidget';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

export default function Layout({ children }) {
  const { role, loadingProfile, isSignedIn, hideMobileBottomNav } = useCivic();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-200">

      {/* Multi-layered ambient gradient orbs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Primary top-left brand orb */}
        <div className="absolute -top-32 -left-24 w-[600px] h-[600px] rounded-full opacity-40 dark:opacity-20"
          style={{ background: 'radial-gradient(circle, var(--teal-500) 0%, transparent 68%)' }} />
        {/* Secondary bottom-right accent orb */}
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full opacity-30 dark:opacity-10"
          style={{ background: 'radial-gradient(circle, var(--teal-400) 0%, transparent 70%)' }} />
      </div>

      {/* Toast notifications — aligned with design system */}
      <Toaster
        position="top-right"
        gutter={8}
        containerStyle={{ top: 24 }}
        toastOptions={{
          style: {
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: '16px',
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
      <a href="#main-content" className="skip-link sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-white focus:text-slate-900 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:border">Skip to Main Content</a>

      {/* Responsive Navigation Component */}
      {location.pathname !== '/' && <Navbar role={isSignedIn ? role : null} />}

      {/* Main Content Layout Container */}
      <div className={`flex-1 flex flex-col min-h-screen ${
        location.pathname === '/' 
          ? '' 
          : `lg:pl-[240px] ${hideMobileBottomNav ? 'pb-0' : 'pb-[60px] lg:pb-0'}`
      } relative z-10`}>
        
        {/* Main page content */}
        <main
          id="main-content"
          className={`flex-1 relative w-full ${
            location.pathname === '/' 
              ? 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12' 
              : location.pathname === '/chat' || location.pathname === '/strikes'
                ? 'max-w-none px-0 pt-14 lg:pt-0 pb-0'
                : 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 lg:pt-10 pb-12'
          }`}
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
        {location.pathname === '/' && (
          <footer
            className="py-8 px-4 sm:px-6 lg:px-8 border-t border-[var(--border-subtle)] bg-[var(--bg-translucent)] backdrop-blur-md"
          >
            <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Brand blurb */}
              <div className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shadow-sm"
                  style={{ background: 'linear-gradient(135deg, var(--teal-500), var(--teal-400))' }}
                >
                  <span className="text-white text-[10px] font-black">C</span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  © 2026{' '}
                  <span className="text-[var(--teal-500)] font-bold">CivicTN</span>
                  {' '}— AI-Powered Smart Infrastructure Management
                </p>
              </div>

              {/* Footer links */}
              <nav className="flex gap-5" aria-label="Footer navigation">
                {['Privacy Policy', 'Terms of Service', 'Official Portal'].map((link) => (
                  <a
                    key={link}
                    href="#"
                    className="text-xs text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--teal-500)] hover:underline"
                  >
                    {link}
                  </a>
                ))}
              </nav>
            </div>
          </footer>
        )}
      </div>

      {/* Floating Accessibility Settings Panel */}
      <AccessibilityWidget />
    </div>
  );
}
