import React from 'react';
import { AlertTriangle, Zap, Minus, CheckCircle } from 'lucide-react';

const CONFIG = {
  critical: { label: 'Critical', icon: Zap,           className: 'severity-badge severity-critical' },
  high:     { label: 'High',     icon: AlertTriangle,  className: 'severity-badge severity-high' },
  medium:   { label: 'Medium',   icon: Minus,          className: 'severity-badge severity-medium' },
  low:      { label: 'Low',      icon: CheckCircle,    className: 'severity-badge severity-low' },
};

export default function SeverityBadge({ severity = 'low', showIcon = true }) {
  const config = CONFIG[severity] || CONFIG.low;
  const Icon = config.icon;

  return (
    <span className={config.className}>
      {showIcon && <Icon size={9} strokeWidth={2.5} />}
      {config.label}
    </span>
  );
}
