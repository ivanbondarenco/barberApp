"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Sheet } from "@/components/ui/Sheet";
import { ShopSignupForm } from "./ShopSignupForm";

export const SIGNUP_PATH = "/auth/nueva-barberia";

/**
 * "Registrar mi barbería": abre el alta en un modal sobre la pantalla actual. Abrirlo en otra
 * pestaña sigue llevando a la página /auth/nueva-barberia.
 */
export function SignupLink({ className, children }: { className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setOpen(true);
  };

  // Son siete campos: cerrar sin querer (tocar afuera, deslizar) no debería borrarlos sin preguntar.
  const requestClose = () => {
    // Con la confirmación abierta, el Escape es para ella (no para volver a preguntar).
    if (busy || confirmClose) return;
    if (dirty) setConfirmClose(true);
    else setOpen(false);
  };

  const discard = () => {
    setConfirmClose(false);
    setDirty(false);
    setOpen(false);
  };

  return (
    <>
      <a href={SIGNUP_PATH} onClick={onClick} className={className}>
        {children}
      </a>
      <Sheet
        open={open}
        onClose={requestClose}
        title="Registrar mi barbería"
        subtitle="Probala gratis, sin tarjeta"
        footer={
          <button type="submit" form="shop-form-modal" disabled={busy} className="tap btn-primary">
            {busy ? "Creando…" : "Crear barbería"}
          </button>
        }
      >
        <ShopSignupForm formId="shop-form-modal" onSubmittingChange={setBusy} onDirtyChange={setDirty} />
      </Sheet>
      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={discard}
        title="¿Descartar los datos?"
        description="Si cerrás ahora, se borra lo que escribiste de tu barbería."
        confirmLabel="Descartar"
        cancelLabel="Seguir completando"
        destructive
      />
    </>
  );
}
