import { vi } from "vitest";
import type { Actor, DomainState } from "@/lib/commands";
import {
  barbers,
  buildSeedAppointments,
  buildSeedBlocks,
  buildSeedClients,
  buildSeedClosures,
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

export const admin: Actor = { role: "admin" };
export const demoClient: Actor = { role: "cliente", clientId: "c-demo" };
export const otherClient: Actor = { role: "cliente", clientId: "c-mateo" };

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
    cashClosures: buildSeedClosures(),
    depositSettings: { allowCash: true },
    cashRegister: { open: true, openedAt: "08:30" },
    businessHours: DEFAULT_BUSINESS_HOURS,
    businessInfo: seedBusinessInfo,
  });
}

export function bookPayload(overrides: Partial<Parameters<typeof bookBase>[0]> = {}) {
  return bookBase(overrides);
}

function bookBase(overrides: {
  id?: string;
  newClientId?: string;
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
