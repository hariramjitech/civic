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
    <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 60 }}>

      {/* ── HERO ── */}
      <section style={{ textAlign: 'center', padding: '60px 0 48px' }} className="animate-slideInUp">
        {/* Platform badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 20,
          border: '1px solid rgba(20,184,166,0.2)',
          background: 'rgba(20,184,166,0.06)',
          color: 'var(--teal-400)',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom: 24,
        }}>
          <ShieldCheck size={12} />
          Tamil Nadu Civic Platform
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(32px, 6vw, 58px)',
          fontWeight: 900,
          lineHeight: 1.08,
          letterSpacing: '-0.03em',
          color: 'var(--text-primary)',
          marginBottom: 20,
        }}>
          Report Civic Issues.
          <span style={{
            display: 'block',
            background: 'linear-gradient(135deg, var(--teal-400) 0%, #6ee7b7 50%, #34d399 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Anonymously. Instantly.
          </span>
        </h1>

        <p style={{
          fontSize: 16,
          color: 'var(--text-secondary)',
          maxWidth: 560,
          margin: '0 auto 32px',
          lineHeight: 1.7,
        }}>
          CivicTN bridges citizens and government without exposing identities.
          Upload evidence, let AI classify it, and mobilize community support to resolve
          infrastructure failures across Tamil Nadu.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          <SignedIn>
            <Link to="/feed" className="btn btn-primary btn-lg">
              Explore Feed <ArrowRight size={16} />
            </Link>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn btn-primary btn-lg">
                Get Started Free <ArrowRight size={16} />
              </button>
            </SignInButton>
          </SignedOut>
          <Link to="/map" className="btn btn-secondary btn-lg">
            <MapPin size={16} />
            View Civic Map
          </Link>
        </div>
      </section>

      {/* ── METRICS STRIP ── */}
      <section className="metrics-grid">
        {METRICS.map((m, i) => (
          <div key={i} style={{
            background: 'var(--bg-surface)',
            padding: '20px 16px',
            textAlign: 'center',
          }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 800,
              color: m.color,
              lineHeight: 1,
              marginBottom: 6,
            }}>
              {liveStats && i === 0 ? `${liveStats.districts || 25}+` : m.value}
            </div>
            <div className="section-label">{m.label}</div>
          </div>
        ))}
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ marginBottom: 56 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Process</div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 800,
            color: 'var(--text-primary)',
          }}>
            How CivicTN Works
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}>
          {HOW_IT_WORKS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={idx} className="card" style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
                {/* Step number watermark */}
                <div style={{
                  position: 'absolute',
                  top: 12,
                  right: 16,
                  fontFamily: 'var(--font-display)',
                  fontSize: 48,
                  fontWeight: 900,
                  color: 'rgba(255,255,255,0.03)',
                  lineHeight: 1,
                }}>
                  {step.step}
                </div>

                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `${step.color}15`,
                  border: `1px solid ${step.color}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <Icon size={20} style={{ color: step.color }} />
                </div>

                <h3 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: 8,
                }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── FEATURE GRID ── */}
      <section style={{ marginBottom: 56 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Platform Capabilities</div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 800,
            color: 'var(--text-primary)',
          }}>
            Built for Impact
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 12,
        }}>
          {FEATURES.map((f, idx) => {
            const Icon = f.icon;
            return (
              <div
                key={idx}
                className="card"
                style={{
                  padding: 20,
                  display: 'flex',
                  gap: 16,
                  alignItems: 'flex-start',
                  borderLeft: `3px solid ${f.border}`,
                  transition: 'all 0.2s ease',
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
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: f.bg,
                  border: `1px solid ${f.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={18} style={{ color: f.color }} />
                </div>
                <div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: 5,
                  }}>
                    {f.title}
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {f.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── ESCALATION LEVELS INFO ── */}
      <section style={{ marginBottom: 40 }}>
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <TrendingUp size={18} style={{ color: 'var(--teal-400)' }} />
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}>
              Auto-Escalation Engine
            </h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.65 }}>
            Community support votes automatically escalate complaints to higher authorities when thresholds are reached.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { count: '50+', label: 'Community Support', next: '→ Assistant Engineer', color: '#f97316' },
              { count: '100+', label: 'Community Support', next: '→ Executive Engineer', color: '#f43f5e' },
              { count: '200+', label: 'Community Support', next: '→ Municipal Commissioner', color: '#a855f7' },
            ].map((tier, i) => (
              <div key={i} style={{
                flex: 1,
                minWidth: 160,
                padding: '14px 16px',
                borderRadius: 10,
                background: `${tier.color}08`,
                border: `1px solid ${tier.color}20`,
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontWeight: 800,
                  color: tier.color,
                  marginBottom: 2,
                }}>
                  {tier.count}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {tier.label}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: tier.color }}>
                  {tier.next}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BOTTOM ── */}
      <section style={{
        textAlign: 'center',
        padding: '40px 24px',
        background: 'linear-gradient(135deg, rgba(20,184,166,0.06) 0%, rgba(52,211,153,0.04) 100%)',
        border: '1px solid rgba(20,184,166,0.12)',
        borderRadius: 16,
      }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 24,
          fontWeight: 800,
          color: 'var(--text-primary)',
          marginBottom: 10,
        }}>
          Ready to Make Your City Better?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
          Join thousands of citizens holding authorities accountable — anonymously.
        </p>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="btn btn-primary btn-lg">
              Start Reporting — It's Free <ArrowRight size={16} />
            </button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <Link to="/submit" className="btn btn-primary btn-lg">
            Report a Civic Issue <ArrowRight size={16} />
          </Link>
        </SignedIn>
      </section>
    </div>
  );
}
