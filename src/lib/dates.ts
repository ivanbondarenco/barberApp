const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_LONG = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTH_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha local → YYYY-MM-DD */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function isSunday(iso: string): boolean {
  return fromISODate(iso).getDay() === 0;
}

/** Próximos `count` días hábiles (Lun–Sáb) desde `startISO` inclusive. */
export function openDaysFrom(startISO: string, count: number): string[] {
  const days: string[] = [];
  let cursor = startISO;
  while (days.length < count) {
    if (!isSunday(cursor)) days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

/** Lunes a Sábado de la semana que contiene `iso` (desplazada `weekOffset` semanas). */
export function workWeek(iso: string, weekOffset = 0): string[] {
  const d = fromISODate(iso);
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  const monday = addDays(iso, 1 - dow + weekOffset * 7);
  return Array.from({ length: 6 }, (_, i) => addDays(monday, i));
}

/** Primer y último día del mes que contiene `iso`, en formato ISO. */
export function monthRange(iso: string): { from: string; to: string } {
  const d = fromISODate(iso);
  const from = toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
  const to = toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  return { from, to };
}

/** Mismo día de otro mes (recortado al último día si ese mes es más corto). */
export function addMonths(iso: string, months: number): string {
  const d = fromISODate(iso);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return toISODate(target);
}

export function firstOfMonth(iso: string): string {
  const d = fromISODate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/**
 * Semanas (Lun→Dom) que cubren el mes de `iso`, para dibujar un calendario mensual.
 * Las casillas de relleno vienen en `null`: no son días de este mes.
 */
export function monthGrid(iso: string): (string | null)[][] {
  const first = firstOfMonth(iso);
  const start = fromISODate(first);
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const firstDow = start.getDay() === 0 ? 7 : start.getDay();
  const cells: (string | null)[] = Array.from({ length: firstDow - 1 }, () => null);
  for (let i = 0; i < daysInMonth; i++) cells.push(addDays(first, i));
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

export function isoWeekNumber(iso: string): number {
  const d = fromISODate(iso);
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function dayShort(iso: string): string {
  return DAY_SHORT[fromISODate(iso).getDay()];
}

export function dayLong(iso: string): string {
  return DAY_LONG[fromISODate(iso).getDay()];
}

export function dayNumber(iso: string): number {
  return fromISODate(iso).getDate();
}

export function monthShort(iso: string): string {
  return MONTH_SHORT[fromISODate(iso).getMonth()];
}

export function monthYear(iso: string): string {
  const d = fromISODate(iso);
  return `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Viernes 25 Octubre" */
export function longDate(iso: string): string {
  const d = fromISODate(iso);
  return `${DAY_LONG[d.getDay()]} ${d.getDate()} ${MONTH_LONG[d.getMonth()]}`;
}

/** "Hoy, 24 Oct" / "Vie 25 Oct" */
export function shortDate(iso: string): string {
  const label = iso === todayISO() ? "Hoy," : dayShort(iso);
  return `${label} ${dayNumber(iso)} ${monthShort(iso)}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function dateTime(iso: string, time: string): Date {
  const d = fromISODate(iso);
  const mins = timeToMinutes(time);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

export function hoursUntil(iso: string, time: string, now = new Date()): number {
  return (dateTime(iso, time).getTime() - now.getTime()) / 3_600_000;
}

export function nowTime(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
