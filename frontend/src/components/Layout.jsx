import React from 'react';
import Navbar from './Navbar';
import { useCivic } from '../context/CivicContext';
import { Toaster } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import AccessibilityWidget from './AccessibilityWidget';

export default function Layout({ children }) {
  const { role, loadingProfile, isSignedIn } = useCivic();

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-[var(--text-primary)] transition-colors duration-200">
      {/* Subtle ambient gradient */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] left-[30%] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,_rgba(20,184,166,0.04)_0%,_transparent_70%)]" />
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

      {/* Skip to Main Content Link for accessibility */}
      <a href="#main-content" className="skip-link">Skip to Main Content</a>

      {/* Navbar */}
      <Navbar role={isSignedIn ? role : null} />

      {/* Main content */}
      <main id="main-content" className="flex-1 relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {loadingProfile && isSignedIn ? (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
            <Loader2
              size={32}
              className="text-[var(--teal-500)] animate-spin"
            />
            <p className="text-[var(--text-muted)] text-sm font-semibold animate-pulse">
              Syncing civic profile...
            </p>
          </div>
        ) : (
          children
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--border-subtle)] py-6 px-4 bg-[var(--bg-translucent)] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-[var(--text-muted)]">
            © 2026 <span className="text-[var(--teal-500)] font-semibold">CivicTN</span> — AI-Powered Smart Infrastructure Management
          </p>
          <div className="flex gap-5">
            {['Privacy Policy', 'Terms of Service', 'Official Portal'].map(link => (
              <a
                key={link}
                href="#"
                className="text-xs text-[var(--text-muted)] hover:text-[var(--teal-500)] transition-colors duration-150"
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
