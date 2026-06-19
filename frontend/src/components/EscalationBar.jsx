import React from 'react';
import { TrendingUp } from 'lucide-react';

// SRS FR-9: Escalation thresholds
const THRESHOLDS = [
  { count: 50,  label: 'Asst. Engineer',    color: '#f97316' },
  { count: 100, label: 'Exec. Engineer',    color: '#f43f5e' },
  { count: 200, label: 'Mun. Commissioner', color: '#a855f7' },
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
  const level = getLevel(supportCount);
  const next  = getNextThreshold(supportCount);
  const currentThreshold = level >= 0 ? THRESHOLDS[level] : null;

  // Calculate fill percentage toward next threshold
  const prevCount = level >= 0 ? THRESHOLDS[level].count : 0;
  const nextCount = next ? next.count : THRESHOLDS[THRESHOLDS.length - 1].count;
  const rangeSize = nextCount - prevCount;
  const progress  = next ? Math.min(((supportCount - prevCount) / rangeSize) * 100, 100) : 100;

  const barColor = next
    ? next.color
    : THRESHOLDS[THRESHOLDS.length - 1].color;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <TrendingUp size={11} style={{ color: barColor }} />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
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
        {!next && (
          <span style={{ fontSize: 10, color: '#a855f7', fontWeight: 700 }}>
            MAX ESCALATION
          </span>
        )}
      </div>
      <div className="escalation-bar">
        <div
          className="escalation-bar-fill"
          style={{ width: `${progress}%`, background: barColor }}
        />
      </div>
    </div>
  );
}
