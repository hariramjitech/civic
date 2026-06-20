import React, { useState, useEffect } from 'react';
import { SignInButton, SignedIn, SignedOut } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, EyeOff, Sparkles, Users, MapPin, ArrowRight,
  Camera, Cpu, PhoneCall, BarChart2, TrendingUp, Clock
} from 'lucide-react';
import api from '../lib/api';

const FEATURES = [
  {
    icon: EyeOff,
    title: '100% Anonymous',
    desc: 'Your identity is protected cryptographically. No names or accounts linked to public posts.',
    color: 'var(--teal-400)',
    bg: 'rgba(20,184,166,0.06)',
    border: 'rgba(20,184,166,0.15)',
  },
  {
    icon: Sparkles,
    title: 'Gemini AI Analysis',
    desc: 'Automatic issue classification, severity scoring, and duplicate detection on every upload.',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.06)',
    border: 'rgba(167,139,250,0.15)',
  },
  {
    icon: MapPin,
    title: 'Auto-Attached Contacts',
    desc: 'GPS coordinates resolve your district and attach the right TN officer details automatically.',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.06)',
    border: 'rgba(52,211,153,0.15)',
  },
  {
    icon: Users,
    title: 'Strike Rooms',
    desc: 'High-severity issues auto-open Strike Rooms. Join to escalate directly to commissioners.',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.06)',
    border: 'rgba(248,113,113,0.15)',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: Camera,
    title: 'Report with Evidence',
    desc: 'Upload a photo of the civic issue, drop a pin on the map, and describe what you see.',
    color: 'var(--teal-400)',
  },
  {
    step: '02',
    icon: Cpu,
    title: 'AI Classifies & Routes',
    desc: 'Gemini AI analyzes the image, assigns severity, detects duplicates, and routes to the right department.',
    color: '#a78bfa',
  },
  {
    step: '03',
    icon: PhoneCall,
    title: 'Authority Gets Notified',
    desc: 'The relevant officer receives the complaint with full evidence. Community support escalates urgency.',
    color: '#34d399',
  },
];

const METRICS = [
  { label: 'Districts Covered', value: '25+', color: 'var(--teal-400)' },
  { label: 'Anonymous by Design', value: '100%', color: '#34d399' },
  { label: 'AI-Powered', value: 'Real-time', color: '#a78bfa' },
  { label: 'Escalation Levels', value: '3-Tier', color: '#f87171' },
];

export default function Landing() {
  const [liveStats, setLiveStats] = useState(null);

  useEffect(() => {
    // Try to load public stats
    api.get('/analytics/public-stats')
      .then(res => setLiveStats(res.data))
      .catch(() => { }); // Graceful fail if endpoint not ready
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 pb-16">

      {/* ── HERO ── */}
      <section className="text-center py-16 md:py-20 animate-slideInUp">
        {/* Platform badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[var(--border-strong)] bg-[var(--teal-glow)] text-[var(--teal-500)] text-xs font-semibold uppercase tracking-wider mb-6">
          <ShieldCheck size={13} className="text-[var(--teal-500)]" />
          Tamil Nadu Civic Platform
        </div>

        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-none text-[var(--text-primary)] mb-5">
          Report Civic Issues.
          <span className="block mt-1 bg-gradient-to-r from-[var(--teal-400)] via-[var(--teal-500)] to-[var(--teal-600)] bg-clip-text text-transparent">
            Anonymously. Instantly.
          </span>
        </h1>

        <p className="text-sm md:text-base text-[var(--text-secondary)] max-w-xl mx-auto mb-8 leading-relaxed">
          CivicTN bridges citizens and government without exposing identities.
          Upload evidence, let AI classify it, and mobilize community support to resolve
          infrastructure failures across Tamil Nadu.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap gap-3 justify-center">
          <SignedIn>
            <Link to="/feed" className="btn btn-primary btn-lg">
              Explore Feed <ArrowRight size={15} />
            </Link>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn btn-primary btn-lg">
                Get Started Free <ArrowRight size={15} />
              </button>
            </SignInButton>
          </SignedOut>
          <Link to="/map" className="btn btn-secondary btn-lg">
            <MapPin size={15} />
            View Civic Map
          </Link>
        </div>
      </section>

      {/* ── METRICS STRIP ── */}
      <section className="metrics-grid">
        {METRICS.map((m, i) => (
          <div key={i} className="bg-[var(--bg-surface)] py-6 px-4 text-center border-b md:border-b-0 md:border-r border-[var(--border-default)] last:border-none">
            <div
              className="font-display text-2xl sm:text-3xl font-black mb-1"
              style={{ color: m.color }}
            >
              {liveStats && i === 0 ? `${liveStats.districts || 25}+` : m.value}
            </div>
            <div className="section-label">{m.label}</div>
          </div>
        ))}
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="mb-16">
        <div className="text-center mb-10">
          <div className="section-label mb-2">Process</div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold text-[var(--text-primary)]">
            How CivicTN Works
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {HOW_IT_WORKS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={idx} className="card p-6 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
                {/* Step number watermark */}
                <div className="absolute top-3 right-4 font-display text-5xl font-black text-[var(--text-muted)] opacity-5 select-none leading-none">
                  {step.step}
                </div>

                <div
                  style={{ background: `${step.color}12`, borderColor: `${step.color}25` }}
                  className="w-10 h-10 rounded-xl border flex items-center justify-center mb-5"
                >
                  <Icon size={20} style={{ color: step.color }} />
                </div>

                <h3 className="font-display text-base font-bold text-[var(--text-primary)] mb-2">
                  {step.title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── FEATURE GRID ── */}
      <section className="mb-16">
        <div className="text-center mb-10">
          <div className="section-label mb-2">Platform Capabilities</div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold text-[var(--text-primary)]">
            Built for Impact
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURES.map((f, idx) => {
            const Icon = f.icon;
            return (
              <div
                key={idx}
                className="card p-5 flex gap-4 items-start border-l-4 transition-all duration-300 hover:scale-[1.01]"
                style={{
                  borderLeftColor: f.border,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderLeftColor = f.color;
                  e.currentTarget.style.background = f.bg;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderLeftColor = f.border;
                  e.currentTarget.style.background = 'var(--bg-surface)';
                }}
              >
                <div
                  style={{ background: f.bg, borderColor: f.border }}
                  className="w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0"
                >
                  <Icon size={18} style={{ color: f.color }} />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-[var(--text-primary)] mb-1">
                    {f.title}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── ESCALATION LEVELS INFO ── */}
      <section className="mb-16">
        <div className="card p-6 md:p-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-[var(--teal-500)]" />
            <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
              Auto-Escalation Engine
            </h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-6 leading-relaxed">
            Community support votes automatically escalate complaints to higher authorities when thresholds are reached.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { count: '50+', label: 'Community Support', next: '→ Assistant Engineer', color: '#f97316' },
              { count: '100+', label: 'Community Support', next: '→ Executive Engineer', color: '#f43f5e' },
              { count: '200+', label: 'Community Support', next: '→ Municipal Commissioner', color: '#a855f7' },
            ].map((tier, i) => (
              <div
                key={i}
                style={{ background: `${tier.color}08`, borderColor: `${tier.color}18` }}
                className="p-4 rounded-xl border flex flex-col justify-between hover:scale-[1.02] transition-transform duration-200"
              >
                <div>
                  <div
                    style={{ color: tier.color }}
                    className="font-display text-2xl font-black mb-1"
                  >
                    {tier.count}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] tracking-wider uppercase font-semibold mb-2">
                    {tier.label}
                  </div>
                </div>
                <div style={{ color: tier.color }} className="text-xs font-bold">
                  {tier.next}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="text-center py-12 px-6 bg-gradient-to-br from-[var(--teal-glow)] to-transparent border border-[var(--border-default)] rounded-2xl shadow-sm">
        <h2 className="font-display text-2xl font-extrabold text-[var(--text-primary)] mb-2.5">
          Ready to Make Your City Better?
        </h2>
        <p className="text-xs md:text-sm text-[var(--text-secondary)] mb-6">
          Join thousands of citizens holding authorities accountable — anonymously.
        </p>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="btn btn-primary btn-lg">
              Start Reporting — It's Free <ArrowRight size={15} />
            </button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <Link to="/submit" className="btn btn-primary btn-lg">
            Report a Civic Issue <ArrowRight size={15} />
          </Link>
        </SignedIn>
      </section>
    </div>
  );
}
