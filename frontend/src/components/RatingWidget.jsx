import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export default function RatingWidget({ postId, existingRating = null, onRate, readOnly = false }) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(existingRating || 0);
  const [submitting, setSubmitting] = useState(false);
  const shouldReduce = useReducedMotion();

  const handleRate = async (value) => {
    if (readOnly || submitting) return;
    setSelected(value);
    if (onRate) {
      setSubmitting(true);
      try {
        await onRate(postId, value);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const display = hovered || selected;
  const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
  const labelColors = ['', '#f87171', '#fb923c', '#facc15', '#4ade80', '#2dd4bf'];

  return (
    <div className="flex flex-col gap-2 items-start">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((v) => {
          const filled = v <= display;
          return (
            <motion.button
              key={v}
              className="star-btn focus-visible:outline-none focus-visible:ring-2 rounded-sm"
              style={{ '--tw-ring-color': 'var(--teal-500)' }}
              onMouseEnter={() => !readOnly && setHovered(v)}
              onMouseLeave={() => !readOnly && setHovered(0)}
              onClick={() => handleRate(v)}
              disabled={readOnly || submitting}
              aria-label={`Rate ${v} out of 5${filled && selected === v ? ' — currently selected' : ''}`}
              whileHover={!readOnly && !shouldReduce ? { scale: 1.2, rotate: v <= display ? 5 : 0 } : {}}
              whileTap={!readOnly && !shouldReduce ? { scale: 0.85 } : {}}
              transition={{ duration: 0.15, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <Star
                size={21}
                fill={filled ? '#f59e0b' : 'none'}
                stroke={filled ? '#f59e0b' : 'var(--text-muted)'}
                strokeWidth={filled ? 0 : 1.5}
                className="transition-all duration-150"
              />
            </motion.button>
          );
        })}

        {/* Star rating label */}
        <AnimatePresence mode="wait">
          {display > 0 && (
            <motion.span
              key={display}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 4 }}
              transition={{ duration: 0.15 }}
              style={{ fontSize: 11, fontWeight: 700, color: labelColors[display], marginLeft: 6 }}
            >
              {labels[display]}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Contextual helper text */}
      <AnimatePresence mode="wait">
        {!readOnly && !selected && (
          <motion.p
            key="prompt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ fontSize: 10, color: 'var(--text-muted)' }}
          >
            Rate how satisfied you are with the resolution
          </motion.p>
        )}
        {selected > 0 && !readOnly && (
          <motion.p
            key="thanks"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ fontSize: 10, color: 'var(--sev-low)', fontWeight: 600 }}
          >
            ✓ Thank you for your feedback
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
