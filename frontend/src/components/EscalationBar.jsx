import React from 'react';
import { TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useReducedMotion } from 'framer-motion';

// SRS FR-9: Escalation thresholds
const THRESHOLDS = [
  { count: 50,  label: 'Asst. Engineer',    color: '#f97316', glow: 'rgba(249,115,22,0.25)' },
  { count: 100, label: 'Exec. Engineer',    color: '#f43f5e', glow: 'rgba(244,63,94,0.25)' },
  { count: 200, label: 'Mun. Commissioner', color: '#a855f7', glow: 'rgba(168,85,247,0.25)' },
];

function getLevel(supportCount) {
  if (supportCount >= 200) return 2;
  if (supportCount >= 100) return 1;
  if (supportCount >= 50)  return 0;
  return -1; // not yet escalated
}

function getNextThreshold(supportCount) {
  for (const t of THRESHOLDS) {
    if (supportCount < t.count) return t;
  }
  return null;
}

export default function EscalationBar({ supportCount = 0, className = '' }) {
  const shouldReduce = useReducedMotion();
  const level = getLevel(supportCount);
  const next  = getNextThreshold(supportCount);
  const currentThreshold = level >= 0 ? THRESHOLDS[level] : null;
  const isMaxEscalation = !next;

  // Calculate fill percentage toward next threshold
  const prevCount = level >= 0 ? THRESHOLDS[level].count : 0;
  const nextCount = next ? next.count : THRESHOLDS[THRESHOLDS.length - 1].count;
  const rangeSize = nextCount - prevCount;
  const progress  = next ? Math.min(((supportCount - prevCount) / rangeSize) * 100, 100) : 100;

  const barColor = next
    ? next.color
    : THRESHOLDS[THRESHOLDS.length - 1].color;
  const barGlow = next
    ? next.glow
    : THRESHOLDS[THRESHOLDS.length - 1].glow;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendingUp size={11} style={{ color: barColor }} />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            {currentThreshold
              ? `Escalated → ${currentThreshold.label}`
              : 'Community Pressure'
            }
          </span>
        </div>

        {next && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
            {next.count - supportCount} more → {next.label}
          </span>
        )}
        {isMaxEscalation && (
          <span
            style={{ fontSize: 10, color: '#a855f7', fontWeight: 800, animation: 'pulse 2s infinite' }}
          >
            ⚡ MAX ESCALATION
          </span>
        )}
      </div>

      {/* Progress track */}
      <div
        className="escalation-bar"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Escalation progress: ${Math.round(progress)}%`}
      >
        <motion.div
          className="escalation-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={shouldReduce ? { duration: 0 } : { duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          style={{
            background: isMaxEscalation
              ? `linear-gradient(90deg, ${barColor}, ${barColor}cc)`
              : barColor,
            boxShadow: progress > 20 ? `0 0 8px ${barGlow}` : 'none',
          }}
        />
      </div>
    </div>
  );
}
