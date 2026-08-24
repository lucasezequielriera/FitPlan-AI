import { useReducedMotion } from "framer-motion";

/**
 * Variantes de motion compartidas del admin — DESIGN_SYSTEM.md §7.3-D.
 * Mismos valores que ya usa la landing (fadeUp 0.35s, stagger whileInView
 * delay i*0.04-0.06), envueltos en useReducedMotion(): si el usuario tiene
 * prefers-reduced-motion, no animamos.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export function useAdminFadeUp() {
  const reduce = useReducedMotion();
  if (reduce) {
    return { initial: false as const, animate: undefined, transition: undefined };
  }
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: EASE },
  };
}

export function useAdminStagger() {
  const reduce = useReducedMotion();
  return (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-40px" },
          transition: { duration: 0.3, delay },
        };
}
