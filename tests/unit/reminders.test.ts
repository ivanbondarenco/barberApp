import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { needsReminder, pendingReminders, reminderMessage } from "@/lib/reminders";
import type { Appointment, ClientProfile } from "@/lib/types";
import { freezeTime, MONDAY_9AM, seedState } from "./support/fixtures";

let clients: ClientProfile[];

beforeEach(() => {
  freezeTime();
  clients = seedState().clients;
});
afterEach(() => vi.useRealTimers());

/** Turno de base: mañana (martes) a las 10, dentro de la ventana de 24 h. */
function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "a-r",
    clientId: "c-demo",
    clientName: "Tomás Ferreyra",
    clientPhone: "+54 9 11 5555-0192",
    verified: true,
    barberId: "b-nico",
    serviceId: "s-tijera",
    serviceName: "Corte a tijera",
    servicePrice: 9500,
    durationMin: 30,
    date: "2026-09-15",
    time: "08:00",
    deposit: { amount: 4750, status: "abonada", method: "mercadopago", paidAt: "x" },
    products: [],
    status: "confirmado",
    source: "app",
    createdAt: "x",
    ...overrides,
  };
}

describe("cola de recordatorios", () => {
  it("avisa los turnos de las próximas 24 h", () => {
    expect(needsReminder(appointment(), clients)).toBe(true);
  });

  it("no avisa fuera de la ventana ni turnos ya pasados", () => {
    // Miércoles: faltan más de 24 h.
    expect(needsReminder(appointment({ date: "2026-09-16" }), clients)).toBe(false);
    // Lunes 08:00: ya pasó.
    expect(needsReminder(appointment({ date: "2026-09-14", time: "08:00" }), clients)).toBe(false);
  });

  it("no repite un aviso ya enviado", () => {
    expect(needsReminder(appointment({ reminderSentAt: MONDAY_9AM.toISOString() }), clients)).toBe(false);
  });

  it("ignora turnos que no están confirmados", () => {
    for (const status of ["cancelado", "completado", "no_show"] as const) {
      expect(needsReminder(appointment({ status }), clients)).toBe(false);
    }
  });

  it("no avisa una reserva que todavía puede liberarse por falta de pago", () => {
    const held = appointment({
      deposit: { amount: 4750, status: "pendiente", method: "mercadopago" },
      holdUntil: new Date(MONDAY_9AM.getTime() + 10 * 60_000).toISOString(),
    });
    expect(needsReminder(held, clients)).toBe(false);
  });

  it("respeta la preferencia del cliente y avisa igual a los que no tienen ficha", () => {
    const optedOut = clients.map((c) =>
      c.id === "c-demo" ? { ...c, notifications: { ...c.notifications, reminder24h: false } } : c,
    );
    expect(needsReminder(appointment(), optedOut)).toBe(false);
    // Turno manual de alguien sin ficha: se avisa.
    expect(needsReminder(appointment({ clientId: undefined }), clients)).toBe(true);
  });

  it("ordena por urgencia y marca las señas pendientes", () => {
    // Ahora es lunes 09:00, así que la ventana llega hasta el martes a las 09:00.
    const list = pendingReminders(
      [
        appointment({ id: "a-manana", date: "2026-09-15", time: "08:00" }),
        appointment({
          id: "a-hoy",
          date: "2026-09-14",
          time: "18:00",
          deposit: { amount: 4750, status: "pendiente", method: "efectivo" },
        }),
      ],
      clients,
    );
    expect(list.map((r) => r.appointment.id)).toEqual(["a-hoy", "a-manana"]);
    expect(list[0].depositPending).toBe(true);
    expect(list[1].depositPending).toBe(false);
  });

  it("arma un mensaje con el turno y la seña pendiente", () => {
    const [reminder] = pendingReminders(
      [appointment({ deposit: { amount: 4750, status: "pendiente", method: "efectivo" } })],
      clients,
    );
    const text = reminderMessage(reminder, { name: "D.S Studio", address: "Av. Siempreviva 742" });
    expect(text).toContain("Tomás");
    expect(text).toContain("08:00");
    expect(text).toContain("Corte a tijera");
    expect(text).toContain("seña");
  });
});
