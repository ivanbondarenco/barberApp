"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { applyCommand, DomainError, type Actor, type Command, type DomainState } from "@/lib/commands";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/schedule";
import { seedBusinessInfo } from "@/lib/mock-data";
import type { ClientProfile, Role, Session } from "@/lib/types";

export type Result = { ok: true } | { ok: false; error: string };

interface ServerPayload {
  version: number;
  session: Session | null;
  state?: DomainState;
  unchanged?: boolean;
  error?: string;
}

interface SyncState {
  session: Session | null;
  version: number;
  /** Ya se recibió al menos una respuesta del servidor en esta carga. */
  synced: boolean;
  offline: boolean;
}

interface Actions {
  refresh: (force?: boolean) => Promise<void>;
  run: (command: Command) => Promise<Result>;
  login: (role: Role, identifier: string, pin: string) => Promise<Result>;
  otp: (phone: string, code?: string) => Promise<Result>;
  register: (input: { name: string; phone: string; email?: string; pin: string; code: string }) => Promise<Result>;
  recover: (input: { identifier: string; code?: string; pin?: string }) => Promise<Result>;
  changePin: (currentPin: string, newPin: string) => Promise<Result>;
  logout: () => Promise<void>;
}

export type AppState = DomainState & SyncState & Actions;

const emptyDomain: DomainState = {
  clients: [],
  barbers: [],
  services: [],
  products: [],
  appointments: [],
  blocks: [],
  depositSettings: { allowCash: true },
  cashRegister: { open: false },
  cashClosures: [],
  businessHours: DEFAULT_BUSINESS_HOURS,
  businessInfo: seedBusinessInfo,
};

const DOMAIN_KEYS = Object.keys(emptyDomain) as (keyof DomainState)[];

export function domainOf(state: DomainState): DomainState {
  return Object.fromEntries(DOMAIN_KEYS.map((k) => [k, state[k]])) as unknown as DomainState;
}

export function actorOf(session: Session | null): Actor | null {
  if (!session) return null;
  return session.role === "admin" ? { role: "admin" } : { role: "cliente", clientId: session.clientId ?? "" };
}

async function request(url: string, body?: unknown): Promise<ServerPayload & { status: number }> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as ServerPayload;
  return { ...data, status: res.status };
}

/** Último estado confirmado por el servidor, para revertir actualizaciones optimistas. */
let confirmed: DomainState | null = null;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      const accept = (data: ServerPayload) => {
        const current = get();
        const sessionChanged = JSON.stringify(data.session) !== JSON.stringify(current.session);
        if (data.state && (data.version >= current.version || sessionChanged)) {
          confirmed = data.state;
          set({ ...data.state, version: data.version, session: data.session, synced: true, offline: false });
        } else {
          set({ session: data.session, synced: true, offline: false });
        }
      };

      const authCall = async (url: string, body: unknown): Promise<Result> => {
        try {
          const res = await request(url, body);
          if (res.error) return { ok: false, error: res.error };
          return { ok: true };
        } catch {
          return { ok: false, error: "Sin conexión. Revisá tu internet." };
        }
      };

      return {
        ...emptyDomain,
        session: null,
        version: 0,
        synced: false,
        offline: false,

        refresh: async (force = false) => {
          try {
            const { version, synced } = get();
            const data = await request(`/api/state${!force && synced && version ? `?v=${version}` : ""}`);
            if (data.status >= 500) throw new Error(data.error);
            if (data.unchanged && JSON.stringify(data.session) !== JSON.stringify(get().session)) {
              return get().refresh(true);
            }
            accept(data);
          } catch {
            set({ offline: true, synced: true });
          }
        },

        run: async (command) => {
          const state = get();
          const actor = actorOf(state.session);
          if (!actor) return { ok: false, error: "Iniciá sesión para continuar" };

          try {
            set(applyCommand(domainOf(state), command, actor));
          } catch (error) {
            return { ok: false, error: error instanceof DomainError ? error.message : "Operación inválida" };
          }

          try {
            const data = await request("/api/commands", { command });
            if (data.error || !data.state) {
              if (confirmed) set(confirmed);
              if (data.status === 401) set({ session: null });
              void get().refresh(true);
              return { ok: false, error: data.error ?? "No se pudo guardar" };
            }
            accept(data);
            return { ok: true };
          } catch {
            if (confirmed) set(confirmed);
            set({ offline: true });
            return { ok: false, error: "Sin conexión: el cambio no se guardó" };
          }
        },

        login: async (role, identifier, pin) => {
          const result = await authCall("/api/auth/login", { role, identifier, pin });
          if (result.ok) await get().refresh(true);
          return result;
        },

        otp: async (phone, code) => {
          const result = await authCall("/api/auth/otp", { phone, code });
          if (result.ok && code) await get().refresh(true);
          return result;
        },

        register: async (input) => {
          const result = await authCall("/api/auth/register", input);
          if (result.ok) await get().refresh(true);
          return result;
        },

        recover: (input) => authCall("/api/auth/recover", input),

        changePin: (currentPin, newPin) => authCall("/api/auth/pin", { currentPin, newPin }),

        logout: async () => {
          await authCall("/api/auth/logout", {});
          confirmed = null;
          set({ ...emptyDomain, session: null, version: 0 });
          await get().refresh(true);
        },
      };
    },
    {
      name: "ds-studio-cache",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      // Cache para abrir al instante y mostrar datos sin conexión; el servidor es la fuente de verdad.
      partialize: (s) => ({ ...domainOf(s), session: s.session, version: s.version }),
      migrate: () => ({ ...emptyDomain, session: null, version: 0 }) as unknown as AppState,
    },
  ),
);

/** Perfil del cliente logueado. */
export function useCurrentClient(): ClientProfile | undefined {
  const clientId = useAppStore((s) => s.session?.clientId);
  return useAppStore((s) => s.clients.find((c) => c.id === clientId));
}

/** true cuando el cache local ya se rehidrató en el cliente. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (useAppStore.persist.hasHydrated()) setHydrated(true);
    return useAppStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}

/** Sincroniza con el servidor al abrir, al volver a la pestaña y cada 10 segundos. */
export function useLiveSync(intervalMs = 10_000): void {
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void useAppStore.getState().refresh();
    };
    void useAppStore.getState().refresh(true);
    const timer = window.setInterval(refresh, intervalMs);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [intervalMs]);
}
