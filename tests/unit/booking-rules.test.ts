import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCommand, DomainError, type Command, type DomainState } from "@/lib/commands";
import { ANY_BARBER, anyBarberSlots, blockAppliesOn, blockIsCurrent, buildSlots, DEFAULT_BUSINESS_HOURS, freeBarbersAt } from "@/lib/schedule";
import type { Appointment, BusinessHours, TimeBlock } from "@/lib/types";
import { admin, bookPayload, demoClient, freezeTime, MONDAY_9AM, seedState, system, WEDNESDAY } from "./support/fixtures";

let state: DomainState;

beforeEach(() => {
  freezeTime();
  state = seedState();
});
afterEach(() => vi.useRealTimers());

const run = (command: Command, actor = admin, s = state, now = MONDAY_9AM) => applyCommand(s, command, actor, now);

function expectError(fn: () => unknown, message: RegExp) {
  expect(fn).toThrow(DomainError);
  expect(fn).toThrow(message);
}

const appt = (over: Partial<Appointment>): Appointment => ({
  id: "x",
  clientId: "c-demo",
  clientName: "Tomás Ferreyra",
  clientPhone: "+54 9 11 5555-0192",
  verified: true,
  barberId: "b1",
  serviceId: "s",
  serviceName: "Corte",
  servicePrice: 10000,
  durationMin: 30,
  date: WEDNESDAY,
  time: "10:00",
  deposit: { amount: 0, status: "abonada", method: "efectivo" },
  products: [],
  status: "confirmado",
  source: "app",
  createdAt: new Date(2026, 8, 1).toISOString(),
  ...over,
});

const slotsQuery = { date: WEDNESDAY, barberId: "b1", durationMin: 30, appointments: [] as Appointment[], blocks: [] as TimeBlock[], now: MONDAY_9AM };

describe("reglas de reserva en la agenda", () => {
  it("el paso entre turnos sale de las reglas del local", () => {
    const times = buildSlots({ ...slotsQuery, rules: { slotStepMin: 15, minLeadMin: 30, bufferMin: 0 } }).map((s) => s.time);
    expect(times.slice(0, 4)).toEqual(["09:00", "09:15", "09:30", "09:45"]);
  });

  it("el tiempo entre turnos deja libre el rato antes y después de cada uno", () => {
    const busy = [appt({ time: "10:00", durationMin: 30 })];
    const slots = buildSlots({ ...slotsQuery, appointments: busy, rules: { slotStepMin: 15, minLeadMin: 30, bufferMin: 15 } });
    const free = (t: string) => slots.find((s) => s.time === t)?.available;
    expect(free("09:15")).toBe(true); // termina 09:45, 15 min antes del turno
    expect(free("09:30")).toBe(false); // terminaría pegado al de las 10
    expect(free("10:30")).toBe(false); // empieza pegado al final
    expect(free("10:45")).toBe(true);
  });
});

describe("bloqueos repetidos y de varios días", () => {
  const base: TimeBlock = { id: "b", barberId: "b1", date: "2026-09-14", start: "13:00", end: "14:00", reason: "Almuerzo" };

  it("un bloqueo simple ocupa solo su día", () => {
    expect(blockAppliesOn(base, "2026-09-14")).toBe(true);
    expect(blockAppliesOn(base, "2026-09-15")).toBe(false);
  });

  it("las vacaciones ocupan todos los días hasta el último", () => {
    const vacation = { ...base, until: "2026-09-20" };
    expect(blockAppliesOn(vacation, "2026-09-17")).toBe(true);
    expect(blockAppliesOn(vacation, "2026-09-21")).toBe(false);
    expect(blockIsCurrent(vacation, "2026-09-18")).toBe(true);
  });

  it("el que se repite ocupa esos días de la semana, para siempre o hasta el último", () => {
    const lunch = { ...base, weekdays: [1, 3] }; // lunes y miércoles
    expect(blockAppliesOn(lunch, "2026-09-16")).toBe(true);
    expect(blockAppliesOn(lunch, "2026-09-17")).toBe(false);
    expect(blockAppliesOn(lunch, "2027-03-01")).toBe(true);
    expect(blockIsCurrent(lunch, "2030-01-01")).toBe(true);
    expect(blockAppliesOn({ ...lunch, until: "2026-09-20" }, "2026-09-21")).toBe(false);
    const slots = buildSlots({ ...slotsQuery, blocks: [lunch] });
    expect(slots.find((s) => s.time === "13:00")?.available).toBe(false);
  });

  it("el servidor rechaza un bloqueo que termina antes de empezar", () => {
    expectError(() => run({ type: "block.create", block: { ...base, barberId: "b-nico", until: "2026-09-01" } }), /último día/);
  });
});

describe("horario propio del barbero", () => {
  const afternoons: BusinessHours = DEFAULT_BUSINESS_HOURS.map((d) => ({ ...d, open: "14:00", close: "20:00", ranges: undefined }));

  it("solo ofrece turnos en su horario", () => {
    const next = run({ type: "barber.upsert", barber: { ...state.barbers.find((b) => b.id === "b-nico")!, schedule: afternoons } });
    expect(next.barbers.find((b) => b.id === "b-nico")?.schedule?.[3].ranges).toEqual([{ open: "14:00", close: "20:00" }]);
    expectError(() => run({ type: "appointment.book", payload: bookPayload({ time: "10:00" }) }, demoClient, next), /no está disponible/);
    expect(() => run({ type: "appointment.book", payload: bookPayload({ time: "15:00" }) }, demoClient, next)).not.toThrow();
  });

  it("rechaza un horario mal armado", () => {
    const broken = afternoons.map((d) => ({ ...d, open: "20:00", close: "14:00" }));
    expectError(() => run({ type: "barber.upsert", barber: { ...state.barbers[0], schedule: broken } }), /cierre/);
  });
});

describe("me da igual el barbero", () => {
  const barbers = [
    { id: "b1", active: true },
    { id: "b2", active: true },
  ];

  it("ofrece un horario si al menos un barbero lo tiene libre, y elige al menos cargado", () => {
    const busy = [appt({ barberId: "b1", time: "10:00" })];
    const slots = anyBarberSlots({ ...slotsQuery, appointments: busy, barbers });
    expect(slots.find((s) => s.time === "10:00")?.available).toBe(true);
    expect(freeBarbersAt({ ...slotsQuery, time: "11:00", appointments: busy, barbers })).toEqual(["b2", "b1"]);
  });

  it("el servidor asigna el barbero al reservar", () => {
    const next = run({ type: "appointment.book", payload: bookPayload({ barberId: ANY_BARBER }) }, demoClient);
    const booked = next.appointments.find((a) => a.id === "a-test")!;
    expect(booked.barberId).not.toBe(ANY_BARBER);
    expect(state.barbers.some((b) => b.id === booked.barberId && b.active)).toBe(true);
  });
});

describe("reglas configurables del local", () => {
  it("valida los rangos", () => {
    expectError(() => run({ type: "settings.booking", patch: { slotStepMin: 5 } }), /cada 10 a 60/);
    expect(run({ type: "settings.booking", patch: { slotStepMin: 15, windowDays: 30 } }).bookingRules).toMatchObject({ slotStepMin: 15, windowDays: 30, cancelHours: 3 });
  });

  it("la ventana de reserva del cliente sale de las reglas", () => {
    const far = "2026-10-07"; // 23 días
    expectError(() => run({ type: "appointment.book", payload: bookPayload({ date: far }) }, demoClient), /2 semanas/);
    const wide = run({ type: "settings.booking", patch: { windowDays: 30 } });
    expect(() => run({ type: "appointment.book", payload: bookPayload({ date: far }) }, demoClient, wide)).not.toThrow();
  });

  it("solo el dueño cambia las reglas", () => {
    expectError(() => run({ type: "settings.booking", patch: { windowDays: 30 } }, demoClient), /staff/);
  });

  it("cada servicio puede tener su propia seña", () => {
    const service = state.services.find((s) => s.id === "s-tijera")!;
    const noDeposit = run({ type: "service.upsert", service: { ...service, depositRate: 0 } });
    const booked = run({ type: "appointment.book", payload: bookPayload() }, demoClient, noDeposit);
    expect(booked.appointments.find((a) => a.id === "a-test")?.deposit).toMatchObject({ amount: 0, status: "abonada" });
  });
});

describe("el sistema", () => {
  it("no puede hacer otra cosa que acreditar señas y marcar recordatorios", () => {
    expectError(() => run({ type: "appointment.cancel", id: "a-test" }, system), /no permitida/);
  });
});
