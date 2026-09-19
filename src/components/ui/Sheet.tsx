"use client";

import { X } from "lucide-react";
import { AnimatePresence, useDragControls, type PanInfo } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useIsDesktop } from "@/lib/useMediaQuery";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Mobile: bottom sheet táctil que entra con spring y se cierra arrastrando hacia abajo.
 * Escritorio (≥1024px): diálogo centrado. En ambos cierra con Escape, tocando el fondo
 * o con el botón "atrás" del teléfono.
 */
export function Sheet({ open, onClose, title, subtitle, children, footer, className }: SheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <SheetPanel onClose={onClose} title={title} subtitle={subtitle} footer={footer} className={className}>
          {children}
        </SheetPanel>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function SheetPanel({ onClose, title, subtitle, children, footer, className }: Omit<SheetProps, "open">) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dragControls = useDragControls();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });

    // El botón atrás del teléfono cierra la hoja en lugar de salir de la pantalla.
    // Se conserva el estado del router de Next para que la entrada extra sea transparente.
    window.history.pushState({ ...window.history.state, dsSheet: true }, "");
    let closedByHistory = false;
    const onPop = () => {
      closedByHistory = true;
      onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("popstate", onPop);
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (!closedByHistory && window.history.state?.dsSheet) window.history.back();
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 600) onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-center lg:items-center lg:p-6">
      <m.div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.2, ease: ease.standard } }}
        exit={{ opacity: 0, transition: { duration: 0.18, ease: ease.exit } }}
        onClick={onClose}
        aria-hidden
      />
      <m.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={isDesktop ? { opacity: 0, scale: 0.94, y: 12 } : { y: "100%" }}
        animate={isDesktop ? { opacity: 1, scale: 1, y: 0, transition: spring.pop } : { y: 0, transition: spring.sheet }}
        exit={isDesktop ? { opacity: 0, scale: 0.97, transition: { duration: 0.15, ease: ease.exit } } : { y: "100%", transition: { duration: 0.2, ease: ease.exit } }}
        drag={isDesktop ? false : "y"}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.6 }}
        onDragEnd={onDragEnd}
        className={cn(
          "pb-safe absolute bottom-0 flex max-h-[90dvh] w-full max-w-[480px] flex-col rounded-t-3xl bg-surface-lowest shadow-md outline-none lg:static lg:max-h-[85dvh] lg:max-w-[560px] lg:rounded-3xl",
          className,
        )}
      >
        <div
          className="flex cursor-grab touch-none justify-center pb-1 pt-2.5 active:cursor-grabbing lg:hidden"
          onPointerDown={(e) => dragControls.start(e)}
          aria-hidden
        >
          <span className="h-1.5 w-10 rounded-full bg-surface-highest" />
        </div>
        <header
          className="flex touch-none items-start justify-between gap-3 px-5 pb-3 lg:pt-5"
          onPointerDown={(e) => {
            if (!isDesktop) dragControls.start(e);
          }}
        >
          <div className="min-w-0 pt-1">
            <h2 id={titleId} className="text-lg font-bold leading-tight tracking-tight text-ink">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-secondary">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Cerrar"
            className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-low text-secondary"
          >
            <X size={18} />
          </button>
        </header>
        <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <footer className="border-t border-surface-high px-5 py-3">{footer}</footer>}
      </m.div>
    </div>
  );
}
