import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSlots,
  cashDepositDeadline,
  clientBookingLimit,
  DEFAULT_BUSINESS_HOURS,
  nextFreeTime,
  occupancy,
  openingHours,
  shiftOf,
  withinClientWindow,
} from "@/lib/schedule";
import type { Appointment, TimeBlock } from "@/lib/types";
import { freezeTime, MONDAY_9AM } from "./support/fixtures";

const appt = (over: Partial<Appointment>): Appointment => ({
  id: "a1",
  clientName: "X",
  clientPhone: "1100000000",
  verified: false,
  barberId: "b1",
  serviceId: "s1",
  serviceName: "Corte",
  servicePrice: 10000,
  durationMin: 60,
  date: "2026-09-16",
  time: "10:00",
  deposit: { amount: 5000, status: "abonada", method: "efectivo" },
  products: [],
  status: "confirmado",
  source: "app",
  createdAt: "",
  ...over,
});

const query = (over: Partial<Parameters<typeof buildSlots>[0]> = {}) =>
  buildSlots({ date: "2026-09-16", barberId: "b1", durationMin: 30, appointments: [], blocks: [], now: MONDAY_9AM, ...over });

const free = (slots: ReturnType<typeof buildSlots>) => slots.filter((s) => s.available).map((s) => s.time);

beforeEach(() => freezeTime());
afterEach(() => vi.useRealTimers());

describe("horario de atención", () => {
  it("domingo cerrado, sábado hasta las 18", () => {
    expect(openingHours("2026-09-20")).toBeNull();
    expect(openingHours("2026-09-19")).toEqual({ open: "09:00", close: "18:00" });
    expect(openingHours("2026-09-16")).toEqual({ open: "09:00", close: "20:00" });
  });

  it("respeta horarios personalizados", () => {
    const hours = DEFAULT_BUSINESS_HOURS.map((d, i) => (i === 3 ? { ...d, closed: true } : d));
    expect(query({ hours })).toEqual([]);
  });

  it("clasifica mañana y tarde", () => {
    expect(shiftOf("13:30")).toBe("manana");
    expect(shiftOf("14:00")).toBe("tarde");
  });
});

describe("buildSlots", () => {
  it("genera turnos cada 30 minutos dentro del horario", () => {
    const slots = query();
    expect(slots[0].time).toBe("09:00");
    expect(slots.at(-1)?.time).toBe("19:30");
    expect(slots.every((s) => s.available)).toBe(true);
  });

  it("un servicio largo no puede terminar después del cierre", () => {
    const slots = query({ durationMin: 60 });
    expect(slots.find((s) => s.time === "19:30")?.available).toBe(false);
    expect(slots.find((s) => s.time === "19:00")?.available).toBe(true);
  });

  it("no se superpone con turnos del mismo barbero", () => {
    const appointments = [appt({ time: "10:00", durationMin: 60 })];
    const slots = free(query({ appointments, durationMin: 45 }));
    expect(slots).not.toContain("09:30"); // 09:30-10:15 pisa 10:00
    expect(slots).not.toContain("10:00");
    expect(slots).not.toContain("10:30");
    expect(slots).toContain("09:00");
    expect(slots).toContain("11:00");
  });

  it("ignora turnos cancelados, de otro barbero o el turno que se está moviendo", () => {
    expect(free(query({ appointments: [appt({ status: "cancelado" })] }))).toContain("10:00");
    expect(free(query({ appointments: [appt({ barberId: "b2" })] }))).toContain("10:00");
    expect(free(query({ appointments: [appt({})], excludeAppointmentId: "a1" }))).toContain("10:00");
  });

  it("respeta los bloqueos", () => {
    const blocks: TimeBlock[] = [{ id: "k", barberId: "b1", date: "2026-09-16", start: "13:00", end: "14:00", reason: "Almuerzo" }];
    const slots = free(query({ blocks }));
    expect(slots).not.toContain("13:00");
    expect(slots).not.toContain("13:30");
    expect(slots).toContain("14:00");
  });

  it("hoy no ofrece horarios pasados ni con menos de 30 minutos de anticipación", () => {
    const slots = free(query({ date: "2026-09-14", now: new Date(2026, 8, 14, 10, 10) }));
    expect(slots).not.toContain("10:30");
    expect(slots[0]).toBe("11:00");
  });

  it("nextFreeTime y ocupación", () => {
    const appointments = [appt({ time: "09:00", durationMin: 60 })];
    expect(nextFreeTime({ date: "2026-09-16", barberId: "b1", appointments, blocks: [], now: MONDAY_9AM })).toBe("10:00");
    expect(occupancy("2026-09-16", "b1", appointments)).toBe(Math.round((60 / 660) * 100));
  });
});

describe("ventana de reserva del cliente", () => {
  it("llega hasta dos semanas desde hoy, inclusive", () => {
    expect(clientBookingLimit(MONDAY_9AM)).toBe("2026-09-28");
    expect(withinClientWindow("2026-09-28", MONDAY_9AM)).toBe(true);
    expect(withinClientWindow("2026-09-29", MONDAY_9AM)).toBe(false);
    expect(withinClientWindow("2026-09-13", MONDAY_9AM)).toBe(false);
  });
});

describe("cashDepositDeadline", () => {
  it("vence 4 horas antes del turno si el local está abierto", () => {
    expect(cashDepositDeadline("2026-09-16", "15:00")).toEqual(new Date(2026, 8, 16, 11, 0));
  });

  it("si 4 h antes el local está cerrado, vence al cierre del día hábil anterior", () => {
    expect(cashDepositDeadline("2026-09-16", "10:00")).toEqual(new Date(2026, 8, 15, 20, 0));
  });

  it("un lunes a primera hora vence el sábado a las 18", () => {
    expect(cashDepositDeadline("2026-09-21", "09:00")).toEqual(new Date(2026, 8, 19, 18, 0));
  });
});
