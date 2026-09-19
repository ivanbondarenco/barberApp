"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { NAV, Page } from "@/components/motion/Page";
import { useAppStore } from "@/store/useAppStore";

interface PublicShellProps {
  title: string;
  /** Destino si no hay historial para volver. */
  fallbackHref?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Columna mobile para páginas sin sesión: header con volver, contenido y pie opcional. */
export function PublicShell({ title, fallbackHref = "/auth/login", children, footer }: PublicShellProps) {
  const router = useRouter();

  useEffect(() => {
    void useAppStore.getState().refresh();
  }, []);

  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push(fallbackHref, { transitionTypes: [...NAV.back] });
  };

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-surface shadow-md">
      <header style={{ viewTransitionName: "app-header" }} className="pt-safe z-40 shrink-0 bg-surface/90 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-1 px-2">
          <button type="button" onClick={back} aria-label="Volver" className="icon-btn">
            <ArrowLeft size={22} />
          </button>
          <h1 className="truncate text-[17px] font-semibold tracking-tight">{title}</h1>
        </div>
      </header>
      <main tabIndex={0} aria-label={title} className="no-scrollbar flex flex-1 flex-col overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
        <Page>{children}</Page>
      </main>
      {footer && (
        <footer className="pb-safe shrink-0 border-t border-surface-high bg-surface-lowest/95 px-4 py-3 backdrop-blur-xl">
          {footer}
        </footer>
      )}
    </div>
  );
}
