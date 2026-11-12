import "server-only";
import { randomUUID } from "node:crypto";
import type { Database } from "sql.js";
import { DomainError } from "@/lib/commands";
import {
  billingStatus,
  coveredUntil,
  daysLeft,
  extendPaidUntil,
  needsAttention,
  nextRenewal,
  planMinPrice,
  planPrice,
  planReferenceService,
  subscriptionActive,
  suspendsAt,
  type BillingDates,
  type BillingInfo,
  type BillingMethod,
  type BillingPayment,
  type BillingStatus,
  type BillingStatusInfo,
} from "@/lib/billing";
import { toISODate } from "@/lib/dates";
import { uid } from "@/lib/format";
import type { BusinessInfo, Service } from "@/lib/types";
import { billingExempt, billingRow, rowDates, type BillingRow } from "./billing-access";
import { normalizeIdentifier } from "./crypto";
import { getDb, queryAll, queryOne } from "./db";
import { billingNoticeEmail, type BillingNoticeKind } from "./emails";
import { mailReady, sendMail } from "./mail";
import { reportError } from "./monitor";
import { ensureSeeded, mutate } from "./repository";

/**
 * Suscripción de cada barbería a BarberApp.
 *
 * A diferencia de las señas (que cobra cada local con SU cuenta), la suscripción se cobra con la
 * cuenta de Mercado Pago de la plataforma: MP_PLATFORM_ACCESS_TOKEN. Se usa la API de
 * suscripciones (preapproval): el dueño autoriza una vez en Mercado Pago y se le debita solo
 * todos los meses. Cada cobro llega por el webhook y extiende `paid_until` un mes.
 *
 * También se aceptan pagos a mano (transferencia o efectivo), que carga el superadmin.
 */

const API = "https://api.mercadopago.com";
const DAY_MS = 86_400_000;

// ───────── Lectura ─────────

function shopServices(db: Database, shopId: string): Service[] {
  return queryAll<{ data: string }>(db, "SELECT data FROM services WHERE shop_id = ?", [shopId]).map(
    (r) => JSON.parse(r.data) as Service,
  );
}

function shopPrice(db: Database, shopId: string) {
  const services = shopServices(db, shopId);
  const minPrice = planMinPrice();
  const reference = planReferenceService(services);
  return { price: planPrice(services, minPrice), minPrice, reference };
}

/** Dueño de la barbería y el email al que se le escribe (el de su cuenta o, si entró con celular, el del local). */
function ownerContact(db: Database, shopId: string): { name: string; identifier: string; email: string | null } | undefined {
  const owner = queryOne<{ name: string; identifier: string }>(
    db,
    "SELECT name, identifier FROM users WHERE shop_id = ? AND role = 'admin' ORDER BY created_at LIMIT 1",
    [shopId],
  );
  if (!owner) return undefined;
  if (owner.identifier.includes("@")) return { ...owner, email: owner.identifier };
  const info = queryOne<{ data: string }>(db, "SELECT data FROM settings WHERE shop_id = ? AND key = 'businessInfo'", [shopId]);
  const email = info ? (JSON.parse(info.data) as BusinessInfo).email?.trim().toLowerCase() : "";
  return { ...owner, email: email && email.includes("@") ? email : null };
}

function payments(db: Database, shopId: string): BillingPayment[] {
  return queryAll<{ id: string; amount: number; method: BillingMethod; paid_until: string; note: string | null; created_at: string }>(
    db,
    "SELECT id, amount, method, paid_until, note, created_at FROM billing_payments WHERE shop_id = ? ORDER BY created_at DESC",
    [shopId],
  ).map((r) => ({
    id: r.id,
    amount: r.amount,
    method: r.method,
    paidUntil: r.paid_until,
    note: r.note ?? undefined,
    createdAt: r.created_at,
  }));
}

/** ¿La instalación puede cobrar suscripciones por Mercado Pago? */
export function platformMercadopagoReady(): boolean {
  return !!process.env.MP_PLATFORM_ACCESS_TOKEN?.trim();
}

function statusOf(shopId: string, dates: BillingDates, now: Date): BillingStatus {
  return billingExempt(shopId) ? "active" : billingStatus(dates, now);
}

export async function getBillingInfo(shopId: string, now: Date = new Date()): Promise<BillingInfo> {
  const db = await ensureSeeded();
  const row = billingRow(db, shopId);
  const dates = rowDates(row, now);
  const { price, minPrice, reference } = shopPrice(db, shopId);
  return {
    status: statusOf(shopId, dates, now),
    exempt: billingExempt(shopId),
    trialEndsAt: dates.trialEndsAt,
    paidUntil: dates.paidUntil,
    daysLeft: daysLeft(dates, now),
    suspendsAt: suspendsAt(dates).toISOString(),
    nextRenewal: nextRenewal(dates, now).toISOString(),
    price,
    minPrice,
    reference: reference ? { name: reference.name, price: reference.price } : null,
    subscription: row?.mp_preapproval_id ? { id: row.mp_preapproval_id, status: row.mp_preapproval_status ?? "pending" } : null,
    mercadopagoAvailable: platformMercadopagoReady(),
    ownerEmail: ownerContact(db, shopId)?.email ?? null,
    payments: payments(db, shopId),
  };
}

/** Lo mínimo para el aviso del panel. Lo puede pedir cualquiera del staff. */
export async function getBillingStatus(shopId: string, now: Date = new Date()): Promise<BillingStatusInfo> {
  const db = await ensureSeeded();
  const dates = rowDates(billingRow(db, shopId), now);
  const exempt = billingExempt(shopId);
  return {
    status: statusOf(shopId, dates, now),
    daysLeft: daysLeft(dates, now),
    attention: !exempt && needsAttention(dates, now),
  };
}

// ───────── Escritura ─────────

/** Asegura la fila de la barbería (las anteriores al backfill pueden no tenerla todavía). */
function ensureRow(db: Database, shopId: string, now: Date): BillingRow {
  const row = billingRow(db, shopId);
  if (row) return row;
  const dates = rowDates(undefined, now);
  db.run("INSERT INTO shop_billing (shop_id, trial_ends_at, updated_at) VALUES (?, ?, ?)", [
    shopId,
    dates.trialEndsAt,
    now.toISOString(),
  ]);
  return billingRow(db, shopId)!;
}

export interface PaymentInput {
  months: number;
  amount: number;
  method: BillingMethod;
  note?: string;
  /** Quién lo cargó: el identificador del superadmin, o `mercadopago`. */
  createdBy: string;
  /** Id fijo para los cobros de Mercado Pago, así una notificación repetida no se aplica dos veces. */
  id?: string;
}

/**
 * Registra una cuota cobrada y extiende el "pagado hasta". Devuelve false si ese pago ya estaba
 * registrado (el mismo cobro de Mercado Pago notificado de nuevo).
 */
export async function recordPayment(shopId: string, input: PaymentInput, now: Date = new Date()): Promise<boolean> {
  const db = await ensureSeeded();
  if (!queryOne(db, "SELECT id FROM shops WHERE id = ?", [shopId])) throw new DomainError("La barbería no existe", 404);
  return mutate((d) => {
    const id = input.id ?? uid("bp");
    if (queryOne(d, "SELECT id FROM billing_payments WHERE id = ?", [id])) return false;
    const row = ensureRow(d, shopId, now);
    const paidUntil = extendPaidUntil(rowDates(row, now), input.months, now).toISOString();
    d.run("UPDATE shop_billing SET paid_until = ?, updated_at = ? WHERE shop_id = ?", [paidUntil, now.toISOString(), shopId]);
    d.run(
      `INSERT INTO billing_payments (id, shop_id, amount, method, paid_until, note, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, shopId, Math.round(input.amount), input.method, paidUntil, input.note?.trim() || null, now.toISOString(), input.createdBy],
    );
    return true;
  });
}

/** Prorroga la prueba `days` días, contados desde hoy si ya había terminado. */
export async function extendTrial(shopId: string, days: number, now: Date = new Date()): Promise<void> {
  const db = await ensureSeeded();
  if (!queryOne(db, "SELECT id FROM shops WHERE id = ?", [shopId])) throw new DomainError("La barbería no existe", 404);
  await mutate((d) => {
    const row = ensureRow(d, shopId, now);
    const from = Math.max(now.getTime(), Date.parse(row.trial_ends_at) || 0);
    d.run("UPDATE shop_billing SET trial_ends_at = ?, updated_at = ? WHERE shop_id = ?", [
      new Date(from + days * DAY_MS).toISOString(),
      now.toISOString(),
      shopId,
    ]);
  });
}

// ───────── Mercado Pago (cuenta de la plataforma) ─────────

async function platform<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.MP_PLATFORM_ACCESS_TOKEN?.trim();
  if (!token) throw new DomainError("El pago con Mercado Pago no está habilitado. Pagá por transferencia y escribinos.", 503);
  const res = await fetch(`${API}${path}`, {
    ...init,
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    await reportError("billing.mercadopago", new Error(`${path} → ${res.status}`), { detail: detail.slice(0, 300) });
    throw new DomainError("No pudimos conectarnos con Mercado Pago. Probá de nuevo.", 502);
  }
  return (await res.json()) as T;
}

interface Preapproval {
  id: string;
  status: string;
  external_reference?: string;
  init_point?: string;
}

/**
 * Crea la suscripción automática y devuelve el link de Mercado Pago donde el dueño la autoriza.
 *
 * El monto lo fija el servidor (planPrice). Si todavía le quedan días de prueba o de lo pago,
 * el primer débito se programa para cuando terminen: suscribirse antes no le cobra de más.
 */
export async function createSubscription(
  shopId: string,
  opts: { baseUrl: string; email?: string },
  now: Date = new Date(),
): Promise<{ initPoint: string }> {
  const db = await ensureSeeded();
  const shop = queryOne<{ name: string }>(db, "SELECT name FROM shops WHERE id = ?", [shopId]);
  if (!shop) throw new DomainError("La barbería no existe", 404);
  const row = billingRow(db, shopId);
  if (row?.mp_preapproval_id && subscriptionActive({ id: row.mp_preapproval_id, status: row.mp_preapproval_status ?? "" })) {
    throw new DomainError("Ya tenés la suscripción activa con Mercado Pago.", 409);
  }
  const email = opts.email?.trim().toLowerCase() || ownerContact(db, shopId)?.email;
  if (!email) throw new DomainError("Ingresá el email de tu cuenta de Mercado Pago", 422);

  const { price } = shopPrice(db, shopId);
  const end = coveredUntil(rowDates(row, now));
  const data = await platform<Preapproval>("/preapproval", {
    method: "POST",
    headers: { "X-Idempotency-Key": randomUUID() },
    body: JSON.stringify({
      reason: `BarberApp – ${shop.name}`.slice(0, 120),
      external_reference: shopId,
      payer_email: email,
      back_url: `${opts.baseUrl}/admin/suscripcion?mp=volvio`,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: price,
        currency_id: "ARS",
        ...(end.getTime() > now.getTime() ? { start_date: end.toISOString() } : {}),
      },
    }),
  });
  if (!data.init_point) {
    await reportError("billing.mercadopago", new Error("preapproval sin init_point"), { shopId, preapprovalId: data.id });
    throw new DomainError("No pudimos abrir Mercado Pago. Probá de nuevo.", 502);
  }
  await mutate((d) => {
    ensureRow(d, shopId, now);
    d.run("UPDATE shop_billing SET mp_preapproval_id = ?, mp_preapproval_status = ?, updated_at = ? WHERE shop_id = ?", [
      data.id,
      data.status ?? "pending",
      now.toISOString(),
      shopId,
    ]);
  });
  return { initPoint: data.init_point };
}

/** Cancela la suscripción automática. Lo ya pagado sigue valiendo hasta su fecha. */
export async function cancelSubscription(shopId: string, now: Date = new Date()): Promise<void> {
  const db = await ensureSeeded();
  const row = billingRow(db, shopId);
  if (!row?.mp_preapproval_id || row.mp_preapproval_status === "cancelled") {
    throw new DomainError("No tenés una suscripción automática para cancelar", 404);
  }
  const data = await platform<Preapproval>(`/preapproval/${encodeURIComponent(row.mp_preapproval_id)}`, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled" }),
  });
  await mutate((d) =>
    d.run("UPDATE shop_billing SET mp_preapproval_status = ?, updated_at = ? WHERE shop_id = ?", [
      data.status ?? "cancelled",
      now.toISOString(),
      shopId,
    ]),
  );
}

/** Barbería de una suscripción: la que la tiene guardada o, si no, la de su external_reference. */
async function shopForPreapproval(preapprovalId: string, externalReference?: string): Promise<string | null> {
  const db = await getDb();
  const stored = queryOne<{ shop_id: string }>(db, "SELECT shop_id FROM shop_billing WHERE mp_preapproval_id = ?", [preapprovalId]);
  if (stored) return stored.shop_id;
  if (externalReference && queryOne(db, "SELECT id FROM shops WHERE id = ?", [externalReference])) return externalReference;
  return null;
}

/**
 * Webhook `subscription_preapproval`: la suscripción cambió (autorizada, pausada, cancelada).
 * Se consulta su estado real; el cuerpo de la notificación no se cree.
 */
export async function handlePreapprovalEvent(preapprovalId: string, now: Date = new Date()): Promise<void> {
  if (!platformMercadopagoReady()) return;
  const data = await platform<Preapproval>(`/preapproval/${encodeURIComponent(preapprovalId)}`);
  const shopId = await shopForPreapproval(data.id, data.external_reference);
  if (!shopId) return;
  await mutate((d) => {
    const row = ensureRow(d, shopId, now);
    // Un link viejo que nunca se autorizó no pisa la suscripción vigente; una autorización
    // nueva sí reemplaza a la anterior.
    if (row.mp_preapproval_id && row.mp_preapproval_id !== data.id && data.status !== "authorized") return;
    d.run("UPDATE shop_billing SET mp_preapproval_id = ?, mp_preapproval_status = ?, updated_at = ? WHERE shop_id = ?", [
      data.id,
      data.status,
      now.toISOString(),
      shopId,
    ]);
  });
}

interface AuthorizedPayment {
  id: number | string;
  preapproval_id?: string;
  status?: string;
  transaction_amount?: number;
  payment?: { id?: number | string; status?: string };
}

/**
 * Webhook `subscription_authorized_payment`: un débito mensual. Si quedó aprobado, se extiende
 * un mes. El id del pago es la clave: Mercado Pago reintenta y cada cobro cuenta una sola vez.
 */
export async function handleAuthorizedPaymentEvent(paymentId: string, now: Date = new Date()): Promise<void> {
  if (!platformMercadopagoReady()) return;
  const data = await platform<AuthorizedPayment>(`/authorized_payments/${encodeURIComponent(paymentId)}`);
  if (data.payment?.status !== "approved" || !data.preapproval_id) return;

  let shopId = await shopForPreapproval(data.preapproval_id);
  if (!shopId) {
    const preapproval = await platform<Preapproval>(`/preapproval/${encodeURIComponent(data.preapproval_id)}`);
    shopId = await shopForPreapproval(preapproval.id, preapproval.external_reference);
  }
  if (!shopId) return;

  await recordPayment(
    shopId,
    {
      id: `mp:${data.id}`,
      months: 1,
      amount: Number(data.transaction_amount ?? 0),
      method: "mercadopago",
      createdBy: "mercadopago",
    },
    now,
  );
}

// ───────── Superadmin ─────────

/** Identificadores de SUPERADMIN_IDENTIFIERS, normalizados como los de las cuentas. */
function superadminList(env: Record<string, string | undefined> = process.env): Set<string> {
  return new Set(
    (env.SUPERADMIN_IDENTIFIERS ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .map(normalizeIdentifier),
  );
}

export function isSuperadmin(identifier: string | undefined, env: Record<string, string | undefined> = process.env): boolean {
  return !!identifier && superadminList(env).has(identifier);
}

export interface SuperadminShop {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  status: BillingStatus;
  exempt: boolean;
  trialEndsAt: string;
  paidUntil: string | null;
  price: number;
  subscription: string | null;
  owner: string | null;
  appointments30d: number;
  lastActivity: string | null;
}

export async function listShopsForSuperadmin(now: Date = new Date()): Promise<SuperadminShop[]> {
  const db = await ensureSeeded();
  const shops = queryAll<{ id: string; name: string; slug: string; created_at: string }>(
    db,
    "SELECT id, name, slug, created_at FROM shops ORDER BY created_at DESC",
  );
  const since = toISODate(new Date(now.getTime() - 30 * DAY_MS));
  const counts = new Map(
    queryAll<{ shop_id: string; n: number }>(
      db,
      "SELECT shop_id, COUNT(*) AS n FROM appointments WHERE date >= ? GROUP BY shop_id",
      [since],
    ).map((r) => [r.shop_id, r.n]),
  );
  const activity = new Map(
    queryAll<{ shop_id: string; last: string }>(db, "SELECT shop_id, MAX(updated_at) AS last FROM appointments GROUP BY shop_id").map(
      (r) => [r.shop_id, r.last],
    ),
  );
  return shops.map((s) => {
    const row = billingRow(db, s.id);
    const dates = rowDates(row, now);
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      createdAt: s.created_at,
      status: statusOf(s.id, dates, now),
      exempt: billingExempt(s.id),
      trialEndsAt: dates.trialEndsAt,
      paidUntil: dates.paidUntil,
      price: shopPrice(db, s.id).price,
      subscription: row?.mp_preapproval_status ?? null,
      owner: ownerContact(db, s.id)?.identifier ?? null,
      appointments30d: counts.get(s.id) ?? 0,
      lastActivity: activity.get(s.id) ?? null,
    };
  });
}

/** Precio actual de una barbería (para sugerir el monto de un pago a mano). */
export async function currentPrice(shopId: string): Promise<number> {
  return shopPrice(await ensureSeeded(), shopId).price;
}

// ───────── Avisos por mail ─────────

/** Qué aviso le corresponde hoy a la barbería, si alguno. */
function noticeFor(dates: BillingDates, row: BillingRow | undefined, now: Date): BillingNoticeKind | null {
  const status = billingStatus(dates, now);
  if (status === "suspended") return "suspended";
  if (status === "past_due") return "past_due";
  // Con la suscripción automática andando se le va a debitar solo: no hace falta asustarlo.
  const subscribed = row?.mp_preapproval_status === "authorized";
  if (status !== "trial" || subscribed) return null;
  const left = daysLeft(dates, now);
  if (left <= 1) return "trial_1d";
  if (left <= 7) return "trial_7d";
  return null;
}

/**
 * Manda los avisos de la suscripción que correspondan: 7 días y 1 día antes del fin de la
 * prueba, al vencer y al suspenderse. Cada uno sale una sola vez por vencimiento (queda marcado
 * en `billing_notices`). Sin SMTP no hace nada y no marca: cuando haya correo, sale el que toque.
 *
 * No arranca ningún temporizador: lo llama el worker periódico.
 */
export async function runBillingSweep(now: Date = new Date()): Promise<{ sent: number }> {
  if (!mailReady()) return { sent: 0 };
  const db = await ensureSeeded();
  const shops = queryAll<{ id: string; name: string }>(db, "SELECT id, name FROM shops");
  let sent = 0;
  for (const shop of shops) {
    if (billingExempt(shop.id)) continue;
    try {
      const row = billingRow(db, shop.id);
      if (!row) continue; // Recién la completa el backfill: arranca con 30 días, nada que avisar.
      const dates = rowDates(row, now);
      const kind = noticeFor(dates, row, now);
      if (!kind) continue;
      // El vencimiento al que se refiere el aviso: si después paga y vuelve a vencer, sale otro.
      const period = coveredUntil(dates).toISOString();
      if (queryOne(db, "SELECT 1 AS x FROM billing_notices WHERE shop_id = ? AND kind = ? AND period = ?", [shop.id, kind, period])) {
        continue;
      }
      const owner = ownerContact(db, shop.id);
      if (!owner?.email) continue;

      const date = kind === "past_due" ? suspendsAt(dates).toISOString() : period;
      const email = billingNoticeEmail(kind, { ownerName: owner.name, shopName: shop.name, price: shopPrice(db, shop.id).price, date });
      if (!(await sendMail({ to: owner.email, ...email }))) continue;
      await mutate((d) =>
        d.run("INSERT INTO billing_notices (shop_id, kind, period, sent_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING", [
          shop.id,
          kind,
          period,
          now.toISOString(),
        ]),
      );
      sent += 1;
    } catch (error) {
      // Una barbería con datos raros no puede frenar los avisos de las demás.
      await reportError("billing.sweep", error, { shopId: shop.id });
    }
  }
  return { sent };
}
