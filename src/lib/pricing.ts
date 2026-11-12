import type { Appointment, Deposit } from "./types";

/** Seña con la que arranca una barbería nueva y la que se usa si falta el dato. */
export const DEFAULT_DEPOSIT_RATE = 0.5;

/** Tasas que puede elegir el local. 0 = no pide seña. */
export const DEPOSIT_RATE_OPTIONS = [0, 0.3, 0.5, 1] as const;

export function isValidDepositRate(rate: number): boolean {
  return Number.isFinite(rate) && rate >= 0 && rate <= 1;
}

/**
 * Valores por defecto de los plazos. Cada barbería tiene los suyos en sus reglas de reserva
 * (`rulesOf(state).cashDeadlineHours` y `.cancelHours`): las pantallas y el servidor usan esos.
 */
export const CASH_DEPOSIT_DEADLINE_HOURS = 4;
export const FREE_CANCELLATION_HOURS = 3;

/**
 * Minutos que una reserva digital retiene el horario mientras el cliente paga en la pasarela.
 * Vencido el plazo sin acreditación, el turno se libera solo (ver `releaseExpiredHolds`).
 */
export const HOLD_MINUTES = 15;

/**
 * Ausencias a partir de las cuales el cliente deja de poder reservar con seña en efectivo:
 * tiene que abonarla por adelantado. Es la contracara de haberle retenido la seña.
 */
export const NO_SHOW_DEPOSIT_LIMIT = 2;

/** Ausencias del cliente que cuentan para esa regla. */
export function noShowCount(appointments: { clientId?: string; status: string }[], clientId: string): number {
  return appointments.filter((a) => a.clientId === clientId && a.status === "no_show").length;
}

/** Horas antes del turno en que corresponde mandar el recordatorio. */
export const REMINDER_LEAD_HOURS = 24;

/** La seña cuenta como cobrada solo si está acreditada; `en_revision` todavía no es plata. */
export const isDepositPaid = (deposit: Pick<Deposit, "status">): boolean => deposit.status === "abonada";

/**
 * Tasa de seña de un servicio: la suya si la tiene, si no la del local.
 * Un servicio puede pedir seña aunque el local no (o al revés), por ejemplo solo en el color.
 */
export function serviceDepositRate(service: { depositRate?: number } | undefined, shopRate: number): number {
  const own = service?.depositRate;
  return own !== undefined && isValidDepositRate(own) ? own : shopRate;
}

/** "30%" a partir de la tasa (0.3). */
export function depositPercent(rate: number): string {
  return `${Math.round((isValidDepositRate(rate) ? rate : DEFAULT_DEPOSIT_RATE) * 100)}%`;
}

/**
 * Porcentaje de la seña que quedó fijada en un turno. Se deduce del monto y no de la tasa de hoy,
 * porque el local puede haberla cambiado después de la reserva.
 */
export function appointmentDepositPercent(appointment: { deposit: Pick<Deposit, "amount">; servicePrice: number }): string {
  if (appointment.servicePrice <= 0) return depositPercent(DEFAULT_DEPOSIT_RATE);
  return `${Math.round((appointment.deposit.amount / appointment.servicePrice) * 100)}%`;
}

export interface DepositSplit {
  total: number;
  deposit: number;
  balance: number;
}

/**
 * Parte el precio en seña y saldo con la tasa de la barbería.
 * Con tasa 0 no hay seña: se cobra todo en el sillón.
 */
export function splitDeposit(total: number, rate: number = DEFAULT_DEPOSIT_RATE): DepositSplit {
  const deposit = Math.round(total * (isValidDepositRate(rate) ? rate : DEFAULT_DEPOSIT_RATE));
  return { total, deposit, balance: total - deposit };
}

export function productsTotal(appointment: Pick<Appointment, "products">): number {
  return appointment.products.reduce((sum, p) => sum + p.unitPrice * p.qty, 0);
}

export interface AppointmentTotals {
  service: number;
  deposit: number;
  depositPaid: number;
  serviceBalance: number;
  products: number;
  /** Lo que resta abonar en el sillón (saldo del servicio + productos, + seña si no se pagó). */
  dueAtChair: number;
  grandTotal: number;
}

export function appointmentTotals(appointment: Appointment): AppointmentTotals {
  // La seña del turno ya quedó fijada al reservarlo: no se recalcula con la tasa de hoy,
  // porque el local puede haberla cambiado después.
  const deposit = appointment.deposit.amount;
  const products = productsTotal(appointment);
  // Se usa lo efectivamente abonado: si el servicio cambió después de pagar la seña, el saldo se ajusta.
  const depositPaid = isDepositPaid(appointment.deposit) ? appointment.deposit.amount : 0;
  const serviceBalance = Math.max(0, appointment.servicePrice - (depositPaid || deposit));
  return {
    service: appointment.servicePrice,
    deposit,
    depositPaid,
    serviceBalance,
    products,
    dueAtChair: Math.max(0, appointment.servicePrice - depositPaid) + products,
    grandTotal: appointment.servicePrice + products,
  };
}
