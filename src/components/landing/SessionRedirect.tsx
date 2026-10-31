"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homeFor } from "@/components/layout/RoleGuard";
import { useAppStore, useHydrated } from "@/store/useAppStore";

/**
 * La landing es para quien todavía no usa la app. Con sesión abierta (la app instalada abre en
 * "/") se va directo a su pantalla, como hacía antes el ingreso.
 */
export function SessionRedirect() {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useAppStore((s) => s.session);
  const synced = useAppStore((s) => s.synced);

  useEffect(() => {
    void useAppStore.getState().refresh(true);
  }, []);

  useEffect(() => {
    if (hydrated && synced && session) router.replace(homeFor(session));
  }, [hydrated, synced, session, router]);

  return null;
}
