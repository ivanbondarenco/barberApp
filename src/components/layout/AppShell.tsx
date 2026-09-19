import type { ReactNode } from "react";
import { BottomNav, type NavItem } from "./BottomNav";
import { SideNav } from "./SideNav";

/**
 * Mobile: columna de 100dvh con header y barra inferior fijos.
 * Escritorio (≥1024px): navegación lateral y contenido ancho centrado.
 */
export function AppShell({ header, items, children }: { header: ReactNode; items?: NavItem[]; children: ReactNode }) {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-[480px] overflow-hidden bg-surface shadow-md lg:max-w-none lg:shadow-none">
      {items && <SideNav items={items} />}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {header}
        <main className="no-scrollbar relative flex flex-1 flex-col overflow-y-auto overscroll-contain">
          <div className="mx-auto flex w-full flex-1 flex-col lg:max-w-[900px] lg:px-2">{children}</div>
        </main>
        {items && <BottomNav items={items} />}
      </div>
    </div>
  );
}
