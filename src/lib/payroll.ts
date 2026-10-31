import type { Advance, Appointment, Commission, Payout, PayoutItem } from "./types";

/**
 * Comisiones, adelantos y liquidaciones de los barberos.
 *
 * Se comisiona sobre el precio del servicio de cada turno terminado: los productos de la tienda
 * son del local, y una ausencia no se trabajó. Un turno entra en una sola liquidación: una vez
 * liquidado, no vuelve a sumar aunque se liquide otra vez el mismo período.
 */

export const isValidCommission = (c: Commission): boolean =>
  Number.isFinite(c.value) && c.value >= 0 && (c.kind === "fixed" || c.value <= 100);

export function commissionFor(price: number, commission: Commission): number {
  return commission.kind === "percent" ? Math.round((price * commission.value) / 100) : Math.round(commission.value);
}

export function commissionLabel(c: Commission | undefined): string {
  if (!c) return "Sin comisión";
  return c.kind === "percent" ? `${c.value} % por servicio` : `$${c.value.toLocaleString("es-AR")} por servicio`;
}

export interface PayrollPreview {
  items: PayoutItem[];
  gross: number;
  earned: number;
  advances: Advance[];
  advancesTotal: number;
  net: number;
}

/** Ids de los turnos que ya se liquidaron. */
export function settledAppointments(payouts: Payout[]): Set<string> {
  return new Set(payouts.flatMap((p) => p.items.map((i) => i.appointmentId)));
}

/**
 * Lo que se le liquidaría hoy a un barbero por el período: sus servicios terminados que todavía
 * no se pagaron y todos sus adelantos pendientes hasta el cierre del período.
 */
export function payrollPreview(input: {
  barberId: string;
  commission: Commission | undefined;
  from: string;
  to: string;
  appointments: Appointment[];
  advances: Advance[];
  payouts: Payout[];
}): PayrollPreview {
  const settled = settledAppointments(input.payouts);
  const items = input.appointments
    .filter(
      (a) =>
        a.barberId === input.barberId &&
        a.status === "completado" &&
        a.date >= input.from &&
        a.date <= input.to &&
        !settled.has(a.id),
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map((a) => ({
      appointmentId: a.id,
      date: a.date,
      serviceName: a.serviceName,
      price: a.servicePrice,
      amount: input.commission ? commissionFor(a.servicePrice, input.commission) : 0,
    }));

  const advances = input.advances
    .filter((x) => x.barberId === input.barberId && !x.payoutId && x.date <= input.to)
    .sort((a, b) => a.date.localeCompare(b.date));

  const gross = items.reduce((sum, i) => sum + i.price, 0);
  const earned = items.reduce((sum, i) => sum + i.amount, 0);
  const advancesTotal = advances.reduce((sum, x) => sum + x.amount, 0);
  return { items, gross, earned, advances, advancesTotal, net: earned - advancesTotal };
}

/** Adelantos que todavía no se descontaron, de un barbero. */
export const pendingAdvances = (advances: Advance[], barberId: string): Advance[] =>
  advances.filter((x) => x.barberId === barberId && !x.payoutId);
