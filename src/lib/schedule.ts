import { addDays, dateTime, fromISODate, minutesToTime, timeToMinutes, todayISO, toISODate } from "./dates";
import type { Appointment, BusinessHours, TimeBlock } from "./types";

export const SLOT_STEP_MIN = 30;
export const AFTERNOON_FROM = "14:00";
/** Anticipación mínima para reservar un turno del día. */
export const MIN_LEAD_MIN = 30;

export const DEFAULT_BUSINESS_HOURS: BusinessHours = [
  { open: "09:00", close: "20:00", closed: true }, // Domingo
  { open: "09:00", close: "20:00", closed: false },
  { open: "09:00", close: "20:00", closed: false },
  { open: "09:00", close: "20:00", closed: false },
  { open: "09:00", close: "20:00", closed: false },
  { open: "09:00", close: "20:00", closed: false },
  { open: "09:00", close: "18:00", closed: false }, // Sábado
];

export function openingHours(
  iso: string,
  hours: BusinessHours = DEFAULT_BUSINESS_HOURS,
): { open: string; close: string } | null {
  const day = hours[fromISODate(iso).getDay()];
  if (!day || day.closed) return null;
  return { open: day.open, close: day.close };
}

export type Shift = "manana" | "tarde";

export function shiftOf(time: string): Shift {
  return timeToMinutes(time) < timeToMinutes(AFTERNOON_FROM) ? "manana" : "tarde";
}

export interface Slot {
  time: string;
  available: boolean;
}

interface SlotQuery {
  date: string;
  barberId: string;
  durationMin: number;
  appointments: Appointment[];
  blocks: TimeBlock[];
  hours?: BusinessHours;
  /** Turno a ignorar (para reprogramar/mover). */
  excludeAppointmentId?: string;
  now?: Date;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export function buildSlots({
  date,
  barberId,
  durationMin,
  appointments,
  blocks,
  hours,
  excludeAppointmentId,
  now = new Date(),
}: SlotQuery): Slot[] {
  const opening = openingHours(date, hours);
  if (!opening) return [];

  const open = timeToMinutes(opening.open);
  const close = timeToMinutes(opening.close);
  const isToday = date === todayISO();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const busy = [
    ...appointments
      .filter(
        (a) =>
          a.date === date &&
          a.barberId === barberId &&
          a.status !== "cancelado" &&
          a.id !== excludeAppointmentId,
      )
      .map((a) => [timeToMinutes(a.time), timeToMinutes(a.time) + a.durationMin] as const),
    ...blocks
      .filter((b) => b.date === date && b.barberId === barberId)
      .map((b) => [timeToMinutes(b.start), timeToMinutes(b.end)] as const),
  ];

  const slots: Slot[] = [];
  for (let start = open; start + SLOT_STEP_MIN <= close; start += SLOT_STEP_MIN) {
    const end = start + durationMin;
    const available =
      end <= close &&
      !(isToday && start < nowMin + MIN_LEAD_MIN) &&
      !busy.some(([bs, be]) => overlaps(start, end, bs, be));
    slots.push({ time: minutesToTime(start), available });
  }
  return slots;
}

/** Primer horario libre de un sillón a partir de ahora (o de la apertura si no es hoy). */
export function nextFreeTime(query: Omit<SlotQuery, "durationMin">): string | null {
  const slot = buildSlots({ ...query, durationMin: SLOT_STEP_MIN }).find((s) => s.available);
  return slot?.time ?? null;
}

/** Porcentaje de ocupación del día para un barbero (minutos reservados / minutos abiertos). */
export function occupancy(
  date: string,
  barberId: string,
  appointments: Appointment[],
  hours?: BusinessHours,
): number {
  const opening = openingHours(date, hours);
  if (!opening) return 0;
  const openMin = timeToMinutes(opening.close) - timeToMinutes(opening.open);
  const booked = appointments
    .filter((a) => a.date === date && a.barberId === barberId && a.status !== "cancelado")
    .reduce((sum, a) => sum + a.durationMin, 0);
  return Math.min(100, Math.round((booked / openMin) * 100));
}

/**
 * Límite para abonar la seña en efectivo: 4h antes del turno, ajustado al horario del local.
 * Si en ese momento el local está cerrado, el límite pasa al cierre del último día abierto.
 */
export function cashDepositDeadline(date: string, time: string, hours?: BusinessHours, leadHours = 4): Date {
  const raw = new Date(dateTime(date, time).getTime() - leadHours * 3_600_000);
  let day = toISODate(raw);
  const rawMin = raw.getHours() * 60 + raw.getMinutes();
  const opening = openingHours(day, hours);

  if (opening && rawMin >= timeToMinutes(opening.open)) {
    return rawMin <= timeToMinutes(opening.close) ? raw : dateTime(day, opening.close);
  }
  for (let i = 0; i < 14; i++) {
    day = addDays(day, -1);
    const prev = openingHours(day, hours);
    if (prev) return dateTime(day, prev.close);
  }
  return raw;
}
