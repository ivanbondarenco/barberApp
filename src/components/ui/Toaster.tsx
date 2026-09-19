"use client";

import { CircleCheck, CircleX, Info } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { useToast } from "@/store/useToast";

const icons = { success: CircleCheck, error: CircleX, info: Info };

/** Avisos bajo el encabezado (no tapan botones flotantes ni barras de acción), con "Deshacer" opcional. */
export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+60px)] z-[80] mx-auto flex max-w-[480px] flex-col gap-2 px-4"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = icons[t.tone];
          return (
            <m.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.24, ease: ease.enter } }}
              exit={{ opacity: 0, y: -10, transition: { duration: 0.15, ease: ease.exit } }}
              className={cn(
                "pointer-events-auto flex items-center gap-2.5 rounded-2xl py-2.5 pl-3.5 pr-2 text-sm font-medium shadow-md",
                t.tone === "error" ? "bg-error-container text-error" : "bg-ink text-on-primary",
              )}
            >
              <Icon size={18} className={cn("shrink-0", t.tone === "success" && "text-primary-fixed")} aria-hidden />
              <button type="button" onClick={() => dismiss(t.id)} className="min-h-10 min-w-0 flex-1 text-left">
                {t.message}
              </button>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="min-h-10 shrink-0 rounded-lg px-3 text-sm font-bold text-primary-fixed hover:bg-on-primary/10"
                >
                  {t.action.label}
                </button>
              )}
            </m.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
