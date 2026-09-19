"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: ReactNode;
  /** Verbo concreto: "Eliminar servicio", "Cancelar turno". */
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}

/** Diálogo centrado para acciones poco frecuentes o irreversibles. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = "Volver",
  destructive,
}: ConfirmDialogProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-6">
          <m.div
            className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15, ease: ease.exit } }}
            onClick={() => !busy && onClose()}
            aria-hidden
          />
          <m.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: spring.pop }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15, ease: ease.exit } }}
            className="relative w-full max-w-sm rounded-3xl bg-surface-lowest p-5 shadow-md"
          >
            <h2 id={titleId} className="text-lg font-bold tracking-tight">
              {title}
            </h2>
            <div className="mt-1.5 text-sm leading-relaxed text-secondary">{description}</div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={busy} onClick={onClose} className="tap btn-secondary">
                {cancelLabel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onConfirm();
                  } finally {
                    setBusy(false);
                    onClose();
                  }
                }}
                className={cn("tap", destructive ? "btn-destructive-solid" : "btn-primary")}
              >
                {busy ? "…" : confirmLabel}
              </button>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
