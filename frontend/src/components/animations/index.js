/**
 * CivicTN — Shared Framer Motion Variants & Utilities
 * All variants respect prefers-reduced-motion via the shouldReduceMotion flag.
 * Import { motionVariants, getVariant } from here, then pass to motion components.
 */
import { useReducedMotion } from 'framer-motion';

// Re-export Framer's hook so callers don't need to import framer-motion directly
export { useReducedMotion };

/**
 * Returns variant objects that collapse to instant transitions when
 * prefers-reduced-motion is active.
 */
export function useMotionVariants() {
  const reduce = useReducedMotion();
  return reduce ? reducedVariants : motionVariants;
}

/** Full-motion variants — rich animations for those who want them */
export const motionVariants = {
  /** Fade up from 18px below — default card/section reveal */
  fadeUp: {
    hidden: { opacity: 0, y: 18 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
    },
  },

  /** Simple fade in — for overlays and tooltips */
  fadeIn: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
    },
  },

  /** Scale from 94% — for modals and popovers */
  scaleIn: {
    hidden: { opacity: 0, scale: 0.94 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.28, ease: [0.34, 1.56, 0.64, 1] },
    },
    exit: {
      opacity: 0,
      scale: 0.96,
      transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
    },
  },

  /** Slide from left — for sidebars and drawers */
  slideInLeft: {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
    },
    exit: {
      opacity: 0,
      x: -16,
      transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
    },
  },

  /** Stagger container — orchestrates children with 0.08s delay each */
  staggerContainer: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.05,
      },
    },
  },

  /** Individual stagger child — pairs with staggerContainer */
  staggerItem: {
    hidden: { opacity: 0, y: 14 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
    },
  },
};

/** Reduced-motion variants — no transforms, only fast opacity transitions */
export const reducedVariants = {
  fadeUp: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.15 } },
  },
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.15 } },
  },
  scaleIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.1 } },
    exit: { opacity: 0, transition: { duration: 0.1 } },
  },
  slideInLeft: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.15 } },
    exit: { opacity: 0, transition: { duration: 0.1 } },
  },
  staggerContainer: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0, delayChildren: 0 } },
  },
  staggerItem: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.15 } },
  },
};

/** Shared hover/tap gestures for interactive elements */
export const gestureProps = {
  card: {
    whileHover: { y: -4, boxShadow: '0 16px 40px rgba(15, 23, 42, 0.10)' },
    whileTap: { scale: 0.99 },
    transition: { duration: 0.28, ease: [0.34, 1.56, 0.64, 1] },
  },
  button: {
    whileHover: { scale: 1.03, y: -1 },
    whileTap: { scale: 0.97, y: 0 },
    transition: { duration: 0.2, ease: [0.34, 1.56, 0.64, 1] },
  },
  buttonDanger: {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.97 },
    transition: { duration: 0.15 },
  },
  star: {
    whileHover: { scale: 1.2, rotate: 5 },
    whileTap: { scale: 0.85 },
    transition: { duration: 0.18, ease: [0.34, 1.56, 0.64, 1] },
  },
};
