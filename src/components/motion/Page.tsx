"use client";

import { ViewTransition, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Tipos de navegación: avanzar (detalle), volver, o cambiar de pestaña. */
export const NAV = {
  forward: ["nav-forward"],
  back: ["nav-back"],
  tab: ["nav-tab"],
} as const satisfies Record<string, string[]>;

const types = { "nav-forward": "nav-forward", "nav-back": "nav-back", "nav-tab": "nav-tab", default: "none" };

/** Envuelve el contenido de cada página para animar la navegación con View Transitions. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ViewTransition enter={types} exit={types} default="none">
      <div className={cn("flex flex-1 flex-col", className)}>{children}</div>
    </ViewTransition>
  );
}
