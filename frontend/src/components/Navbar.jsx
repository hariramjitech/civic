import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserButton, SignedIn, SignedOut, SignInButton, useUser } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone, Map, MessageSquare, Flame,
  PlusCircle, Bell, User, Shield, Home, Plus, Zap
} from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';
import { useCivic } from '../context/CivicContext';

export default function Navbar({ role }) {
  const location = useLocation();
  const { user } = useUser();
  const { setIsWidgetOpen } = useAccessibility();
  const { hideMobileBottomNav } = useCivic();
  const isActive = (path) => location.pathname === path;

  const links = [
    { path: '/feed',    label: 'Feed',        icon: Megaphone },
    { path: '/map',     label: 'Civic Map',   icon: Map },
    { path: '/chat',    label: 'Discussion',  icon: MessageSquare },
    { path: '/strikes', label: 'Strikes',     icon: Flame },
    { path: '/my-account', label: 'Profile',  icon: User },
  ];

  const displayName = user?.firstName || user?.username || 'Civic User';

  return (
    <>
      {/* ─────────────────────────────── DESKTOP SIDEBAR ─────────────────────────── */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-[240px] z-50 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        
        {/* Brand */}
        <div className="px-5 pt-6 pb-5">
          <Link to="/" className="flex items-center gap-3 group no-underline">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, var(--teal-500), var(--teal-600))' }}>
              <Zap size={18} className="text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display font-black text-[17px] tracking-tight text-[var(--text-primary)]">CivicTN</span>
              <span className="text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase mt-0.5">Smart Infrastructure</span>
            </div>
          </Link>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 space-y-0.5" aria-label="Desktop sidebar navigation">
          {links.map((link) => {
            const active = isActive(link.path);
            const Icon = link.icon;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`nav-link group flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 no-underline relative ${
                  active
                    ? 'text-[var(--text-primary)] font-bold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                {/* Active background pill */}
                {active && (
                  <motion.div
                    layoutId="desktop-nav-active"
                    className="absolute inset-0 rounded-xl bg-[var(--bg-elevated)]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <div className="relative z-10 flex items-center gap-3.5">
                  <Icon
                    size={20}
                    strokeWidth={active ? 2.5 : 1.75}
                    className={active ? 'text-[var(--teal-500)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'}
                  />
                  <span className={active ? 'text-[var(--text-primary)]' : ''}>{link.label}</span>
                </div>
                {/* Active accent dot */}
                {active && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[var(--teal-500)] z-10" />
                )}
              </Link>
            );
          })}



          {/* Admin Link */}
          {role && role !== 'citizen' && (
            <Link
              to="/admin"
              className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 no-underline ${
                isActive('/admin')
                  ? 'text-rose-500 bg-rose-500/8'
                  : 'text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/5'
              }`}
            >
              <Shield size={20} strokeWidth={isActive('/admin') ? 2.5 : 1.75} className={isActive('/admin') ? 'text-rose-500' : ''} />
              <span>Admin Panel</span>
            </Link>
          )}
        </nav>

        {/* Bottom CTA + Profile */}
        <div className="px-3 pb-5 pt-4 border-t border-[var(--border-subtle)] space-y-3">
          <SignedIn>
            {/* Report Issue CTA */}
            <Link
              to="/submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold text-white shadow-teal transition-all no-underline hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, var(--teal-500), var(--teal-600))' }}
            >
              <Plus size={16} strokeWidth={2.5} />
              Report Issue
            </Link>

            {/* Profile Row */}
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer">
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: 'w-8 h-8 ring-2 ring-[var(--border-default)]',
                  }
                }}
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-bold text-[var(--text-primary)] truncate">{displayName}</span>
                {role && role !== 'citizen' && (
                  <span className="text-[8px] font-black tracking-widest text-[var(--teal-500)] uppercase">{role}</span>
                )}
              </div>
            </div>
          </SignedIn>

          <SignedOut>
            <SignInButton mode="modal">
              <button className="w-full text-center py-2.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer border border-[var(--border-default)] rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-overlay)]">
                Sign in
              </button>
            </SignInButton>
            <SignInButton mode="modal">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-2.5 text-center text-xs font-bold text-white rounded-xl cursor-pointer"
                style={{ background: 'linear-gradient(135deg, var(--teal-500), var(--teal-600))' }}
              >
                Join CivicTN
              </motion.button>
            </SignInButton>
          </SignedOut>
        </div>
      </aside>

      {/* ─────────────────────────────── MOBILE TOP HEADER ─────────────────────────── */}
      <header className="flex lg:hidden fixed top-0 left-0 right-0 h-14 bg-[var(--bg-surface)]/90 border-b border-[var(--border-subtle)] items-center justify-between px-4 z-40 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-2 no-underline">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--teal-500), var(--teal-600))' }}>
            <Zap size={14} className="text-white" />
          </div>
          <span className="font-display font-black text-sm tracking-tight text-[var(--text-primary)]">CivicTN</span>
        </Link>

        <div className="flex items-center gap-1">
          <SignedIn>
            <Link
              to="/chat"
              className={`p-2 rounded-xl transition-colors ${isActive('/chat') ? 'text-[var(--teal-500)] bg-[var(--teal-glow)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}
              aria-label="Discussion"
            >
              <MessageSquare size={18} strokeWidth={isActive('/chat') ? 2.5 : 1.75} />
            </Link>

            <button className="p-2 rounded-xl transition-colors text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] relative" aria-label="Notifications">
              <Bell size={18} strokeWidth={1.75} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[var(--bg-surface)]" />
            </button>

            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: 'w-7 h-7 ring-2 ring-[var(--border-default)]',
                }
              }}
            />
          </SignedIn>

          <SignedOut>
            <SignInButton mode="modal">
              <button className="text-xs font-bold bg-[var(--teal-500)] hover:bg-[var(--teal-600)] text-white px-3 py-1.5 rounded-lg border-none cursor-pointer transition-colors">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </header>

      {/* ─────────────────────────────── MOBILE BOTTOM NAV ─────────────────────────── */}
      {!hideMobileBottomNav && (
        <nav
          className="mobile-bottom-nav flex lg:hidden fixed bottom-0 left-0 right-0 z-40"
          aria-label="Mobile bottom navigation"
        >
          {[
            { to: '/feed',      icon: Megaphone,    label: 'Feed' },
            { to: '/map',       icon: Map,          label: 'Map' },
            { to: '/submit',    icon: Plus,         label: 'Report',   isCreate: true },
            { to: '/strikes',   icon: Flame,        label: 'Strikes' },
            { to: '/my-account', icon: User,        label: 'Me' },
          ].map(({ to, icon: Icon, label, isCreate }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={`mobile-nav-item flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all no-underline ${
                  active ? 'text-[var(--teal-500)]' : 'text-[var(--text-muted)]'
                }`}
                aria-label={label}
              >
                {isCreate ? (
                  <div className="w-10 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--teal-500), var(--teal-600))' }}>
                    <Plus size={18} className="text-white" strokeWidth={2.5} />
                  </div>
                ) : (
                  <div className="relative">
                    <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
                    {active && (
                      <motion.div
                        layoutId="mobile-nav-dot"
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--teal-500)]"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </div>
                )}
                <span className={`text-[9px] font-bold ${isCreate ? 'text-[var(--teal-500)]' : ''}`}>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
