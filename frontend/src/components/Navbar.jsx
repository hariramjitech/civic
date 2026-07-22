import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserButton, SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone, Map, MessageSquare, Flame,
  PlusCircle, Bell, User, Shield, Menu, X, ArrowRight
} from 'lucide-react';

export default function Navbar({ role }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isActive = (path) => location.pathname === path;

  // Close mobile menu on route change
  useEffect(() => { setIsOpen(false); }, [location.pathname]);

  // Track page scroll to add compact styling
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 15);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const links = [
    { path: '/feed',    label: 'Feed',       icon: Megaphone },
    { path: '/map',     label: 'Civic Map',  icon: Map },
    { path: '/chat',    label: 'Discussion', icon: MessageSquare },
    { path: '/strikes', label: 'Strikes',    icon: Flame },
  ];

  return (
    <header className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 md:px-8 pointer-events-none">
      {/* Floating Pill Container */}
      <div
        className={`w-full max-w-6xl rounded-2xl bg-white/75 dark:bg-slate-900/75 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-lg shadow-lg pointer-events-auto transition-all duration-300 ${
          scrolled
            ? 'py-2.5 px-5 md:px-6 shadow-xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl'
            : 'py-3.5 px-6 md:px-8 shadow-md'
        } flex items-center justify-between relative`}
      >
        {/* Left Side: Logo */}
        <div className="flex-1 flex items-center justify-start z-10">
          <Link
            to="/"
            className="flex items-center gap-2.5 no-underline group"
            aria-label="CivicTN — Home"
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md group-hover:rotate-6 transition-transform duration-300"
              style={{ background: 'linear-gradient(135deg, var(--teal-500), var(--teal-400))' }}
            >
              <PlusCircle size={16} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span
                className="font-display font-black text-base tracking-tight text-slate-900 dark:text-white leading-none"
              >
                CivicTN
              </span>
              <span className="text-[7.5px] font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase mt-0.5">
                Solid Infrastructure
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Navigation Links (Desktop) */}
        <nav className="hidden lg:flex items-center justify-center gap-7 z-10" aria-label="Main navigation">
          {links.map((link) => {
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className="relative text-sm font-semibold tracking-tight no-underline transition-colors duration-200 text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white flex items-center gap-1.5 group py-1"
                aria-current={active ? 'page' : undefined}
              >
                <span>{link.label}</span>
                {/* Active Indicator Underline */}
                {active && (
                  <motion.div
                    layoutId="activeUnderline"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: 'var(--teal-500)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                {!active && (
                  <span
                    className="absolute -bottom-1 left-0 w-0 h-0.5 rounded-full transition-all duration-200 group-hover:w-full"
                    style={{ background: 'rgba(13,148,136,0.45)' }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Side: Auth Actions & Notification */}
        <div className="flex-1 flex items-center justify-end gap-3.5 z-10">
          <SignedIn>
            {/* Notification Bell */}
            <div className="relative">
              <button
                className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 rounded-full p-2 cursor-pointer flex items-center justify-center transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                style={{ outline: 'none' }}
                aria-label="Notifications"
              >
                <Bell size={15} className="text-slate-600 dark:text-slate-400" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500">
                  <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-75" />
                </span>
              </button>
            </div>

            {/* Clerk Avatar trigger */}
            <div className="flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/40 dark:border-slate-700/40 rounded-full py-0.5 pr-2.5 pl-1">
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: 'w-6 h-6 border shadow-sm border-slate-200/50 dark:border-slate-700/50',
                  }
                }}
              />
              {role && role !== 'citizen' && (
                <span
                  className="text-[7.5px] font-black uppercase tracking-widest px-1 rounded-md hidden sm:inline-block"
                  style={{
                    color: 'var(--teal-500)',
                    background: 'var(--teal-glow)',
                  }}
                >
                  {role}
                </span>
              )}
            </div>

            {/* CTA Button: Report Issue */}
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="hidden md:block"
            >
              <Link
                to="/submit"
                className="btn btn-primary rounded-full text-xs px-4.5 py-2 flex items-center gap-1.5 no-underline shadow-teal"
                aria-label="Report a civic issue"
              >
                Report Issue
                <ArrowRight size={13} />
              </Link>
            </motion.div>
          </SignedIn>

          <SignedOut>
            <SignInButton mode="modal">
              <button className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xs font-bold px-2.5 py-1.5 transition-colors cursor-pointer focus-visible:outline-none">
                Sign in
              </button>
            </SignInButton>
            <SignInButton mode="modal">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="btn btn-primary rounded-full px-4.5 py-2 text-xs font-bold flex items-center gap-1 cursor-pointer shadow-teal"
                aria-label="Join the CivicTN platform"
              >
                Join Platform
                <ArrowRight size={13} />
              </motion.button>
            </SignInButton>
          </SignedOut>

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 rounded-full p-2 cursor-pointer flex lg:hidden items-center justify-center transition-colors focus-visible:outline-none"
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={16} className="text-slate-600 dark:text-slate-400" /> : <Menu size={16} className="text-slate-600 dark:text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute top-[4.5rem] left-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border border-slate-200/50 dark:border-slate-800/50 rounded-2xl shadow-2xl p-4 space-y-1.5 pointer-events-auto overflow-hidden"
            role="navigation"
            aria-label="Mobile navigation"
          >
            {links.map((link, idx) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <div key={link.path}>
                  <Link
                    to={link.path}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors no-underline ${
                      active
                        ? 'text-[var(--teal-600)] bg-[var(--teal-glow)]'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    <Icon size={14} style={{ color: active ? 'var(--teal-500)' : undefined }} className={!active ? 'text-slate-400' : ''} />
                    <span>{link.label}</span>
                  </Link>
                </div>
              );
            })}

            <SignedOut>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-2 flex flex-col gap-2">
                <SignInButton mode="modal">
                  <button className="btn btn-primary rounded-full w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1">
                    Join Platform
                    <ArrowRight size={13} />
                  </button>
                </SignInButton>
              </div>
            </SignedOut>

            <SignedIn>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
                <Link
                  to="/submit"
                  className="btn btn-primary rounded-full w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 no-underline"
                >
                  Report Issue
                  <ArrowRight size={13} />
                </Link>
              </div>
            </SignedIn>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
