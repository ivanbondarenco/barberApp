import "server-only";
import { getDb, queryAll } from "./db";
import { findOrder, getOrder, isOrderPaid } from "./mercadopago";
import { reportError } from "./monitor";
import { executeCommand, loadState } from "./repository";
import { claimPaymentEvent } from "./secrets";

/**
 * Acreditación de las señas pagadas por Mercado Pago.
 *
 * La vía principal es el webhook. Como respaldo (lo pide Mercado Pago: "lógica de backup de
 * notificaciones"), un repaso periódico consulta por la API las órdenes recientes cuyo turno
 * sigue con la seña pendiente: si una notificación se perdió, la seña igual se acredita.
 */

export type SettleResult = "ajena" | "otro-turno" | "sin-pagar" | "repetida" | "acreditada";

/**
 * Consulta la orden contra la API (nunca se cree lo que llega en una notificación) y, si está
 * cobrada, acredita la seña del turno una sola vez.
 */
export async function settleOrder(orderId: string): Promise<SettleResult> {
  // Una orden que no creó la app (otra integración de la misma cuenta) no es asunto nuestro.
  const ours = await findOrder(orderId);
  if (!ours) return "ajena";

  const order = await getOrder(ours.shopId, orderId);
  // La orden tiene que ser del turno con el que se registró.
  if (order.externalReference !== ours.appointmentId) {
    console.warn("Orden de Mercado Pago con otro turno", { orderId, expected: ours.appointmentId });
    return "otro-turno";
  }
  if (!isOrderPaid(order)) return "sin-pagar";

  // Mercado Pago reintenta la misma notificación, y el repaso puede llegar después: una sola vez.
  if (!(await claimPaymentEvent(order.id, ours.shopId, ours.appointmentId, order.status))) return "repetida";

  await executeCommand(
    { role: "sistema", shopId: ours.shopId },
    { type: "appointment.deposit", id: ours.appointmentId, method: "mercadopago", reference: order.id },
  );
  return "acreditada";
}

/** Hasta cuándo se sigue mirando una orden: después, si no se pagó, ya no se va a pagar. */
const LOOKBACK_MS = 24 * 3_600_000;
const EVERY_MS = 15 * 60_000;
const FIRST_RUN_MS = 2 * 60_000;

/** Órdenes de las últimas 24 h, sin acreditar, cuyo turno sigue esperando la seña. */
export async function ordersToReconcile(now = new Date()): Promise<string[]> {
  const db = await getDb();
  const since = new Date(now.getTime() - LOOKBACK_MS).toISOString();
  const rows = queryAll<{ order_id: string; shop_id: string; appointment_id: string }>(
    db,
    `SELECT o.order_id, o.shop_id, o.appointment_id FROM mp_orders o
     WHERE o.created_at >= ? AND NOT EXISTS (SELECT 1 FROM payment_events e WHERE e.id = o.order_id COLLATE NOCASE)`,
    [since],
  );
  const pending: string[] = [];
  const states = new Map<string, Awaited<ReturnType<typeof loadState>>["state"]>();
  for (const row of rows) {
    if (!states.has(row.shop_id)) states.set(row.shop_id, (await loadState(row.shop_id)).state);
    const appointment = states.get(row.shop_id)?.appointments.find((a) => a.id === row.appointment_id);
    if (appointment && appointment.status === "confirmado" && appointment.deposit.status !== "abonada") pending.push(row.order_id);
  }
  return pending;
}

/** Un repaso: consulta cada orden pendiente. Un error en una no frena las demás. */
export async function reconcileOrders(now = new Date()): Promise<number> {
  let credited = 0;
  for (const orderId of await ordersToReconcile(now)) {
    try {
      if ((await settleOrder(orderId)) === "acreditada") credited++;
    } catch (error) {
      await reportError("mercadopago.reconcile", error, { orderId });
    }
  }
  return credited;
}

let started = false;

/** Arranca el repaso periódico. Sin Mercado Pago configurado no hace nada. */
export function startOrderReconciler(): void {
  if (started || !process.env.MP_CLIENT_ID?.trim()) return;
  started = true;
  const run = () => void reconcileOrders().catch((error) => reportError("mercadopago.reconcile", error));
  setTimeout(run, FIRST_RUN_MS).unref?.();
  setInterval(run, EVERY_MS).unref?.();
}
