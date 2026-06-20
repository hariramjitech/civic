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
        className={`sticky top-0 z-50 bg-[var(--bg-translucent)] backdrop-blur-md border-b border-[var(--border-subtle)] transition-all duration-200 ${
          scrolled ? 'shadow-md' : 'shadow-none'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-1.5 flex-shrink-0 no-underline group"
          >
            <span className="font-display font-black text-xl tracking-tight bg-gradient-to-r from-[var(--teal-400)] to-emerald-400 bg-clip-text text-transparent group-hover:opacity-90 transition-opacity">
              CivicTN
            </span>
            <span className="text-[10px] font-bold text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded tracking-wider uppercase">
              TN
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            {links.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 border ${
                    active
                      ? 'text-[var(--teal-500)] bg-[var(--teal-glow)] border-[var(--border-default)] shadow-sm'
                      : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                  }`}
                >
                  <Icon size={13} className={active ? 'text-[var(--teal-500)]' : 'text-[var(--text-muted)]'} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right Side — Auth */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <SignedIn>
              {/* Notification bell — UI only */}
              <div className="relative hidden lg:block">
                <button className="bg-[var(--bg-elevated)] hover:bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-xl p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer flex items-center transition-colors duration-150">
                  <Bell size={14} />
                </button>
              </div>

              {/* Role chip + avatar */}
              <div className="hidden lg:flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-full py-1 pr-2.5 pl-1.5">
                {role && role !== 'citizen' && (
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-[var(--teal-500)] bg-[var(--teal-glow)] border border-[var(--border-default)] px-2 py-0.5 rounded">
                    {role}
                  </span>
                )}
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: 'w-6 h-6 border border-teal-500/30 hover:border-teal-500 transition-colors',
                    }
                  }}
                />
              </div>

              {/* Mobile: just avatar */}
              <div className="lg:hidden">
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: 'w-7 h-7 border border-teal-500/30',
                    }
                  }}
                />
              </div>
            </SignedIn>

            <SignedOut>
              <SignInButton mode="modal">
                <button className="btn btn-secondary btn-sm hidden lg:inline-flex">
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
              className="bg-[var(--bg-elevated)] hover:bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-xl p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer flex lg:hidden items-center transition-colors duration-150"
              aria-label="Toggle navigation"
            >
              {isOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="lg:hidden border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 space-y-1 animate-slideInDown">
            {links.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border-l-2 ${
                    active
                      ? 'text-[var(--teal-500)] bg-[var(--teal-glow)] border-l-[var(--teal-500)]'
                      : 'text-[var(--text-secondary)] border-l-transparent hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon size={15} />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            <SignedOut>
              <div className="pt-3 border-t border-[var(--border-subtle)] mt-2">
                <SignInButton mode="modal">
                  <button className="btn btn-primary w-full">
                    Join Platform
                  </button>
                </SignInButton>
              </div>
            </SignedOut>
          </div>
        )}
      </nav>
    </>
  );
}
