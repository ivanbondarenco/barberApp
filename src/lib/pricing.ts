import type { Appointment } from "./types";

/**
 * Regla de negocio crítica: la seña es SIEMPRE exactamente el 50% del servicio.
 * No es configurable desde la UI.
 */
export const DEPOSIT_RATE = 0.5 as const;

/** Horas límite antes del turno para abonar la seña en efectivo en el local. */
export const CASH_DEPOSIT_DEADLINE_HOURS = 4;

/** Cancelación / reprogramación sin perder la seña hasta N horas antes. */
export const FREE_CANCELLATION_HOURS = 3;

export interface DepositSplit {
  total: number;
  deposit: number;
  balance: number;
}

export function splitDeposit(total: number): DepositSplit {
  const deposit = Math.round(total * DEPOSIT_RATE);
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
  const { deposit } = splitDeposit(appointment.servicePrice);
  const products = productsTotal(appointment);
  // Se usa lo efectivamente abonado: si el servicio cambió después de pagar la seña, el saldo se ajusta.
  const depositPaid = appointment.deposit.status === "abonada" ? appointment.deposit.amount : 0;
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
