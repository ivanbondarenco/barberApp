"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { homeFor } from "@/components/layout/RoleGuard";
import { useAppStore, useHydrated } from "@/store/useAppStore";

/**
 * Adónde vuelve alguien desde una pantalla de error: a su app si tiene sesión, a la carta del
 * local si llegó por el link de una barbería, y recién si no hay nada de eso a la portada
 * (que es para dueños de barberías, no para clientes).
 */
export function useRecoveryHref(): string {
  const hydrated = useHydrated();
  const session = useAppStore((s) => s.session);
  const shop = useAppStore((s) => s.shop);
  if (!hydrated) return "/";
  if (session) return homeFor(session);
  return shop ? "/local" : "/";
}

export function HomeLink({ className, children }: { className?: string; children: ReactNode }) {
  const href = useRecoveryHref();
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/** Recarga la página en la que estaba (no la portada): es lo que quería ver cuando se cortó. */
export function ReloadButton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button type="button" onClick={() => window.location.reload()} className={className}>
      <RefreshCw size={16} aria-hidden /> {children}
    </button>
  );
}
