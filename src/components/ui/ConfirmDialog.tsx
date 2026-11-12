"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useFocusTrap } from "@/lib/useFocusTrap";

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
  /** Texto del botón mientras se ejecuta la acción ("Cancelando…"). */
  busyLabel?: string;
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
  busyLabel = "Un momento…",
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setMounted(true), []);
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    // El foco arranca en la opción segura: un Enter apurado no confirma una baja.
    const raf = requestAnimationFrame(() => cancelRef.current?.focus({ preventScroll: true }));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
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
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: spring.pop }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15, ease: ease.exit } }}
            className="relative w-full max-w-sm rounded-3xl bg-surface-lowest p-5 shadow-md"
          >
            <h2 id={titleId} className="text-lg font-bold tracking-tight">
              {title}
            </h2>
            <div id={descId} className="mt-1.5 text-sm leading-relaxed text-secondary">{description}</div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button ref={cancelRef} type="button" disabled={busy} onClick={onClose} className="tap btn-secondary">
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
                {busy ? busyLabel : confirmLabel}
              </button>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
