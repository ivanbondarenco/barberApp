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
  weekSlots,
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
    expect(openingHours("2026-09-19")).toMatchObject({ open: "09:00", close: "18:00" });
    expect(openingHours("2026-09-16")).toMatchObject({ open: "09:00", close: "20:00" });
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

  it("con walkIn (staff) no pide anticipación y ofrece el horario en curso", () => {
    const now = new Date(2026, 8, 14, 10, 10);
    const slots = query({ date: "2026-09-14", now, walkIn: true });
    expect(free(slots)[0]).toBe("10:00");
    expect(slots.find((s) => s.time === "10:00")?.current).toBe(true);
    expect(slots.find((s) => s.time === "10:30")?.current).toBeUndefined();
    expect(free(slots)).not.toContain("09:30");
    // Otro día no hay horario en curso.
    expect(query({ walkIn: true, now }).some((s) => s.current)).toBe(false);
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

describe("horario partido", () => {
  const split = DEFAULT_BUSINESS_HOURS.map((d) => ({
    ...d,
    open: "09:00",
    close: "20:00",
    ranges: [
      { open: "09:00", close: "13:00" },
      { open: "16:00", close: "20:00" },
    ],
  }));

  it("no ofrece turnos en el corte del mediodía", () => {
    const times = buildSlots({ date: "2026-12-16", barberId: "b1", durationMin: 30, appointments: [], blocks: [], hours: split, now: new Date(2026, 0, 1) }).map((s) => s.time);
    expect(times).toContain("12:30");
    expect(times).not.toContain("13:00");
    expect(times).not.toContain("15:30");
    expect(times).toContain("16:00");
    expect(times.at(-1)).toBe("19:30");
  });

  it("un turno no puede cruzar el corte", () => {
    const slots = buildSlots({ date: "2026-12-16", barberId: "b1", durationMin: 60, appointments: [], blocks: [], hours: split, now: new Date(2026, 0, 1) });
    expect(slots.find((s) => s.time === "12:30")?.available).toBe(false);
    expect(slots.find((s) => s.time === "12:00")?.available).toBe(true);
  });

  it("la ocupación cuenta solo las horas abiertas", () => {
    const booked = [appt({ date: "2026-12-16", time: "09:00", durationMin: 240 })];
    expect(occupancy("2026-12-16", "b1", booked, split)).toBe(50);
  });

  it("el plazo de la seña que cae en el corte pasa al cierre de la mañana", () => {
    // Turno 17:00 − 4h = 13:00… se usa 18:00 − 4h = 14:00, en pleno corte.
    const deadline = cashDepositDeadline("2026-12-16", "18:00", split);
    expect([deadline.getHours(), deadline.getMinutes()]).toEqual([13, 0]);
  });
});

describe("weekSlots (imagen semanal)", () => {
  const week = (over: Partial<Parameters<typeof weekSlots>[0]> = {}) =>
    weekSlots({
      // Sábado 12, domingo 13 (cerrado), lunes 14 (hoy, 9:00) y martes 15.
      days: ["2026-09-12", "2026-09-13", "2026-09-14", "2026-09-15"],
      barberIds: ["b1"],
      durationMin: 60,
      appointments: [],
      blocks: [],
      now: MONDAY_9AM,
      ...over,
    });

  it("omite los días cerrados y ofrece los mismos horarios que la reserva", () => {
    const res = week();
    expect(res.map((d) => d.date)).toEqual(["2026-09-12", "2026-09-14", "2026-09-15"]);
    const tue = res[2].slots.map((s) => s.time);
    // Cada 30 min, y el último donde un servicio de 1 hora termina antes del cierre (20:00).
    expect(tue[0]).toBe("09:00");
    expect(tue[1]).toBe("09:30");
    expect(tue[tue.length - 1]).toBe("19:00");
    expect(res[2].slots.every((s) => !s.taken)).toBe(true);
  });

  it("coincide con los horarios disponibles de buildSlots", () => {
    const appointments = [appt({ date: "2026-09-15", time: "11:00" })];
    const fromWeek = week({ appointments })[2].slots.filter((s) => !s.taken).map((s) => s.time);
    const fromBooking = buildSlots({ date: "2026-09-15", barberId: "b1", durationMin: 60, appointments, blocks: [], now: MONDAY_9AM })
      .filter((s) => s.available)
      .map((s) => s.time);
    expect(fromWeek).toEqual(fromBooking);
  });

  it("tacha lo que ya pasó: días anteriores y horas de hoy", () => {
    const [sat, mon] = week();
    expect(sat.slots.every((s) => s.taken)).toBe(true);
    expect(mon.slots.find((s) => s.time === "09:00")?.taken).toBe(true);
    expect(mon.slots.find((s) => s.time === "10:00")?.taken).toBe(false);
  });

  it("tacha los turnos ocupados y los bloqueos", () => {
    const res = week({
      appointments: [appt({ date: "2026-09-15", time: "10:00", durationMin: 60 })],
      blocks: [{ id: "x", barberId: "b1", date: "2026-09-15", start: "15:00", end: "16:30", reason: "" }],
    });
    const taken = res[2].slots.filter((s) => s.taken).map((s) => s.time);
    expect(taken).toEqual(["09:30", "10:00", "10:30", "14:30", "15:00", "15:30", "16:00"]);
  });

  it("con varios barberos, el horario queda libre si alguno lo tiene", () => {
    const res = week({
      barberIds: ["b1", "b2"],
      appointments: [appt({ date: "2026-09-15", time: "10:00" })],
    });
    expect(res[2].slots.find((s) => s.time === "10:00")?.taken).toBe(false);
  });

  it("respeta las franjas configuradas y el corte del mediodía", () => {
    const split = [...DEFAULT_BUSINESS_HOURS];
    split[2] = { open: "09:00", close: "18:00", closed: false, ranges: [{ open: "09:00", close: "12:00" }, { open: "16:00", close: "18:00" }] };
    const tue = (durationMin: number) => week({ durationMin, hours: split })[2].slots.map((s) => s.time);
    expect(tue(30)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "16:00", "16:30", "17:00", "17:30"]);
    expect(tue(60)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "16:00", "16:30", "17:00"]);
  });
});
