import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from 'framer-motion';

/**
 * AnimatedCard
 * Wraps any card-like element in a motion.div with hover lift + scale.
 * Falls back to no transform when prefers-reduced-motion is active.
 *
 * @param {React.ReactNode} children
 * @param {string} className - extra CSS classes (add your .card class here)
 * @param {function} onClick - optional click handler
 * @param {object} style - optional inline styles
 * @param {string} as - HTML element type (default 'div')
 */
export default function AnimatedCard({
  children,
  className = '',
  onClick,
  style,
  as: Tag = 'div',
}) {
  const shouldReduce = useReducedMotion();
  const MotionTag = motion[Tag] || motion.div;

  const hoverProps = shouldReduce
    ? {}
    : {
        whileHover: {
          y: -5,
          boxShadow:
            '0 16px 40px rgba(15, 23, 42, 0.10), 0 4px 12px rgba(15, 23, 42, 0.05)',
        },
        whileTap: { scale: 0.99, y: -2 },
        transition: {
          duration: 0.28,
          ease: [0.34, 1.56, 0.64, 1],
        },
      };

  return (
    <MotionTag
      className={className}
      style={style}
      onClick={onClick}
      {...hoverProps}
    >
      {children}
    </MotionTag>
  );
}
