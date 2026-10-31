import { describe, expect, it } from "vitest";
import { setupTasks, staffActivity, unreadCount } from "@/lib/notifications";
import type { Appointment } from "@/lib/types";
import { MONDAY_9AM, seedState } from "./support/fixtures";

const base = seedState().appointments[0];
const appt = (over: Partial<Appointment>): Appointment => ({
  ...base,
  id: "n1",
  barberId: "b-nico",
  clientName: "Tomás",
  serviceName: "Corte",
  date: "2026-09-16",
  time: "10:00",
  source: "app",
  status: "confirmado",
  createdAt: "2026-09-14T08:00:00.000Z",
  deposit: { amount: 0, status: "abonada", method: "efectivo" },
  reminderSentAt: "2026-09-14T08:00:00.000Z",
  ...over,
});

describe("actividad del panel", () => {
  it("lista reservas, cancelaciones y transferencias por revisar, de la más nueva a la más vieja", () => {
    const items = staffActivity(
      {
        clients: [],
        appointments: [
          appt({ id: "a" }),
          appt({ id: "b", createdAt: "2026-09-14T08:05:00.000Z", status: "cancelado", cancelledAt: "2026-09-14T08:30:00.000Z" }),
          appt({ id: "c", createdAt: "2026-09-14T08:10:00.000Z", deposit: { amount: 1000, status: "en_revision", method: "transferencia", declaredAt: "2026-09-14T08:45:00.000Z" } }),
          // Vieja: más de una semana.
          appt({ id: "d", createdAt: "2026-08-01T08:00:00.000Z" }),
          // Cargada por el local: no es un aviso.
          appt({ id: "e", source: "manual" }),
        ],
      },
      { role: "admin" },
      MONDAY_9AM,
    );
    expect(items.map((i) => i.id)).toEqual(["c:transferencia", "b:cancelacion", "c:reserva", "b:reserva", "a:reserva"]);
  });

  it("el barbero ve solo lo de su sillón", () => {
    const items = staffActivity({ clients: [], appointments: [appt({ id: "a" }), appt({ id: "b", barberId: "b-diego" })] }, { role: "barbero", barberId: "b-diego" }, MONDAY_9AM);
    expect(items.map((i) => i.id)).toEqual(["b:reserva"]);
  });

  it("cuenta como nuevo lo posterior a la última vez que se abrió", () => {
    const items = staffActivity({ clients: [], appointments: [appt({ id: "a" })] }, { role: "admin" }, MONDAY_9AM);
    expect(unreadCount(items, [], null)).toBe(1);
    expect(unreadCount(items, [], "2026-09-14T08:30:00.000Z")).toBe(0);
  });
});

describe("configuración pendiente", () => {
  it("le pide al dueño conectar Mercado Pago y WhatsApp; al barbero, nada", () => {
    const state = { services: seedState().services, integrations: { mercadopagoReady: false, whatsappReady: false } };
    expect(setupTasks(state, "admin").map((t) => t.id)).toEqual(["mercadopago", "whatsapp"]);
    expect(setupTasks(state, "barbero")).toEqual([]);
    expect(setupTasks({ ...state, integrations: { mercadopagoReady: true, whatsappReady: true } }, "admin")).toEqual([]);
  });
});
