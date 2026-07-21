import React from 'react';
import { motion } from 'framer-motion';
import { useMotionVariants } from './animations';

/**
 * RevealOnScroll
 * Wraps children in a motion.div that animates into view when scrolled to.
 * Respects prefers-reduced-motion.
 *
 * @param {React.ReactNode} children
 * @param {'fadeUp'|'fadeIn'|'scaleIn'} variant - which entrance animation to use
 * @param {number} delay - optional stagger delay in seconds
 * @param {string} className - extra CSS classes on the wrapper
 * @param {object} margin - viewport intersection margin (default triggers 80px before edge)
 */
export default function RevealOnScroll({
  children,
  variant = 'fadeUp',
  delay = 0,
  className = '',
  margin = '-60px',
}) {
  const variants = useMotionVariants();
  const v = variants[variant] || variants.fadeUp;

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin }}
      variants={{
        hidden: v.hidden,
        visible: {
          ...v.visible,
          transition: {
            ...v.visible?.transition,
            delay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
