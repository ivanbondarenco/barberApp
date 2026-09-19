import { appointmentTotals } from "./pricing";
import type { Appointment, PaymentMethod } from "./types";

export interface DaySummary {
  byMethod: Record<PaymentMethod, number>;
  cash: number;
  digital: number;
  credit: number;
  deposits: number;
  balances: number;
  total: number;
  /** Saldo aún no cobrado de turnos confirmados. */
  pending: number;
  pendingCount: number;
  completed: number;
  count: number;
  productsSold: number;
}

/** Resumen de cobros de un día (por fecha del turno). */
export function daySummary(appointments: Appointment[], date: string): DaySummary {
  const byMethod: Record<PaymentMethod, number> = { efectivo: 0, mercadopago: 0, transferencia: 0, credito: 0 };
  let deposits = 0;
  let balances = 0;
  let pending = 0;
  let pendingCount = 0;
  let productsSold = 0;

  const day = appointments.filter((a) => a.date === date && a.status !== "cancelado");
  for (const a of day) {
    const t = appointmentTotals(a);
    if (a.deposit.status === "abonada") {
      byMethod[a.deposit.method] += t.deposit;
      deposits += t.deposit;
    }
    if (a.balancePayment) {
      byMethod[a.balancePayment.method] += a.balancePayment.amount;
      balances += a.balancePayment.amount;
      productsSold += t.products;
    }
    if (a.status === "confirmado") {
      pending += t.dueAtChair;
      pendingCount += 1;
    }
  }

  const cash = byMethod.efectivo;
  const digital = byMethod.mercadopago + byMethod.transferencia;
  return {
    byMethod,
    cash,
    digital,
    credit: byMethod.credito,
    deposits,
    balances,
    total: cash + digital + byMethod.credito,
    pending,
    pendingCount,
    completed: day.filter((a) => a.status === "completado").length,
    count: day.length,
    productsSold,
  };
}
