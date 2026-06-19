import React from 'react';
import Navbar from './Navbar';
import { useCivic } from '../context/CivicContext';
import { Toaster } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

export default function Layout({ children }) {
  const { role, loadingProfile, isSignedIn } = useCivic();

  return (
    <div className="min-h-screen flex flex-col bg-[#07080b] text-gray-100 selection:bg-teal-500 selection:text-gray-900">
      {/* Dynamic Ambient Background Gradients */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-teal-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute top-[30%] right-[20%] w-[35%] h-[35%] rounded-full bg-amber-500/3 blur-[100px]" />
      </div>

      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'glass-panel text-gray-200 border border-gray-800',
          style: {
            background: 'rgba(17, 24, 39, 0.9)',
            color: '#f3f4f6',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          },
          success: {
            iconTheme: {
              primary: '#14b8a6',
              secondary: '#111827',
            },
          },
        }}
      />

      {/* Main Navbar */}
      <Navbar role={isSignedIn ? role : null} />

      {/* Main Page Area */}
      <main className="flex-1 relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {loadingProfile && isSignedIn ? (
          <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
            <p className="text-gray-400 font-medium font-display tracking-wide animate-pulse">Syncing Civic Profile...</p>
          </div>
        ) : (
          children
        )}
      </main>

      {/* Minimal Sleek Footer */}
      <footer className="relative z-10 border-t border-gray-900/60 bg-gray-950/20 py-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 CivicTN. Empowering citizens through secure anonymous reporting.</p>
          <div className="flex space-x-4">
            <a href="#" className="hover:text-teal-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-teal-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-teal-400 transition-colors">Official Portal</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
