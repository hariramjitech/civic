import React from 'react';
import { Check } from 'lucide-react';

const STEPS = [
  { key: 'reported',    label: 'Submitted' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'assigned',   label: 'Assigned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved',   label: 'Resolved' },
];

const ORDER = STEPS.map(s => s.key);

export default function StatusTimeline({ status = 'reported', compact = false }) {
  const currentIdx = ORDER.indexOf(status === 'closed' ? 'resolved' : status);

  return (
    <div className="timeline" aria-label="Complaint status timeline">
      {STEPS.map((step, idx) => {
        const isDone   = idx < currentIdx;
        const isActive = idx === currentIdx;
        const stateClass = isDone ? 'completed' : isActive ? 'active' : '';

        return (
          <div key={step.key} className={`timeline-step ${stateClass}`}>
            <div className="timeline-dot">
              {isDone && <Check size={11} strokeWidth={3} color="#fff" />}
              {isActive && (
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--teal-500)'
                }} />
              )}
            </div>
            {!compact && (
              <span className="timeline-label">{step.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
