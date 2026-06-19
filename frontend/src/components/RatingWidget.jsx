import React, { useState } from 'react';
import { Star } from 'lucide-react';

export default function RatingWidget({ postId, existingRating = null, onRate, readOnly = false }) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(existingRating || 0);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {[1, 2, 3, 4, 5].map(v => (
          <button
            key={v}
            className={`star-btn ${v <= display ? 'active' : ''}`}
            onMouseEnter={() => !readOnly && setHovered(v)}
            onMouseLeave={() => !readOnly && setHovered(0)}
            onClick={() => handleRate(v)}
            disabled={readOnly || submitting}
            aria-label={`Rate ${v} out of 5`}
          >
            <Star
              size={20}
              fill={v <= display ? '#eab308' : 'none'}
              stroke={v <= display ? '#eab308' : 'currentColor'}
              strokeWidth={v <= display ? 0 : 1.5}
            />
          </button>
        ))}
        {display > 0 && (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#eab308',
            marginLeft: 4
          }}>
            {labels[display]}
          </span>
        )}
      </div>
      {!readOnly && !selected && (
        <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Rate how satisfied you are with the resolution
        </p>
      )}
      {selected > 0 && !readOnly && (
        <p style={{ fontSize: 10, color: 'var(--sev-low)' }}>
          ✓ Thank you for your feedback
        </p>
      )}
    </div>
  );
}
