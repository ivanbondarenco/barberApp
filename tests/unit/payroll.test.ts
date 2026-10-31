import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCommand, DomainError, type Command, type DomainState } from "@/lib/commands";
import { commissionFor, payrollPreview } from "@/lib/payroll";
import type { Appointment } from "@/lib/types";
import { admin, barberNico, demoClient, freezeTime, MONDAY_9AM, seedState } from "./support/fixtures";

let state: DomainState;

/** Turno terminado de Nico, con el precio que importa para la comisión. */
function done(id: string, date: string, price: number, over: Partial<Appointment> = {}): Appointment {
  const base = seedState().appointments[0];
  return {
    ...base,
    id,
    barberId: "b-nico",
    date,
    time: "10:00",
    serviceName: "Corte",
    servicePrice: price,
    status: "completado",
    ...over,
  };
}

beforeEach(() => {
  freezeTime();
  const seed = seedState();
  state = {
    ...seed,
    barbers: seed.barbers.map((b) => (b.id === "b-nico" ? { ...b, commission: { kind: "percent", value: 50 } } : b)),
    appointments: [
      done("p1", "2026-09-02", 10000),
      done("p2", "2026-09-10", 12000),
      // Fuera del período, de otro barbero, ausente y cancelado: no comisionan.
      done("p3", "2026-09-20", 10000),
      done("p4", "2026-09-05", 10000, { barberId: "b-diego" }),
      done("p5", "2026-09-06", 10000, { status: "no_show" }),
      done("p6", "2026-09-07", 10000, { status: "cancelado" }),
    ],
  };
});
afterEach(() => vi.useRealTimers());

const run = (command: Command, actor = admin, s = state) => applyCommand(s, command, actor, MONDAY_9AM);

function expectError(fn: () => unknown, message: RegExp, status?: number) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).message).toMatch(message);
    if (status) expect((error as DomainError).status).toBe(status);
    return;
  }
  throw new Error(`Se esperaba un error: ${message}`);
}

const advance = (id: string, amount: number, date = "2026-09-08"): Command => ({
  type: "advance.create",
  advance: { id, barberId: "b-nico", amount, date },
});
const payout = (id = "liq-1", over: Partial<{ from: string; to: string }> = {}): Command => ({
  type: "payout.create",
  id,
  barberId: "b-nico",
  from: "2026-09-01",
  to: "2026-09-15",
  method: "efectivo",
  ...over,
});

describe("comisión", () => {
  it("porcentaje del servicio o monto fijo por servicio", () => {
    expect(commissionFor(9500, { kind: "percent", value: 40 })).toBe(3800);
    expect(commissionFor(9500, { kind: "fixed", value: 3000 })).toBe(3000);
  });

  it("solo comisionan los servicios terminados del barbero en el período", () => {
    const nico = state.barbers.find((b) => b.id === "b-nico")!;
    const p = payrollPreview({
      barberId: "b-nico",
      commission: nico.commission,
      from: "2026-09-01",
      to: "2026-09-15",
      appointments: state.appointments,
      advances: [],
      payouts: [],
    });
    expect(p.items.map((i) => i.appointmentId)).toEqual(["p1", "p2"]);
    expect(p).toMatchObject({ gross: 22000, earned: 11000, net: 11000 });
  });

  it("valida la comisión al guardar el barbero", () => {
    const nico = state.barbers.find((b) => b.id === "b-nico")!;
    expectError(() => run({ type: "barber.upsert", barber: { ...nico, commission: { kind: "percent", value: 120 } } }), /entre 0% y 100%/);
    expectError(() => run({ type: "barber.upsert", barber: { ...nico, commission: { kind: "fixed", value: -1 } } }), /inválido/);
  });
});

describe("liquidación", () => {
  it("descuenta los adelantos y congela el recibo", () => {
    let next = run(advance("adv-1", 4000));
    next = run(payout(), admin, next);
    const liq = next.payouts[0];
    expect(liq).toMatchObject({ number: 1, barberName: "Nico “Blade” R.", gross: 22000, earned: 11000, advancesTotal: 4000, net: 7000 });
    expect(liq.items).toHaveLength(2);
    // El adelanto queda marcado: no se vuelve a descontar.
    expect(next.advances[0].payoutId).toBe("liq-1");
  });

  it("un servicio entra en una sola liquidación", () => {
    let next = run(payout());
    expectError(() => run(payout("liq-2"), admin, next), /No hay servicios ni adelantos/);
    // Un servicio nuevo del período sí entra en la siguiente.
    next = { ...next, appointments: [...next.appointments, done("p7", "2026-09-12", 8000)] };
    next = run(payout("liq-2"), admin, next);
    expect(next.payouts[1]).toMatchObject({ number: 2, earned: 4000 });
  });

  it("anular devuelve servicios y adelantos a pendientes", () => {
    let next = run(advance("adv-1", 4000));
    next = run(payout(), admin, next);
    next = run({ type: "payout.delete", id: "liq-1" }, admin, next);
    expect(next.payouts).toHaveLength(0);
    expect(next.advances[0].payoutId).toBeUndefined();
    expect(run(payout("liq-2"), admin, next).payouts[0].net).toBe(7000);
  });

  it("un adelanto ya descontado no se puede borrar", () => {
    let next = run(advance("adv-1", 4000));
    next = run(payout(), admin, next);
    expectError(() => run({ type: "advance.delete", id: "adv-1" }, admin, next), /Anulá esa liquidación/);
  });

  it("el adelanto necesita un monto positivo", () => {
    expectError(() => run(advance("adv-1", 0)), /monto/);
  });

  it("solo el dueño liquida y registra adelantos", () => {
    expectError(() => run(advance("adv-1", 1000), barberNico), /reservada al dueño/, 403);
    expectError(() => run(payout(), barberNico), /reservada al dueño/, 403);
  });
});

describe("quién ve los sueldos", () => {
  it("el barbero ve solo lo suyo y el cliente nada", async () => {
    const { stateForActor } = await import("@/server/visibility");
    let next = run(advance("adv-1", 4000));
    next = run({ type: "advance.create", advance: { id: "adv-2", barberId: "b-diego", amount: 2000, date: "2026-09-08" } }, admin, next);
    next = run(payout(), admin, next);
    next = {
      ...next,
      barbers: next.barbers.map((b) => (b.id === "b-diego" ? { ...b, commission: { kind: "fixed" as const, value: 3000 } } : b)),
    };

    const asNico = stateForActor(next, barberNico);
    expect(asNico.advances.map((a) => a.id)).toEqual(["adv-1"]);
    expect(asNico.payouts).toHaveLength(1);
    expect(asNico.barbers.find((b) => b.id === "b-nico")?.commission).toBeDefined();
    expect(asNico.barbers.find((b) => b.id === "b-diego")?.commission).toBeUndefined();

    const asClient = stateForActor(next, demoClient);
    expect(asClient.advances).toEqual([]);
    expect(asClient.payouts).toEqual([]);
    expect(asClient.barbers.every((b) => b.commission === undefined)).toBe(true);
  });
});

describe("avisos push al staff", () => {
  it("avisa la reserva, la cancelación y la reprogramación del cliente, al barbero del turno", async () => {
    const { pushMessageFor } = await import("@/server/push");
    const { bookPayload } = await import("./support/fixtures");
    const book: Command = { type: "appointment.book", payload: bookPayload() };
    const booked = run(book, demoClient);
    const notice = pushMessageFor(book, demoClient, state, booked);
    expect(notice?.message.title).toBe("Nuevo turno");
    expect(notice?.barberId).toBe(booked.appointments.find((a) => a.id === "a-test")!.barberId);
    expect(notice?.message.url).toBe("/admin/turno/a-test");

    const cancel: Command = { type: "appointment.cancel", id: "a-test" };
    expect(pushMessageFor(cancel, demoClient, booked, run(cancel, demoClient, booked))?.message.title).toBe("Turno cancelado");
  });

  it("no avisa lo que hace el propio staff", async () => {
    const { pushMessageFor } = await import("@/server/push");
    const { bookPayload } = await import("./support/fixtures");
    const book: Command = { type: "appointment.book", payload: bookPayload({ clientPhone: "+54 9 11 5555 0000" }) };
    expect(pushMessageFor(book, admin, state, run(book, admin))).toBeNull();
  });
});
