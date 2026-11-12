import { addDays, dateTime, fromISODate, minutesToTime, timeToMinutes, todayISO, toISODate } from "./dates";
import type { Appointment, Barber, BookingRules, BusinessHours, DayHours, TimeBlock, TimeRange } from "./types";

/** Paso por defecto entre turnos. Cada local lo cambia en sus reglas de reserva. */
export const SLOT_STEP_MIN = 30;
export const AFTERNOON_FROM = "14:00";
/** Anticipación mínima por defecto para reservar un turno del día. */
export const MIN_LEAD_MIN = 30;

/**
 * Hasta dónde puede reservar un cliente por su cuenta, por defecto: dos semanas desde hoy.
 * El staff no tiene tope — agenda el día que quiera.
 */
export const CLIENT_BOOKING_DAYS = 14;

/** Reglas con las que arranca una barbería, y las que se usan si falta el dato. */
export const DEFAULT_BOOKING_RULES: BookingRules = {
  slotStepMin: SLOT_STEP_MIN,
  bufferMin: 0,
  windowDays: CLIENT_BOOKING_DAYS,
  minLeadMin: MIN_LEAD_MIN,
  cancelHours: 3,
  cashDeadlineHours: 4,
};

/** Opciones que ofrece la configuración. El servidor valida rangos, no solo estas. */
export const SLOT_STEP_OPTIONS = [10, 15, 20, 30, 45, 60] as const;
export const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30] as const;

/** Rango válido de cada regla: [mínimo, máximo]. */
const RULE_LIMITS: Record<keyof BookingRules, [number, number]> = {
  slotStepMin: [10, 60],
  bufferMin: [0, 60],
  windowDays: [1, 120],
  minLeadMin: [0, 2880],
  cancelHours: [0, 72],
  cashDeadlineHours: [1, 72],
};

const RULE_ERRORS: Record<keyof BookingRules, (min: number, max: number) => string> = {
  slotStepMin: (a, b) => `Los turnos tienen que arrancar cada ${a} a ${b} minutos`,
  bufferMin: (_a, b) => `El tiempo entre turnos va de 0 a ${b} minutos`,
  windowDays: (a, b) => `La reserva anticipada va de ${a} a ${b} días`,
  minLeadMin: (_a, b) => `La anticipación mínima va de 0 a ${b / 60} horas`,
  cancelHours: (_a, b) => `El plazo para cancelar va de 0 a ${b} horas`,
  cashDeadlineHours: (a, b) => `El plazo de la seña en efectivo va de ${a} a ${b} horas`,
};

/** Reglas completas: lo que falta (bases viejas o el caché del navegador) sale del default. */
export function rulesOf(source: { bookingRules?: Partial<BookingRules> } | undefined): BookingRules {
  return { ...DEFAULT_BOOKING_RULES, ...(source?.bookingRules ?? {}) };
}

/** Devuelve el mensaje de error, o null si las reglas son válidas. */
export function validateBookingRules(rules: BookingRules): string | null {
  for (const key of Object.keys(RULE_LIMITS) as (keyof BookingRules)[]) {
    const [min, max] = RULE_LIMITS[key];
    const value = rules[key];
    if (!Number.isInteger(value) || value < min || value > max) return RULE_ERRORS[key](min, max);
  }
  return null;
}

/** "2 semanas", "10 días", "1 día": para los textos que ve el cliente. */
export function windowLabel(days: number): string {
  if (days % 7 === 0) return days === 7 ? "1 semana" : `${days / 7} semanas`;
  return days === 1 ? "1 día" : `${days} días`;
}

/** Último día que un cliente puede elegir al reservar (inclusive). */
export function clientBookingLimit(now = new Date(), days = CLIENT_BOOKING_DAYS): string {
  return addDays(toISODate(now), days);
}

/** ¿Puede un cliente reservar ese día por su cuenta? */
export function withinClientWindow(date: string, now = new Date(), days = CLIENT_BOOKING_DAYS): boolean {
  return date >= toISODate(now) && date <= clientBookingLimit(now, days);
}

/** Horario con el que atiende un barbero: el suyo si lo tiene, si no el del local. */
export function barberHours(barber: Pick<Barber, "schedule"> | undefined, shopHours?: BusinessHours): BusinessHours | undefined {
  return barber?.schedule?.length === 7 ? barber.schedule : shopHours;
}

/** ¿El bloqueo ocupa ese día? Contempla los de varios días y los que se repiten. */
export function blockAppliesOn(block: TimeBlock, date: string): boolean {
  if (date < block.date) return false;
  if (block.until && date > block.until) return false;
  if (block.weekdays?.length) return block.weekdays.includes(fromISODate(date).getDay());
  return block.until ? true : date === block.date;
}

/** ¿El bloqueo todavía puede ocupar algún día desde `today`? */
export function blockIsCurrent(block: TimeBlock, today: string): boolean {
  if (block.weekdays?.length) return !block.until || block.until >= today;
  return (block.until ?? block.date) >= today;
}

/** Valor especial de `barberId` al reservar: cualquier barbero, el primero que esté libre. */
export const ANY_BARBER = "*";

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
  /** Solo con `walkIn`: el horario que está corriendo ahora (empezó y todavía no terminó). */
  current?: boolean;
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
  /**
   * Agenda del local (cliente que entra sin turno): sin anticipación mínima y ofreciendo
   * también el horario en curso. El cliente sigue con la anticipación mínima del local.
   */
  walkIn?: boolean;
  /** Reglas del local (paso, anticipación y tiempo entre turnos). Sin esto, las de siempre. */
  rules?: Pick<BookingRules, "slotStepMin" | "minLeadMin" | "bufferMin">;
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
  walkIn = false,
  rules = DEFAULT_BOOKING_RULES,
}: SlotQuery): Slot[] {
  const step = rules.slotStepMin;
  const buffer = rules.bufferMin;
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
      // El tiempo entre turnos cuenta como ocupado a los dos lados: nadie entra pegado a otro.
      .map((a) => [timeToMinutes(a.time) - buffer, timeToMinutes(a.time) + a.durationMin + buffer] as const),
    ...blocks
      .filter((b) => b.barberId === barberId && blockAppliesOn(b, date))
      .map((b) => [timeToMinutes(b.start), timeToMinutes(b.end)] as const),
  ];

  // Cada franja arma sus propios horarios: un turno no puede cruzar el corte del mediodía.
  const slots: Slot[] = [];
  for (const range of opening.ranges) {
    const open = timeToMinutes(range.open);
    const close = timeToMinutes(range.close);
    for (let start = open; start + step <= close; start += step) {
      const end = start + durationMin;
      // Con `walkIn`, el horario en curso (empezó hace menos de un paso) todavía se puede dar.
      const current = walkIn && isToday && start <= nowMin && nowMin < start + step;
      const tooSoon = isToday && !current && start < nowMin + (walkIn ? 0 : rules.minLeadMin);
      const available = end <= close && !tooSoon && !busy.some(([bs, be]) => overlaps(start, end, bs, be));
      slots.push(current ? { time: minutesToTime(start), available, current } : { time: minutesToTime(start), available });
    }
  }
  return slots;
}

export interface WeekDaySlots {
  date: string;
  slots: { time: string; taken: boolean }[];
}

/**
 * Horarios de varios días para la imagen semanal de redes: los mismos que ofrece la reserva
 * (cada `SLOT_STEP_MIN` dentro de las franjas configuradas, donde entra un servicio de
 * `durationMin`). Un horario queda libre si al menos uno de los barberos lo tiene libre; lo que
 * ya pasó (días anteriores, horas de hoy) cuenta como tomado para que se vea tachado. Los días
 * cerrados no aparecen.
 */
export function weekSlots({
  days,
  barberIds,
  durationMin,
  appointments,
  blocks,
  hours,
  now = new Date(),
}: {
  days: string[];
  barberIds: string[];
  durationMin: number;
  appointments: Appointment[];
  blocks: TimeBlock[];
  hours?: BusinessHours;
  now?: Date;
}): WeekDaySlots[] {
  const today = toISODate(now);
  const result: WeekDaySlots[] = [];
  for (const date of days) {
    const opening = openingHours(date, hours);
    if (!opening) continue;
    const free = new Set<string>();
    if (date >= today) {
      for (const barberId of barberIds) {
        for (const s of buildSlots({ date, barberId, durationMin, appointments, blocks, hours, now })) {
          if (s.available) free.add(s.time);
        }
      }
    }
    // Los horarios donde el servicio no termina antes del corte no se ofrecen: no se muestran.
    const fits = Math.max(durationMin, SLOT_STEP_MIN);
    const slots: WeekDaySlots["slots"] = [];
    for (const range of opening.ranges) {
      const close = timeToMinutes(range.close);
      for (let start = timeToMinutes(range.open); start + fits <= close; start += SLOT_STEP_MIN) {
        const time = minutesToTime(start);
        slots.push({ time, taken: !free.has(time) });
      }
    }
    result.push({ date, slots });
  }
  return result;
}

/** Primer horario libre de un sillón a partir de ahora (o de la apertura si no es hoy). */
export function nextFreeTime(query: Omit<SlotQuery, "durationMin">): string | null {
  const slot = buildSlots({ ...query, durationMin: query.rules?.slotStepMin ?? SLOT_STEP_MIN }).find((s) => s.available);
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

interface FreeBarbersQuery extends Omit<SlotQuery, "barberId" | "hours"> {
  time: string;
  barbers: Pick<Barber, "id" | "active" | "schedule">[];
  shopHours?: BusinessHours;
}

/**
 * Para "me da igual el barbero": los que tienen libre ese horario, primero el que menos
 * trabajo tiene ese día. Así la carga se reparte sola entre los sillones.
 */
export function freeBarbersAt({ time, barbers, shopHours, ...query }: FreeBarbersQuery): string[] {
  const load = (barberId: string) =>
    query.appointments
      .filter((a) => a.date === query.date && a.barberId === barberId && a.status !== "cancelado")
      .reduce((sum, a) => sum + a.durationMin, 0);
  return barbers
    .filter((b) => b.active)
    .filter((b) =>
      buildSlots({ ...query, barberId: b.id, hours: barberHours(b, shopHours) }).some((s) => s.time === time && s.available),
    )
    .map((b) => ({ id: b.id, load: load(b.id) }))
    .sort((a, b) => a.load - b.load)
    .map((b) => b.id);
}

/**
 * Horarios del día sumando todos los sillones: un horario está libre si al menos un barbero
 * lo tiene libre. Es lo que ve el cliente que eligió "me da igual".
 */
export function anyBarberSlots({ barbers, shopHours, ...query }: Omit<FreeBarbersQuery, "time">): Slot[] {
  const byTime = new Map<string, Slot>();
  for (const b of barbers.filter((x) => x.active)) {
    for (const slot of buildSlots({ ...query, barberId: b.id, hours: barberHours(b, shopHours) })) {
      const prev = byTime.get(slot.time);
      if (!prev || (!prev.available && slot.available)) byTime.set(slot.time, slot);
    }
  }
  return [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));
}
