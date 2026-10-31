import { vi } from "vitest";
import type { Actor, DomainState } from "@/lib/commands";
import {
  barbers,
  buildSeedAppointments,
  buildSeedBlocks,
  buildSeedClients,
  seedBusinessInfo,
  seedProducts,
  seedServices,
} from "@/lib/mock-data";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/schedule";

/** Lunes 14/09/2026 a las 09:00 (hora local). */
export const MONDAY_9AM = new Date(2026, 8, 14, 9, 0, 0);
export const TODAY = "2026-09-14";
export const TUESDAY = "2026-09-15";
export const WEDNESDAY = "2026-09-16";
export const THURSDAY = "2026-09-17";

/** Barbería de la demo: todos los actores de los tests operan dentro de ella. */
export const SHOP = "s-default";

export const admin: Actor = { role: "admin", shopId: SHOP };
export const barberNico: Actor = { role: "barbero", shopId: SHOP, barberId: "b-nico" };
export const barberOther: Actor = { role: "barbero", shopId: SHOP, barberId: "b-diego" };
export const system: Actor = { role: "sistema", shopId: SHOP };
export const demoClient: Actor = { role: "cliente", shopId: SHOP, clientId: "c-demo" };
export const otherClient: Actor = { role: "cliente", shopId: SHOP, clientId: "c-mateo" };

export function freezeTime(date = MONDAY_9AM) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(date);
}

/** Estado de dominio equivalente a la base sembrada, con fecha fija. */
export function seedState(): DomainState {
  return structuredClone({
    clients: buildSeedClients(),
    barbers,
    services: seedServices,
    products: seedProducts,
    appointments: buildSeedAppointments(),
    blocks: buildSeedBlocks(),
    advances: [],
    payouts: [],
    depositSettings: { allowCash: true, rate: 0.5 },
    businessHours: DEFAULT_BUSINESS_HOURS,
    businessInfo: seedBusinessInfo,
    integrations: { mercadopagoReady: true, whatsappReady: true },
  });
}

export function bookPayload(overrides: Partial<Parameters<typeof bookBase>[0]> = {}) {
  return bookBase(overrides);
}

function bookBase(overrides: {
  id?: string;
  newClientId?: string;
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  barberId?: string;
  serviceId?: string;
  date?: string;
  time?: string;
  notes?: string;
  depositMethod?: "mercadopago" | "transferencia" | "efectivo" | "credito";
  depositPaid?: boolean;
}) {
  return {
    id: "a-test",
    newClientId: "c-new",
    clientName: "Tomás Ferreyra",
    clientPhone: "+54 9 11 5555-0192",
    barberId: "b-nico",
    serviceId: "s-tijera",
    date: WEDNESDAY,
    time: "10:00",
    depositMethod: "mercadopago" as const,
    depositPaid: true,
    ...overrides,
  };
}
