import { appointmentTotals, isDepositPaid } from "./pricing";
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

  // Las ausencias siguen contando: la seña que se cobró es ingreso del día.
  const day = appointments.filter((a) => a.date === date && a.status !== "cancelado");
  for (const a of day) {
    const t = appointmentTotals(a);
    // Solo la seña acreditada es plata: "en revisión" todavía no entró.
    if (isDepositPaid(a.deposit)) {
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

export interface PeriodTotals {
  byMethod: Record<PaymentMethod, number>;
  total: number;
  cash: number;
  digital: number;
  deposits: number;
  balances: number;
  productsSold: number;
  /** Turnos cobrados en el período. */
  completed: number;
  /** Ausencias: no generan cobro nuevo pero explican por qué hay huecos. */
  noShows: number;
  cancelled: number;
  /** Cobrado por día, para el gráfico y para ver el pico de la semana. */
  byDay: { date: string; total: number }[];
  /** Servicios más vendidos del período. */
  topServices: { name: string; count: number; total: number }[];
}

/**
 * Resumen de un rango de fechas (inclusive). Es lo que el dueño mira para cerrar la semana
 * o el mes: el corte diario ya lo da `daySummary`.
 */
export function periodTotals(appointments: Appointment[], from: string, to: string): PeriodTotals {
  const byMethod: Record<PaymentMethod, number> = { efectivo: 0, mercadopago: 0, transferencia: 0, credito: 0 };
  const byDay = new Map<string, number>();
  const services = new Map<string, { count: number; total: number }>();
  let deposits = 0;
  let balances = 0;
  let productsSold = 0;
  let completed = 0;
  let noShows = 0;
  let cancelled = 0;

  for (const a of appointments) {
    if (a.date < from || a.date > to) continue;
    if (a.status === "cancelado") {
      cancelled += 1;
      continue;
    }
    if (a.status === "no_show") noShows += 1;
    if (a.status === "completado") {
      completed += 1;
      const entry = services.get(a.serviceName) ?? { count: 0, total: 0 };
      services.set(a.serviceName, { count: entry.count + 1, total: entry.total + a.servicePrice });
    }

    const t = appointmentTotals(a);
    let dayTotal = byDay.get(a.date) ?? 0;
    if (isDepositPaid(a.deposit)) {
      byMethod[a.deposit.method] += t.deposit;
      deposits += t.deposit;
      dayTotal += t.deposit;
    }
    if (a.balancePayment) {
      byMethod[a.balancePayment.method] += a.balancePayment.amount;
      balances += a.balancePayment.amount;
      productsSold += t.products;
      dayTotal += a.balancePayment.amount;
    }
    byDay.set(a.date, dayTotal);
  }

  const cash = byMethod.efectivo;
  const digital = byMethod.mercadopago + byMethod.transferencia;
  return {
    byMethod,
    total: cash + digital + byMethod.credito,
    cash,
    digital,
    deposits,
    balances,
    productsSold,
    completed,
    noShows,
    cancelled,
    byDay: [...byDay.entries()].map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date)),
    topServices: [...services.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
  };
}
