import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserButton, SignedIn, SignedOut, SignInButton, useUser } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import {
  Megaphone, Map, MessageSquare, Flame,
  Bell, User, Shield, Plus, Zap, Accessibility
} from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';
import { useCivic } from '../context/CivicContext';

/* ─── label transition helper ─────────────────────────────────────────── */
const labelStyle = (expanded, isFlexCol = false) => ({
  opacity: expanded ? 1 : 0,
  maxWidth: expanded ? '170px' : '0px',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  transition: 'opacity 0.2s ease, max-width 0.25s cubic-bezier(0.4,0,0.2,1)',
  display: isFlexCol ? 'inline-flex' : 'inline-block',
  ...(isFlexCol ? { flexDirection: 'column' } : {}),
});

export default function Navbar({ role }) {
  const location  = useLocation();
  const { user }  = useUser();
  const { setIsWidgetOpen } = useAccessibility();
  const { hideMobileBottomNav } = useCivic();
  const [expanded, setExpanded] = useState(false);

  const isActive = (path) => location.pathname === path;

  const links = [
    { path: '/feed',       label: 'Feed',        icon: Megaphone },
    { path: '/map',        label: 'Civic Map',   icon: Map },
    { path: '/chat',       label: 'Discussion',  icon: MessageSquare },
    { path: '/strikes',    label: 'Strikes',     icon: Flame },
    { path: '/my-account', label: 'Profile',     icon: User },
  ];

  const displayName = user?.firstName || user?.username || 'Civic User';

  /* ── shared icon colour ──────────────────────────────────────────────── */
  const iconColor = (active) =>
    active ? 'var(--teal-500)' : 'var(--text-muted)';

  return (
    <>
      {/* ═══════════════════════════════════════ DESKTOP SIDEBAR ═══════════════════════════════════════ */}
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{
          width: expanded ? '240px' : '64px',
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
        className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-50 overflow-hidden
                   border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-lg"
      >
        {/* Brand Header */}
        <div className="flex items-center h-16 px-3 border-b border-[var(--border-subtle)] flex-shrink-0">
          <Link to="/" className="flex items-center gap-3 no-underline flex-shrink-0 w-full overflow-hidden">
            {/* Logo icon — 40x40 centered box */}
            <div
              className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center shadow-md transition-transform duration-200 hover:scale-105"
              style={{ background: 'linear-gradient(135deg, var(--teal-500), var(--teal-600))' }}
            >
              <Zap size={20} className="text-white" />
            </div>

            {/* Brand text — slides in on hover */}
            <div style={labelStyle(expanded, true)} className="justify-center min-w-0">
              <span className="font-display font-black text-[16px] tracking-tight text-[var(--text-primary)] leading-none">
                CivicTN
              </span>
              <span className="text-[8.5px] font-bold tracking-widest text-[var(--text-muted)] uppercase mt-1 leading-none">
                Smart Infrastructure
              </span>
            </div>
          </Link>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto overflow-x-hidden" aria-label="Desktop sidebar navigation">
          {links.map(({ path, label, icon: Icon }) => {
            const active = isActive(path);
            return (
              <Link
                key={path}
                to={path}
                title={!expanded ? label : undefined}
                className={`group flex items-center h-10 rounded-xl text-sm font-semibold
                            transition-colors duration-150 no-underline relative overflow-hidden
                            ${active
                              ? 'text-[var(--text-primary)] font-bold'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
              >
                {/* Active spring pill */}
                {active ? (
                  <motion.div
                    layoutId="desktop-nav-active"
                    className="absolute inset-0 rounded-xl bg-[var(--bg-elevated)]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                ) : (
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 bg-[var(--bg-elevated)] transition-opacity duration-150" />
                )}

                {/* Icon wrapper — fixed 40x40 touch target centered in 64px bar */}
                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center relative z-10">
                  <Icon
                    size={20}
                    strokeWidth={active ? 2.25 : 1.75}
                    style={{ color: iconColor(active) }}
                  />
                </div>

                {/* Label — slides in on hover */}
                <span
                  className="relative z-10 min-w-0"
                  style={{
                    ...labelStyle(expanded),
                    color: active ? 'var(--text-primary)' : 'inherit',
                  }}
                >
                  {label}
                </span>

                {/* Active indicator dot — only when expanded */}
                {active && expanded && (
                  <span
                    className="ml-auto mr-3 w-1.5 h-1.5 rounded-full z-10 flex-shrink-0"
                    style={{ background: 'var(--teal-500)' }}
                  />
                )}
              </Link>
            );
          })}

          {/* Admin link */}
          {role && role !== 'citizen' && (
            <Link
              to="/admin"
              title={!expanded ? 'Admin Panel' : undefined}
              className={`group flex items-center h-10 rounded-xl text-sm font-semibold
                          transition-colors duration-150 no-underline relative overflow-hidden
                          ${isActive('/admin')
                            ? 'text-rose-500 bg-rose-500/10 font-bold'
                            : 'text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/5'
                          }`}
            >
              <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center relative z-10">
                <Shield
                  size={20}
                  strokeWidth={isActive('/admin') ? 2.25 : 1.75}
                  style={{ color: isActive('/admin') ? 'var(--rose-500, #f43f5e)' : 'var(--text-muted)' }}
                />
              </div>
              <span className="relative z-10 min-w-0" style={labelStyle(expanded)}>Admin Panel</span>
            </Link>
          )}

          {/* Accessibility link */}
          <button
            onClick={() => setIsWidgetOpen(true)}
            title={!expanded ? 'Accessibility' : undefined}
            className="w-full flex items-center h-10 rounded-xl text-sm font-semibold
                       transition-colors duration-150 border-none bg-transparent
                       text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]
                       cursor-pointer text-left focus:outline-none relative overflow-hidden"
          >
            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center relative z-10">
              <Accessibility size={20} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
            </div>
            <span className="relative z-10 min-w-0" style={labelStyle(expanded)}>Accessibility</span>
          </button>
        </nav>

        {/* Bottom Section: Report Issue + Profile */}
        <div className="p-3 border-t border-[var(--border-subtle)] space-y-2 flex-shrink-0">
          <SignedIn>
            {/* Report Issue CTA */}
            <Link
              to="/submit"
              title={!expanded ? 'Report Issue' : undefined}
              className="flex items-center h-10 rounded-xl text-sm font-bold text-white
                         no-underline transition-all duration-200 shadow-md hover:shadow-lg
                         hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, var(--teal-500), var(--teal-600))',
              }}
            >
              <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                <Plus size={20} strokeWidth={2.5} className="text-white" />
              </div>
              <span
                style={{
                  ...labelStyle(expanded),
                  maxWidth: expanded ? '130px' : '0px',
                }}
                className="text-white font-bold"
              >
                Report Issue
              </span>
            </Link>

            {/* Profile row */}
            <div
              title={!expanded ? displayName : undefined}
              className="flex items-center h-10 rounded-xl hover:bg-[var(--bg-elevated)] transition-all duration-200 cursor-pointer overflow-hidden group"
            >
              <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                <UserButton
                  appearance={{
                    elements: { userButtonAvatarBox: 'w-7 h-7 ring-2 ring-[var(--border-default)] group-hover:ring-[var(--teal-500)] transition-all' },
                  }}
                />
              </div>
              <div
                style={{
                  ...labelStyle(expanded, true),
                  maxWidth: expanded ? '140px' : '0px',
                }}
                className="justify-center min-w-0"
              >
                <span className="text-xs font-bold text-[var(--text-primary)] truncate">{displayName}</span>
                {role && role !== 'citizen' && (
                  <span className="text-[8px] font-black tracking-widest uppercase mt-0.5" style={{ color: 'var(--teal-500)' }}>
                    {role}
                  </span>
                )}
              </div>
            </div>
          </SignedIn>

          <SignedOut>
            <SignInButton mode="modal">
              <button
                title={!expanded ? 'Sign In' : undefined}
                className="flex items-center h-10 w-full rounded-xl text-sm font-bold text-white
                           border-none cursor-pointer overflow-hidden transition-all duration-200 shadow-md hover:shadow-lg
                           hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, var(--teal-500), var(--teal-600))',
                }}
              >
                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                  <User size={20} strokeWidth={2.25} className="text-white" />
                </div>
                <span
                  style={{
                    ...labelStyle(expanded),
                    maxWidth: expanded ? '130px' : '0px',
                  }}
                  className="text-white font-bold"
                >
                  Join CivicTN
                </span>
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </aside>

      {/* ═══════════════════════════════════════ MOBILE TOP HEADER ═══════════════════════════════════════ */}
      <header className="flex lg:hidden fixed top-0 left-0 right-0 h-14 bg-[var(--bg-surface)]/90
                         border-b border-[var(--border-subtle)] items-center justify-between px-4 z-40 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-2 no-underline">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--teal-500), var(--teal-600))' }}
          >
            <Zap size={14} className="text-white" />
          </div>
          <span className="font-display font-black text-sm tracking-tight text-[var(--text-primary)]">CivicTN</span>
        </Link>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsWidgetOpen(true)}
            className="p-2 rounded-xl transition-colors text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] cursor-pointer focus:outline-none"
            aria-label="Accessibility Settings"
          >
            <Accessibility size={18} strokeWidth={1.75} />
          </button>

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
                elements: { userButtonAvatarBox: 'w-7 h-7 ring-2 ring-[var(--border-default)]' },
              }}
            />
          </SignedIn>

          <SignedOut>
            <SignInButton mode="modal">
              <button className="text-xs font-bold text-white px-3 py-1.5 rounded-lg border-none cursor-pointer transition-colors"
                style={{ background: 'var(--teal-500)' }}>
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </header>

      {/* ═══════════════════════════════════════ MOBILE BOTTOM NAV ═══════════════════════════════════════ */}
      {!hideMobileBottomNav && (
        <nav
          className="mobile-bottom-nav flex lg:hidden fixed bottom-0 left-0 right-0 z-40"
          aria-label="Mobile bottom navigation"
        >
          {[
            { to: '/feed',       icon: Megaphone, label: 'Feed' },
            { to: '/map',        icon: Map,        label: 'Map' },
            { to: '/submit',     icon: Plus,       label: 'Report', isCreate: true },
            { to: '/strikes',    icon: Flame,      label: 'Strikes' },
            { to: '/my-account', icon: User,       label: 'Me' },
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
                  <div
                    className="w-10 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, var(--teal-500), var(--teal-600))' }}
                  >
                    <Plus size={18} className="text-white" strokeWidth={2.5} />
                  </div>
                ) : (
                  <div className="relative">
                    <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
                    {active && (
                      <motion.div
                        layoutId="mobile-nav-dot"
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                        style={{ background: 'var(--teal-500)' }}
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
