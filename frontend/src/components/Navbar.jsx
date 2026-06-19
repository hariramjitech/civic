import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserButton, SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react';
import { 
  Megaphone, Map, MessageSquare, Flame, 
  PlusCircle, User, Shield, Menu, X 
} from 'lucide-react';

export default function Navbar({ role }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  const links = [
    { path: '/feed', label: 'Feed', icon: Megaphone },
    { path: '/map', label: 'Civic Map', icon: Map },
    { path: '/chat', label: 'Discussion Rooms', icon: MessageSquare },
    { path: '/strikes', label: 'Strike Rooms', icon: Flame },
    { path: '/submit', label: 'Report Issue', icon: PlusCircle },
    { path: '/my-account', label: 'My Activity', icon: User },
  ];

  // Admin and Department/Officer links
  if (role === 'admin' || role === 'department' || role === 'officer') {
    links.push({ path: '/admin', label: 'Admin Panel', icon: Shield });
  }

  return (
    <nav className="sticky top-0 z-50 glass-panel border-b border-gray-800 px-4 sm:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2 select-none group">
          <span className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight bg-gradient-to-r from-teal-400 via-emerald-400 to-amber-500 bg-clip-text text-transparent group-hover:from-teal-300 group-hover:to-amber-400 transition-all">
            CivicTN
          </span>
          <span className="text-xl sm:text-2xl" role="img" aria-label="city">🏙️</span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden lg:flex items-center space-x-1 sm:space-x-2">
          {links.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-250 ${
                  active
                    ? 'bg-gradient-to-r from-teal-500/20 to-emerald-500/10 text-teal-300 border border-teal-500/30 font-semibold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40 border border-transparent'
                }`}
              >
                <Icon size={16} className={active ? 'text-teal-400 animate-pulse' : 'text-gray-500'} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>

        {/* User Auth Buttons */}
        <div className="hidden lg:flex items-center space-x-4">
          <SignedIn>
            <div className="flex items-center space-x-3 bg-gray-900/50 px-3 py-1.5 rounded-full border border-gray-800">
              {role && (
                <span className="text-xs uppercase px-2 py-0.5 rounded font-extrabold tracking-wider bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  {role}
                </span>
              )}
              <UserButton 
                appearance={{
                  elements: {
                    userButtonAvatarBox: 'w-8 h-8 border border-teal-500/50 hover:scale-105 transition-transform'
                  }
                }}
              />
            </div>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-4 py-2 text-sm font-bold rounded-lg bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-gray-900 shadow-lg shadow-teal-500/20 hover:shadow-teal-400/30 transition-all select-none duration-200">
                Join Platform
              </button>
            </SignInButton>
          </SignedOut>
        </div>

        {/* Mobile menu button */}
        <div className="flex lg:hidden items-center space-x-3">
          <SignedIn>
            <UserButton 
              appearance={{
                elements: {
                  userButtonAvatarBox: 'w-8 h-8 border border-teal-500/30'
                }
              }}
            />
          </SignedIn>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 rounded-lg focus:outline-none transition-colors"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="lg:hidden mt-3 px-2 pt-2 pb-4 space-y-1 rounded-xl border border-gray-850 bg-gray-950/95 backdrop-blur-lg animate-fadeIn">
          {links.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-base font-medium transition-all ${
                  active
                    ? 'bg-teal-500/10 text-teal-300 border-l-4 border-teal-500'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900/50'
                }`}
              >
                <Icon size={18} className={active ? 'text-teal-400' : 'text-gray-500'} />
                <span>{link.label}</span>
              </Link>
            );
          })}
          
          <SignedOut>
            <div className="pt-4 px-2">
              <SignInButton mode="modal">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="w-full py-2.5 text-center text-sm font-bold rounded-lg bg-gradient-to-r from-teal-500 to-emerald-600 text-gray-900 shadow-md transition-all"
                >
                  Join Platform
                </button>
              </SignInButton>
            </div>
          </SignedOut>
        </div>
      )}
    </nav>
  );
}
