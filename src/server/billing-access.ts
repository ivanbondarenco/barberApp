import "server-only";
import type { Database } from "sql.js";
import { DomainError, type Actor, type Command } from "@/lib/commands";
import { billingStatus, TRIAL_DAYS, type BillingDates, type BillingStatus } from "@/lib/billing";
import { testModeAllowed } from "./config";
import { LEGACY_SHOP_ID, queryOne } from "./db";

/**
 * Qué puede hacer una barbería según su suscripción. Separado de `billing.ts` (Mercado Pago,
 * mails) porque lo usa `repository.ts` en cada comando, y así no se importan en círculo.
 */

export interface BillingRow {
  shop_id: string;
  trial_ends_at: string;
  paid_until: string | null;
  mp_preapproval_id: string | null;
  mp_preapproval_status: string | null;
  updated_at: string;
}

/** Mensaje que ven los clientes de un local suspendido. */
export const SUSPENDED_BOOKING_MESSAGE = "Este local no está tomando reservas online por ahora. Escribile por WhatsApp.";
export const SUSPENDED_OWNER_MESSAGE =
  "La suscripción de BarberApp está suspendida. Pagala desde Suscripción para volver a usar la agenda.";
export const SUSPENDED_BARBER_MESSAGE =
  "La suscripción de BarberApp del local está suspendida. Avisale al dueño para volver a usar la agenda.";

/**
 * La barbería de demostración y los tests E2E nunca se suspenden: la demo es de la instalación,
 * y los E2E corren con fechas reales sobre una base que no pagaría nunca.
 */
export function billingExempt(shopId: string, env: Record<string, string | undefined> = process.env): boolean {
  return shopId === LEGACY_SHOP_ID || (env.E2E_TEST_MODE === "1" && testModeAllowed(env));
}

export function billingRow(db: Database, shopId: string): BillingRow | undefined {
  return queryOne<BillingRow>(db, "SELECT * FROM shop_billing WHERE shop_id = ?", [shopId]);
}

export function rowDates(row: BillingRow | undefined, now: Date = new Date()): BillingDates {
  // Sin fila (una barbería creada fuera de createShop, antes del backfill): se la trata como
  // recién llegada. El backfill de db.ts le escribe su fila la próxima vez que abre la base.
  return row
    ? { trialEndsAt: row.trial_ends_at, paidUntil: row.paid_until }
    : { trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 86_400_000).toISOString(), paidUntil: null };
}

export function shopBillingStatus(db: Database, shopId: string, now: Date = new Date()): BillingStatus {
  if (billingExempt(shopId)) return "active";
  return billingStatus(rowDates(billingRow(db, shopId), now), now);
}

/** Comandos de clientes que ocupan un horario: los que se cortan con el local suspendido. */
const BOOKING_COMMANDS = new Set<Command["type"]>(["appointment.book", "appointment.update"]);

/**
 * Corta lo que no puede hacerse con la suscripción suspendida. Los datos no se tocan nunca:
 * - Staff: no opera (lee su agenda, pero no la cambia). Pagar va por /api/billing, no por acá.
 * - Clientes e invitados: no reservan ni reprograman. Sí pueden cancelar, avisar una
 *   transferencia o calificar: son turnos que ya tenían y el local los tiene que ver.
 * - Sistema (webhook de pagos): sigue acreditando señas ya cobradas. Esa plata ya entró.
 */
export function assertShopOperational(db: Database, actor: Actor, command?: Pick<Command, "type">): void {
  if (actor.role === "sistema") return;
  if (shopBillingStatus(db, actor.shopId) !== "suspended") return;
  if (actor.role === "admin") throw new DomainError(SUSPENDED_OWNER_MESSAGE, 402);
  if (actor.role === "barbero") throw new DomainError(SUSPENDED_BARBER_MESSAGE, 402);
  if (!command || BOOKING_COMMANDS.has(command.type)) throw new DomainError(SUSPENDED_BOOKING_MESSAGE, 402);
}
