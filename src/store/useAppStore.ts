"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { applyCommand, DomainError, type Actor, type Command, type DomainState } from "@/lib/commands";
import { DEFAULT_DEPOSIT_RATE } from "@/lib/pricing";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/schedule";
import { seedBusinessInfo } from "@/lib/mock-data";
import type { ClientProfile, Session, Shop } from "@/lib/types";

export type Result = { ok: true } | { ok: false; error: string };

/** Solapa del ingreso: cliente, o staff de una barbería (dueño o barbero). */
export type LoginRole = "cliente" | "staff";

interface ServerPayload {
  version: number;
  session: Session | null;
  /** Barbería sobre la que se está operando (la de la sesión o la elegida por el visitante). */
  shop?: Shop | null;
  /** Solo cuando todavía no hay una barbería elegida: las opciones disponibles. */
  shops?: Shop[];
  state?: DomainState;
  unchanged?: boolean;
  error?: string;
}

interface SyncState {
  session: Session | null;
  /** Barbería activa. `null` mientras el visitante no eligió una. */
  shop: Shop | null;
  /** Barberías entre las que elegir cuando no hay ninguna activa. */
  shops: Shop[];
  version: number;
  /** Ya se recibió al menos una respuesta del servidor en esta carga. */
  synced: boolean;
  offline: boolean;
}

interface Actions {
  refresh: (force?: boolean) => Promise<void>;
  run: (command: Command) => Promise<Result>;
  login: (role: LoginRole, identifier: string, password: string) => Promise<Result>;
  register: (input: { name: string; email: string; phone: string; password: string }) => Promise<Result>;
  recover: (input: { role: LoginRole; identifier: string; code?: string; password?: string }) => Promise<Result>;
  changePassword: (current: string, next: string) => Promise<Result>;
  /** Vuelve a mandar el mail con el link para confirmar la casilla de la cuenta. */
  resendVerification: () => Promise<Result>;
  /** Barberías del cliente: sumarse, dejarla o pasar a operar en ella. */
  membership: (shopId: string, action: "join" | "leave" | "select") => Promise<Result>;
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
  depositSettings: { allowCash: true, rate: DEFAULT_DEPOSIT_RATE },
  businessHours: DEFAULT_BUSINESS_HOURS,
  businessInfo: seedBusinessInfo,
  // Lo confirma el servidor en el primer /api/state; por defecto, sin integraciones.
  integrations: { mercadopagoReady: false, whatsappReady: false },
};

const DOMAIN_KEYS = Object.keys(emptyDomain) as (keyof DomainState)[];

export function domainOf(state: DomainState): DomainState {
  return Object.fromEntries(DOMAIN_KEYS.map((k) => [k, state[k]])) as unknown as DomainState;
}

export function actorOf(session: Session | null): Actor | null {
  if (!session?.shop) return null;
  const shopId = session.shop.id;
  if (session.role === "admin") return { role: "admin", shopId };
  if (session.role === "barbero") return { role: "barbero", shopId, barberId: session.barberId ?? "" };
  return { role: "cliente", shopId, clientId: session.clientId ?? "" };
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
        const shopChanged = (data.shop?.id ?? null) !== (current.shop?.id ?? null);
        const meta = {
          session: data.session,
          shop: data.shop ?? null,
          shops: data.shops ?? [],
          synced: true,
          offline: false,
        };
        // Al cambiar de barbería el cache viejo no sirve: son datos de otro local.
        if (data.state && (data.version >= current.version || sessionChanged || shopChanged)) {
          confirmed = data.state;
          set({ ...data.state, version: data.version, ...meta });
        } else if (shopChanged && !data.state) {
          confirmed = null;
          set({ ...emptyDomain, version: 0, ...meta });
        } else {
          set(meta);
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
        shop: null,
        shops: [],
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

        login: async (role, identifier, password) => {
          const result = await authCall("/api/auth/login", { role, identifier, password });
          if (result.ok) await get().refresh(true);
          return result;
        },

        register: async (input) => {
          const result = await authCall("/api/auth/register", input);
          if (result.ok) await get().refresh(true);
          return result;
        },

        recover: (input) => authCall("/api/auth/recover", input),

        changePassword: (current, next) => authCall("/api/auth/password", { current, next }),

        resendVerification: () => authCall("/api/auth/verificar", {}),

        membership: async (shopId, action) => {
          const result = await authCall("/api/memberships", { shopId, action });
          if (result.ok) await get().refresh(true);
          return result;
        },

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
      version: 6,
      storage: createJSONStorage(() => localStorage),
      // Cache para abrir al instante y mostrar datos sin conexión; el servidor es la fuente de verdad.
      partialize: (s) => ({ ...domainOf(s), session: s.session, shop: s.shop, version: s.version }),
      migrate: () => ({ ...emptyDomain, session: null, shop: null, shops: [], version: 0 }) as unknown as AppState,
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
