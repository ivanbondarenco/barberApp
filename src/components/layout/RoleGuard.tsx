"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { SkeletonList } from "@/components/ui/States";
import type { Role } from "@/lib/types";
import { useAppStore, useHydrated, useLiveSync } from "@/store/useAppStore";

export function homeFor(role: Role): string {
  return role === "admin" ? "/admin/agenda" : "/cliente/reservar";
}

/**
 * Protege las rutas por rol. Muestra el cache al instante y confirma la sesión con el servidor;
 * la autorización real la hace la API en cada operación.
 */
export function RoleGuard({ role, children }: { role: Role; children: ReactNode }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useAppStore((s) => s.session);
  const synced = useAppStore((s) => s.synced);
  useLiveSync();

  useEffect(() => {
    if (!hydrated || !synced) return;
    if (!session) router.replace("/auth/login");
    else if (session.role !== role) router.replace(homeFor(session.role));
  }, [hydrated, synced, session, role, router]);

  if (!hydrated || session?.role !== role) {
    return (
      <div className="mx-auto h-dvh max-w-[480px] bg-surface lg:max-w-none">
        <SkeletonList />
      </div>
    );
  }
  return <>{children}</>;
}

export function ScreenLoader() {
  return (
    <div className="mx-auto h-dvh max-w-[480px] bg-surface lg:max-w-none">
      <SkeletonList />
    </div>
  );
}
