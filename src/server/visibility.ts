import "server-only";
import type { Actor, DomainState } from "@/lib/commands";
import { todayISO } from "@/lib/dates";
import type { Appointment } from "@/lib/types";

/** Datos que puede ver cada rol. El staff ve todo; el cliente, lo propio y la disponibilidad anónima. */
export function stateForActor(state: DomainState, actor: Actor | null): DomainState {
  if (actor?.role === "admin") return state;

  const today = todayISO();
  const publicPart: DomainState = {
    ...state,
    clients: [],
    services: state.services.filter((s) => s.active),
    barbers: state.barbers.filter((b) => b.active),
    products: state.products.filter((p) => p.active),
    appointments: [],
    blocks: state.blocks.filter((b) => b.date >= today).map((b) => ({ ...b, reason: "" })),
    cashClosures: [],
    cashRegister: { open: false },
  };
  if (!actor) return publicPart;

  const busy = (a: Appointment): Appointment => ({
    id: a.id,
    clientName: "",
    clientPhone: "",
    verified: false,
    barberId: a.barberId,
    serviceId: "",
    serviceName: "",
    servicePrice: 0,
    durationMin: a.durationMin,
    date: a.date,
    time: a.time,
    deposit: { amount: 0, status: "pendiente", method: "efectivo" },
    products: [],
    status: a.status,
    source: "app",
    createdAt: a.createdAt,
  });

  return {
    ...publicPart,
    clients: state.clients.filter((c) => c.id === actor.clientId),
    appointments: state.appointments
      .filter((a) => a.clientId === actor.clientId || (a.status === "confirmado" && a.date >= today))
      .map((a) => (a.clientId === actor.clientId ? a : busy(a))),
  };
}
