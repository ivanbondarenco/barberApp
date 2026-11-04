"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homeFor } from "@/components/layout/RoleGuard";
import { isStandalone } from "@/lib/pwa";
import { useAppStore, useHydrated } from "@/store/useAppStore";

/**
 * La landing es para quien todavía no usa la app. Con sesión abierta se va directo a su
 * pantalla, y en la app instalada nunca se muestra: va al ingreso.
 */
export function SessionRedirect() {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useAppStore((s) => s.session);
  const synced = useAppStore((s) => s.synced);

  useEffect(() => {
    // Navegación del lado del cliente hacia "/" dentro de la app instalada: el script inline
    // no vuelve a correr, así que se resuelve acá.
    if (isStandalone()) {
      router.replace("/auth/login");
      return;
    }
    void useAppStore.getState().refresh(true);
  }, [router]);

  useEffect(() => {
    if (hydrated && synced && session) router.replace(homeFor(session));
  }, [hydrated, synced, session, router]);

  return null;
}
