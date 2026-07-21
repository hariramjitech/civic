import React from 'react';
import { motion } from 'framer-motion';
import { useMotionVariants } from './animations';

/**
 * StaggerContainer
 * Orchestrates staggered entry of child elements.
 * Wrap with this, then use StaggerItem (or motion.div with staggerItem variant)
 * for each child you want to stagger.
 *
 * @param {React.ReactNode} children
 * @param {string} className - extra CSS classes
 * @param {boolean} inView - if true, uses whileInView; if false, animates immediately on mount
 */
export default function StaggerContainer({
  children,
  className = '',
  inView = true,
}) {
  const variants = useMotionVariants();

  if (inView) {
    return (
      <motion.div
        className={className}
        variants={variants.staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      variants={variants.staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerItem
 * Individual item inside a StaggerContainer.
 * Can optionally accept an `as` prop for semantic elements.
 */
export function StaggerItem({ children, className = '', as: Tag = 'div' }) {
  const variants = useMotionVariants();
  const MotionTag = motion[Tag] || motion.div;

  return (
    <MotionTag className={className} variants={variants.staggerItem}>
      {children}
    </MotionTag>
  );
}
