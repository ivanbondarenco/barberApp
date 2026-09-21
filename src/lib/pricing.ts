import type { Appointment, Deposit } from "./types";

/** Seña con la que arranca una barbería nueva y la que se usa si falta el dato. */
export const DEFAULT_DEPOSIT_RATE = 0.5;

/** Tasas que puede elegir el local. 0 = no pide seña. */
export const DEPOSIT_RATE_OPTIONS = [0, 0.3, 0.5, 1] as const;

export function isValidDepositRate(rate: number): boolean {
  return Number.isFinite(rate) && rate >= 0 && rate <= 1;
}

/** Horas límite antes del turno para abonar la seña en efectivo en el local. */
export const CASH_DEPOSIT_DEADLINE_HOURS = 4;

/** Cancelación / reprogramación sin perder la seña hasta N horas antes. */
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
