"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Mantiene el foco del teclado dentro de un diálogo modal mientras está abierto:
 * Tab y Shift+Tab dan la vuelta dentro del contenedor en lugar de escaparse a la página de atrás.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !ref.current) return;
      // Con un diálogo abierto encima de una hoja, solo atrapa el de más arriba: los portales se
      // agregan al final del body, así que el último modal del documento es el que está al frente.
      const modals = document.querySelectorAll('[aria-modal="true"]');
      if (modals.length > 1 && modals[modals.length - 1] !== ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        ref.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      const inside = ref.current.contains(current);
      if (e.shiftKey && (current === first || current === ref.current || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ref, active]);
}
