import React from 'react';
import { SignInButton, SignedIn, SignedOut } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { ShieldCheck, EyeOff, Radio, Users, MapPin, ArrowRight } from 'lucide-react';

export default function Landing() {
  const features = [
    {
      title: '100% Anonymous Reporting',
      description: 'Your identity is protected using advanced cryptography. No names or accounts are linked to your posts.',
      icon: EyeOff,
      color: 'text-teal-400 border-teal-500/20 bg-teal-500/5',
    },
    {
      title: 'Smart AI Classification',
      description: 'Gemini AI automatically reads your image to identify the issue category, severity, and tags instantly.',
      icon: Radio,
      color: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
    },
    {
      title: 'Auto-Attached TN Contacts',
      description: 'Location coordinates automatically resolve your Tamil Nadu district to attach phone/email contacts for action.',
      icon: MapPin,
      color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
    },
    {
      title: 'Collective Strike Rooms',
      description: 'High-severity issues open Strike Rooms. Join to build collective support, automatically escalating to officials.',
      icon: Users,
      color: 'text-rose-400 border-rose-500/20 bg-rose-500/5',
    },
  ];

  return (
    <div className="relative min-h-[80vh] flex flex-col justify-center py-6 sm:py-12">
      {/* Graphic elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-gradient-to-tr from-teal-500/10 to-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Hero Header */}
      <div className="text-center space-y-6 max-w-4xl mx-auto z-10">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-teal-500/20 bg-teal-500/10 text-teal-400 text-xs font-semibold uppercase tracking-wider">
          <ShieldCheck size={14} />
          <span>Secured Civic Platform of Tamil Nadu</span>
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-none font-display">
          Report Civic Issues.
          <span className="block mt-2 bg-gradient-to-r from-teal-400 via-emerald-400 to-amber-400 bg-clip-text text-transparent">
            Anonymously. Instantly.
          </span>
        </h1>
        
        <p className="text-gray-400 text-base sm:text-xl max-w-2xl mx-auto font-sans leading-relaxed">
          CivicTN connects citizens directly to local officials without exposing personal identities. 
          Upload an image, let Gemini AI analyze it, and mobilize community support to resolve infrastructure failures.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <SignedIn>
            <Link 
              to="/feed" 
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-3.5 rounded-xl font-bold bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-gray-900 shadow-xl shadow-teal-500/10 hover:shadow-teal-400/25 transition-all"
            >
              <span>Explore Social Feed</span>
              <ArrowRight size={18} />
            </Link>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-3.5 rounded-xl font-bold bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-gray-900 shadow-xl shadow-teal-500/10 hover:shadow-teal-400/25 transition-all select-none cursor-pointer">
                <span>Sign In / Sign Up</span>
                <ArrowRight size={18} />
              </button>
            </SignInButton>
          </SignedOut>
          
          <Link 
            to="/map" 
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold border border-gray-800 bg-gray-950/40 hover:bg-gray-900/60 hover:text-white transition-all text-center"
          >
            View Infrastructure Map
          </Link>
        </div>
      </div>

      {/* Grid Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto mt-16 sm:mt-24 z-10 px-4">
        {features.map((feature, idx) => {
          const Icon = feature.icon;
          return (
            <div 
              key={idx} 
              className="glass-panel p-6 sm:p-8 rounded-2xl flex flex-col sm:flex-row items-start gap-4 hover:border-gray-700 transition-all group"
            >
              <div className={`p-3 rounded-xl border ${feature.color} flex-shrink-0`}>
                <Icon size={24} className="group-hover:scale-110 transition-transform duration-300" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-bold text-gray-100 font-display">
                  {feature.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Basic Metrics Display */}
      <div className="mt-16 sm:mt-24 py-8 border-t border-gray-900 max-w-4xl mx-auto text-center z-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-4">
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-teal-400 font-display">25+</div>
            <div className="text-xs sm:text-sm text-gray-500 uppercase font-semibold mt-1">Districts Seeded</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 font-display">100%</div>
            <div className="text-xs sm:text-sm text-gray-500 uppercase font-semibold mt-1">Hashed Anonymity</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-amber-400 font-display">Realtime</div>
            <div className="text-xs sm:text-sm text-gray-500 uppercase font-semibold mt-1">Chat & Strikes</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-rose-400 font-display">Gemini AI</div>
            <div className="text-xs sm:text-sm text-gray-500 uppercase font-semibold mt-1">Moderated Platform</div>
          </div>
        </div>
      </div>
    </div>
  );
}
