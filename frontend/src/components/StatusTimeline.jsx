import React from 'react';
import { Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useReducedMotion } from 'framer-motion';

const STEPS = [
  { key: 'reported',    label: 'Reported' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved',   label: 'Resolved' },
];

const ORDER = STEPS.map(s => s.key);

export default function StatusTimeline({ status = 'reported', compact = false }) {
  const shouldReduce = useReducedMotion();
  const currentIdx = ORDER.indexOf(status === 'closed' ? 'resolved' : status);

  return (
    <div className="timeline" aria-label="Complaint status timeline" role="list">
      {STEPS.map((step, idx) => {
        const isDone   = idx < currentIdx;
        const isActive = idx === currentIdx;
        const stateClass = isDone ? 'completed' : isActive ? 'active' : '';

        return (
          <div
            key={step.key}
            className={`timeline-step ${stateClass}`}
            role="listitem"
            aria-current={isActive ? 'step' : undefined}
          >
            <motion.div
              className="timeline-dot"
              initial={shouldReduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: shouldReduce ? 0 : idx * 0.1 + 0.1,
                duration: 0.3,
                ease: [0.34, 1.56, 0.64, 1],
              }}
            >
              {isDone && <Check size={11} strokeWidth={3} color="#fff" />}
              {isActive && (
                <motion.div
                  style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal-500)' }}
                  animate={shouldReduce ? {} : { scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </motion.div>
            {!compact && (
              <span className="timeline-label">{step.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
