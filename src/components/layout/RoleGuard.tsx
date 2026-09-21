"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";
import { SkeletonList } from "@/components/ui/States";
import type { Role } from "@/lib/types";
import { useAppStore, useHydrated, useLiveSync } from "@/store/useAppStore";

export function homeFor(role: Role): string {
  return role === "cliente" ? "/cliente/reservar" : "/admin/agenda";
}

/**
 * Protege las rutas por rol. Muestra el cache al instante y confirma la sesión con el servidor;
 * la autorización real la hace la API en cada operación.
 *
 * `role` acepta una lista: el panel del local lo comparten el dueño y los barberos, y cada
 * pantalla de adentro decide qué mostrarle a cada uno.
 */
export function RoleGuard({ role, children }: { role: Role | Role[]; children: ReactNode }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useAppStore((s) => s.session);
  const synced = useAppStore((s) => s.synced);
  useLiveSync();

  // Estable entre renders: si no, el efecto se dispararía en cada uno.
  const allowed = useMemo(() => (Array.isArray(role) ? role : [role]), [Array.isArray(role) ? role.join() : role]); // eslint-disable-line react-hooks/exhaustive-deps
  const ok = !!session && allowed.includes(session.role);

  useEffect(() => {
    if (!hydrated || !synced) return;
    if (!session) router.replace("/auth/login");
    else if (!allowed.includes(session.role)) router.replace(homeFor(session.role));
  }, [hydrated, synced, session, router, allowed]);

  if (!hydrated || !ok) {
    return (
      <div className="mx-auto h-dvh max-w-[480px] bg-surface lg:max-w-none">
        <SkeletonList />
      </div>
    );
  }
  return <>{children}</>;
}

/** Redirige al barbero que intenta entrar a una pantalla reservada al dueño. */
export function OwnerOnly({ children }: { children: ReactNode }) {
  const router = useRouter();
  const role = useAppStore((s) => s.session?.role);

  useEffect(() => {
    if (role === "barbero") router.replace("/admin/agenda");
  }, [role, router]);

  if (role === "barbero") return <ScreenLoader />;
  return <>{children}</>;
}

export function ScreenLoader() {
  return (
    <div className="mx-auto h-dvh max-w-[480px] bg-surface lg:max-w-none">
      <SkeletonList />
    </div>
  );
}
