"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { LegalBody } from "./LegalDoc";
import { PRIVACY } from "./privacy";
import { TERMS } from "./terms";

const DOCS = { terminos: TERMS, privacidad: PRIVACY };

/**
 * Link a los términos o a la privacidad que los abre en un modal, sin salir de donde se está
 * (la landing, el alta a medio llenar). Abrirlo en otra pestaña sigue llevando a la página.
 */
export function LegalLink({ doc, className, children }: { doc: keyof typeof DOCS; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const content = DOCS[doc];

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setOpen(true);
  };

  return (
    <>
      <a href={`/${doc}`} onClick={onClick} className={className}>
        {children}
      </a>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={content.title}
        footer={
          <button type="button" onClick={() => setOpen(false)} className="tap btn-primary">
            Entendido
          </button>
        }
      >
        <LegalBody {...content} />
      </Sheet>
    </>
  );
}
