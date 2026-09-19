"use client";

import { Plus } from "lucide-react";
import * as m from "motion/react-m";
import { spring } from "@/lib/motion";

/** Botón flotante para crear, ubicado sobre la barra de navegación. */
export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <m.button
      type="button"
      onClick={onClick}
      aria-label={label}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, transition: { ...spring.pop, delay: 0.1 } }}
      whileTap={{ scale: 0.92 }}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+80px)] right-[max(1rem,calc(50vw-240px+1rem))] z-30 flex h-14 items-center gap-2 rounded-2xl bg-primary pl-4 pr-5 text-sm font-semibold text-on-primary shadow-cta"
    >
      <Plus size={22} strokeWidth={2.4} aria-hidden />
      {label}
    </m.button>
  );
}
