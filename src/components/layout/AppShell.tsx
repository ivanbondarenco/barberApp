import type { ReactNode } from "react";

/** Columna mobile de 100dvh: header y bottom nav fijos, contenido al medio. */
export function AppShell({ header, nav, children }: { header: ReactNode; nav?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-surface shadow-md">
      {header}
      <main className="no-scrollbar relative flex flex-1 flex-col overflow-y-auto overscroll-contain">{children}</main>
      {nav}
    </div>
  );
}
