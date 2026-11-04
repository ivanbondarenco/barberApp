import { addDays, dateTime, fromISODate, minutesToTime, timeToMinutes, todayISO, toISODate } from "./dates";
import type { Appointment, BusinessHours, DayHours, TimeBlock, TimeRange } from "./types";

export const SLOT_STEP_MIN = 30;
export const AFTERNOON_FROM = "14:00";
/** Anticipación mínima para reservar un turno del día. */
export const MIN_LEAD_MIN = 30;

/**
 * Hasta dónde puede reservar un cliente por su cuenta: dos semanas desde hoy.
 * El staff no tiene tope — agenda el día que quiera.
 */
export const CLIENT_BOOKING_DAYS = 14;

/** Último día que un cliente puede elegir al reservar (inclusive). */
export function clientBookingLimit(now = new Date()): string {
  return addDays(toISODate(now), CLIENT_BOOKING_DAYS);
}

/** ¿Puede un cliente reservar ese día por su cuenta? */
export function withinClientWindow(date: string, now = new Date()): boolean {
  return date >= toISODate(now) && date <= clientBookingLimit(now);
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = [
  { open: "09:00", close: "20:00", closed: true }, // Domingo
  { open: "09:00", close: "20:00", closed: false },
  { open: "09:00", close: "20:00", closed: false },
  { open: "09:00", close: "20:00", closed: false },
  { open: "09:00", close: "20:00", closed: false },
  { open: "09:00", close: "20:00", closed: false },
  { open: "09:00", close: "18:00", closed: false }, // Sábado
];

/** Máximo de franjas por día: alcanza para mañana, tarde y noche con cortes. */
export const MAX_RANGES_PER_DAY = 4;

/** Las franjas de atención de un día (aunque esté cerrado), ordenadas. */
export function dayRanges(day: DayHours): TimeRange[] {
  const list = day.ranges?.length ? day.ranges : [{ open: day.open, close: day.close }];
  return [...list].sort((a, b) => a.open.localeCompare(b.open));
}

/** "09:00–13:00 y 16:00–20:00" para mostrar el horario de un día. */
export function formatDayHours(day: DayHours | undefined, sep = " – "): string {
  if (!day || day.closed) return "Cerrado";
  return dayRanges(day)
    .map((r) => `${r.open}${sep}${r.close}`)
    .join(" y ");
}

/**
 * Valida y normaliza las franjas de un día: cada una cierra después de abrir, no se pisan y
 * quedan ordenadas. Devuelve el mensaje de error, o las franjas listas para guardar.
 */
export function normalizeRanges(ranges: TimeRange[]): TimeRange[] | string {
  if (!ranges.length) return "Agregá al menos un horario";
  if (ranges.length > MAX_RANGES_PER_DAY) return `Hasta ${MAX_RANGES_PER_DAY} franjas por día`;
  const valid = /^([01]\d|2[0-3]):[0-5]\d$/;
  const sorted = [...ranges].sort((a, b) => a.open.localeCompare(b.open));
  for (const [i, r] of sorted.entries()) {
    if (!valid.test(r.open) || !valid.test(r.close)) return "Horario inválido";
    if (r.close <= r.open) return "El cierre debe ser después de la apertura";
    const prev = sorted[i - 1];
    if (prev && r.open < prev.close) return "Los horarios de un mismo día no pueden pisarse";
  }
  return sorted.map((r) => ({ open: r.open, close: r.close }));
}

export function openingHours(
  iso: string,
  hours: BusinessHours = DEFAULT_BUSINESS_HOURS,
): { open: string; close: string; ranges: TimeRange[] } | null {
  const day = hours[fromISODate(iso).getDay()];
  if (!day || day.closed) return null;
  const ranges = dayRanges(day);
  return { open: ranges[0].open, close: ranges[ranges.length - 1].close, ranges };
}

/**
 * Primer día abierto desde `iso` (inclusive).
 *
 * Sirve para que la agenda no se abra en un día cerrado: un domingo, el barbero quiere ver la
 * semana que viene, no la que terminó.
 */
export function firstOpenDay(iso: string, hours?: BusinessHours): string {
  let day = iso;
  for (let i = 0; i < 14; i++) {
    if (openingHours(day, hours)) return day;
    day = addDays(day, 1);
  }
  return iso;
}

/** Último día abierto hasta `iso` (inclusive), hacia atrás. */
export function lastOpenDay(iso: string, hours?: BusinessHours): string {
  let day = iso;
  for (let i = 0; i < 14; i++) {
    if (openingHours(day, hours)) return day;
    day = addDays(day, -1);
  }
  return iso;
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

  const isToday = date === todayISO();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const nowISO = now.toISOString();
  const busy = [
    ...appointments
      .filter(
        (a) =>
          a.date === date &&
          a.barberId === barberId &&
          a.status !== "cancelado" &&
          a.id !== excludeAppointmentId &&
          // Reserva digital cuyo plazo de pago venció: el horario ya está libre.
          !(a.holdUntil !== undefined && a.holdUntil <= nowISO),
      )
      .map((a) => [timeToMinutes(a.time), timeToMinutes(a.time) + a.durationMin] as const),
    ...blocks
      .filter((b) => b.date === date && b.barberId === barberId)
      .map((b) => [timeToMinutes(b.start), timeToMinutes(b.end)] as const),
  ];

  // Cada franja arma sus propios horarios: un turno no puede cruzar el corte del mediodía.
  const slots: Slot[] = [];
  for (const range of opening.ranges) {
    const open = timeToMinutes(range.open);
    const close = timeToMinutes(range.close);
    for (let start = open; start + SLOT_STEP_MIN <= close; start += SLOT_STEP_MIN) {
      const end = start + durationMin;
      const available =
        end <= close &&
        !(isToday && start < nowMin + MIN_LEAD_MIN) &&
        !busy.some(([bs, be]) => overlaps(start, end, bs, be));
      slots.push({ time: minutesToTime(start), available });
    }
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
  const openMin = opening.ranges.reduce((sum, r) => sum + timeToMinutes(r.close) - timeToMinutes(r.open), 0);
  if (openMin <= 0) return 0;
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
    // Dentro de una franja vale tal cual; en un corte (o después del cierre), el cierre de la
    // última franja que ya empezó.
    const started = opening.ranges.filter((r) => rawMin >= timeToMinutes(r.open));
    const last = started[started.length - 1];
    return rawMin <= timeToMinutes(last.close) ? raw : dateTime(day, last.close);
  }
  for (let i = 0; i < 14; i++) {
    day = addDays(day, -1);
    const prev = openingHours(day, hours);
    if (prev) return dateTime(day, prev.close);
  }
  return raw;
}
