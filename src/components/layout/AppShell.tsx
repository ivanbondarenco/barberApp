import type { ReactNode } from "react";
import { BottomNav, type NavItem } from "./BottomNav";
import { SideNav } from "./SideNav";

/**
 * Mobile: columna de 100dvh con header y barra inferior fijos.
 * Escritorio (≥1024px): navegación lateral y contenido ancho centrado.
 * Al imprimir (un recibo) queda solo el contenido, sin navegación ni header.
 */
export function AppShell({ header, items, children }: { header: ReactNode; items?: NavItem[]; children: ReactNode }) {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-[480px] overflow-hidden bg-surface shadow-md lg:max-w-none lg:shadow-none print:h-auto print:max-w-none print:overflow-visible print:bg-white print:shadow-none">
      {items && (
        <div className="contents print:hidden">
          <SideNav items={items} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
        <div className="contents print:hidden">{header}</div>
        <main className="no-scrollbar relative flex flex-1 flex-col overflow-y-auto overscroll-contain print:overflow-visible">
          <div className="mx-auto flex w-full flex-1 flex-col lg:max-w-[900px] lg:px-2">{children}</div>
        </main>
        {items && (
          <div className="contents print:hidden">
            <BottomNav items={items} />
          </div>
        )}
      </div>
    </div>
  );
}
