"use client";

import * as m from "motion/react-m";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

type Tone = "success" | "pending" | "error";

const tones: Record<Tone, { ring: string; stroke: string }> = {
  success: { ring: "bg-mint", stroke: "#0f7a55" },
  pending: { ring: "bg-primary-fixed", stroke: "#1d4ed8" },
  error: { ring: "bg-error-container", stroke: "#ba1a1a" },
};

/** Ícono de resultado con trazo animado (check, reloj de arena o cruz). */
export function SuccessCheck({ tone = "success", className }: { tone?: Tone; className?: string }) {
  const t = tones[tone];
  const path =
    tone === "success" ? "M14 25l7 7 14-15" : tone === "error" ? "M16 16l16 16M32 16L16 32" : "M24 14v11l7 5";

  return (
    <m.span
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", damping: 16, stiffness: 260 }}
      className={cn("flex h-20 w-20 items-center justify-center rounded-full", t.ring, className)}
      aria-hidden
    >
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        {tone === "pending" && (
          <m.circle
            cx="24"
            cy="24"
            r="14"
            stroke={t.stroke}
            strokeWidth="3"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, ease: ease.enter, delay: 0.1 }}
          />
        )}
        <m.path
          d={path}
          stroke={t.stroke}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.42, ease: ease.enter, delay: 0.18 }}
        />
      </svg>
    </m.span>
  );
}
