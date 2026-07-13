import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserButton, SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone, Map, MessageSquare, Flame,
  PlusCircle, User, Bell, Menu, X, ArrowRight
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
    { path: '/feed', label: 'Feed', icon: Megaphone },
    { path: '/map', label: 'Civic Map', icon: Map },
    { path: '/chat', label: 'Discussion', icon: MessageSquare },
    { path: '/strikes', label: 'Strikes', icon: Flame },
  ];

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 md:px-8 pointer-events-none"
    >
      {/* Floating Pill Container Docked to Top */}
      <div 
        className={`w-full max-w-6xl rounded-b-[2rem] bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-l border-r border-slate-200/80 dark:border-slate-800/80 shadow-[0_12px_40px_rgba(0,0,0,0.08)] pointer-events-auto transition-all duration-300 ${
          scrolled ? 'py-3.5 px-6 md:px-8' : 'py-4.5 px-8 md:px-10'
        } flex items-center justify-between relative`}
      >
        {/* Left Side: Navigation Links (Desktop) */}
        <nav className="hidden lg:flex items-center gap-6 z-10">
          {links.map((link) => {
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className="relative text-sm font-semibold tracking-tight no-underline transition-colors duration-200 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white flex items-center gap-1.5 group"
              >
                <span>{link.label}</span>
                {/* Active Indicator Underline */}
                {active && (
                  <motion.div
                    layoutId="activeUnderline"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-emerald-500 rounded-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                {!active && (
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-500/50 transition-all duration-200 group-hover:w-full rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Center: Logo (Docked to Center) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-25">
          <Link
            to="/"
            className="flex items-center gap-2 no-underline group"
          >
            {/* Custom runner icon representing "Solidroad" style transition */}
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/10 group-hover:rotate-6 transition-transform duration-200">
              <PlusCircle size={15} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-black text-base tracking-tight text-slate-900 dark:text-white leading-none">
                CivicTN
              </span>
              <span className="text-[7.5px] font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase mt-0.5">
                Solid Infrastructure
              </span>
            </div>
          </Link>
        </div>

        {/* Right Side: Auth Actions & Notification */}
        <div className="flex items-center gap-3.5 z-10">
          
          <SignedIn>
            {/* Notification Bell */}
            <div className="relative">
              <button 
                className="hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full p-2 text-slate-600 dark:text-slate-400 hover:text-emerald-500 cursor-pointer flex items-center justify-center transition-colors relative"
              >
                <Bell size={15} />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500">
                  <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-75" />
                </span>
              </button>
            </div>

            {/* Clerk Avatar trigger */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-full py-0.5 pr-2.5 pl-1">
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: 'w-6 h-6 border border-emerald-500/30 hover:border-emerald-500 transition-colors shadow-sm',
                  }
                }}
              />
              {role && role !== 'citizen' && (
                <span className="text-[7.5px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-500/10 px-1 rounded-md hidden sm:inline-block">
                  {role}
                </span>
              )}
            </div>

            {/* Green CTA Button: Report Issue */}
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="hidden md:block"
            >
              <Link 
                to="/submit" 
                className="btn bg-[#5bb974] hover:bg-[#4baf65] text-white font-bold px-5 py-2.5 rounded-full text-xs shadow-sm border border-emerald-400/10 flex items-center gap-1.5 no-underline transition-colors duration-200"
              >
                Report Issue
                <ArrowRight size={13} />
              </Link>
            </motion.div>
          </SignedIn>

          <SignedOut>
            <SignInButton mode="modal">
              <button className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xs font-bold px-2 py-1 transition-colors cursor-pointer">
                Sign in
              </button>
            </SignInButton>
            <SignInButton mode="modal">
              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="btn bg-[#5bb974] hover:bg-[#4baf65] text-white rounded-full px-5 py-2.5 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors duration-200 shadow-sm"
              >
                Join Platform
                <ArrowRight size={13} />
              </motion.button>
            </SignInButton>
          </SignedOut>

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full p-2 text-slate-600 dark:text-slate-400 hover:text-emerald-500 cursor-pointer flex lg:hidden items-center justify-center transition-colors"
            aria-label="Toggle navigation"
          >
            {isOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer (Matches Solidroad White Theme Dropdown) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute top-20 left-4 right-4 bg-white/90 dark:bg-slate-900/95 backdrop-blur-lg border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl p-4 space-y-1 pointer-events-auto overflow-hidden"
          >
            {links.map((link, idx) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <motion.div
                  key={link.path}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <Link
                    to={link.path}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-colors ${
                      active
                        ? 'text-emerald-600 bg-emerald-500/5'
                        : 'text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    <Icon size={14} className={active ? 'text-emerald-500' : 'text-slate-400'} />
                    <span>{link.label}</span>
                  </Link>
                </motion.div>
              );
            })}

            <SignedOut>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-2 flex flex-col gap-2">
                <SignInButton mode="modal">
                  <button className="btn bg-[#5bb974] hover:bg-[#4baf65] text-white rounded-full w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1">
                    Join Platform
                    <ArrowRight size={13} />
                  </button>
                </SignInButton>
              </div>
            </SignedOut>

            <SignedIn>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
                <Link to="/submit" className="btn bg-[#5bb974] hover:bg-[#4baf65] text-white rounded-full w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5">
                  Report Issue
                  <ArrowRight size={13} />
                </Link>
              </div>
            </SignedIn>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
