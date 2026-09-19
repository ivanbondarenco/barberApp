import type { Transition, Variants } from "motion/react";

/** Curvas Material 3 como arrays para motion. */
export const ease = {
  standard: [0.2, 0, 0, 1] as const,
  enter: [0.05, 0.7, 0.1, 1] as const,
  exit: [0.3, 0, 0.8, 0.15] as const,
};

export const spring = {
  sheet: { type: "spring", damping: 34, stiffness: 380, mass: 0.9 } satisfies Transition,
  pop: { type: "spring", damping: 22, stiffness: 420 } satisfies Transition,
  layout: { type: "spring", damping: 32, stiffness: 420 } satisfies Transition,
};

/** Entrada de filas de lista: fade + 8px, salida más corta. */
export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: ease.enter, delay: Math.min(i, 6) * 0.035 },
  }),
  exit: { opacity: 0, x: -16, transition: { duration: 0.15, ease: ease.exit } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: ease.enter } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: ease.exit } },
};

/** Pasos de un asistente: desliza según la dirección. */
export const stepSlide: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 40 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.28, ease: ease.enter } },
  exit: (direction: number) => ({ opacity: 0, x: direction * -40, transition: { duration: 0.15, ease: ease.exit } }),
};
