"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { BillingStatusInfo } from "@/lib/billing";

/**
 * Estado de la suscripción para el aviso del panel. Va aparte de /api/state a propósito: no es
 * parte del dominio del local y cambia muy de vez en cuando, así que se pide al entrar, al volver
 * a la pestaña y cada tanto. Compartido entre los componentes que lo usan (una sola consulta).
 */
let current: BillingStatusInfo | null = null;
let loading: Promise<void> | null = null;
let lastFetch = 0;
const listeners = new Set<() => void>();
const STALE_MS = 5 * 60_000;

export async function refreshBillingStatus(): Promise<void> {
  loading ??= (async () => {
    try {
      const res = await fetch("/api/billing/status", { credentials: "same-origin", cache: "no-store" });
      current = res.ok ? ((await res.json()) as BillingStatusInfo) : null;
      lastFetch = Date.now();
      listeners.forEach((l) => l());
    } catch {
      // Sin conexión: se queda con lo último que supo.
    } finally {
      loading = null;
    }
  })();
  return loading;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useBillingStatus(enabled = true): BillingStatusInfo | null {
  const info = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  useEffect(() => {
    if (!enabled) return;
    const maybeRefresh = () => {
      if (Date.now() - lastFetch > STALE_MS) void refreshBillingStatus();
    };
    if (!lastFetch) void refreshBillingStatus();
    const onVisible = () => document.visibilityState === "visible" && maybeRefresh();
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(maybeRefresh, STALE_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [enabled]);
  return enabled ? info : null;
}
