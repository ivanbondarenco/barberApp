import "server-only";
import type { Actor, DomainState } from "@/lib/commands";
import { todayISO } from "@/lib/dates";
import type { Appointment } from "@/lib/types";

/**
 * Ocupa el horario sin revelar de quién es el turno.
 * Lo ven el cliente (disponibilidad) y el barbero (agenda de los otros sillones).
 */
function anonymous(a: Appointment): Appointment {
  return {
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
  };
}

/**
 * Datos que puede ver cada rol.
 * - `admin`: todo.
 * - `barbero`: su agenda completa; los turnos de otros sillones, anonimizados. Sin caja ni cierres.
 * - `cliente`: lo propio y la disponibilidad anónima.
 * - sin sesión: catálogo público.
 */
export function stateForActor(state: DomainState, actor: Actor | null): DomainState {
  if (actor?.role === "admin") return state;

  const today = todayISO();

  if (actor?.role === "barbero") {
    return {
      ...state,
      appointments: state.appointments.map((a) => (a.barberId === actor.barberId ? a : anonymous(a))),
      // La plata del local es del dueño: el barbero no ve cierres ni historial de caja.
      cashClosures: [],
    };
  }

  const publicPart: DomainState = {
    ...state,
    clients: [],
    services: state.services.filter((s) => s.active),
    // Ni el celular del barbero ni su usuario de acceso salen del staff.
    barbers: state.barbers
      .filter((b) => b.active)
      .map(({ phone: _phone, accountIdentifier: _ident, ...b }) => b),
    products: state.products.filter((p) => p.active),
    appointments: [],
    blocks: state.blocks.filter((b) => b.date >= today).map((b) => ({ ...b, reason: "" })),
    cashClosures: [],
    cashRegister: { open: false },
  };
  if (!actor || actor.role === "sistema") return publicPart;

  return {
    ...publicPart,
    clients: state.clients.filter((c) => c.id === actor.clientId).map(({ internalNotes: _notes, ...c }) => c),
    appointments: state.appointments
      .filter((a) => a.clientId === actor.clientId || (a.status === "confirmado" && a.date >= today))
      .map((a) => (a.clientId === actor.clientId ? a : anonymous(a))),
  };
}
