import "server-only";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { DomainError } from "@/lib/commands";
import { arPhoneParts } from "@/lib/phone";
import type { Appointment, BusinessInfo } from "@/lib/types";
import { getDb, queryAll, queryOne } from "./db";
import { reportError } from "./monitor";
import { mutate } from "./repository";
import { getSecret, setSecret } from "./secrets";

/**
 * Mercado Pago, con una sola aplicación para toda la instalación (BarberPagos).
 *
 * Cada barbería conecta SU cuenta por OAuth: la app recibe un access token a nombre de esa
 * cuenta y con él crea las órdenes de las señas, así que la plata entra directo al local.
 * La aplicación solo aporta el client id/secret (para el OAuth) y la firma del webhook, que
 * por eso son variables de entorno y no credenciales de cada barbería.
 *
 * Los cobros usan la API de Orders con Checkout Pro: el cliente paga en la página de Mercado
 * Pago y vuelve a la app. Preferences quedó como legacy.
 */

const API = "https://api.mercadopago.com";
// Dominio de Argentina: el genérico (.com) le pide al dueño que elija país antes de autorizar.
const AUTH = "https://auth.mercadopago.com.ar/authorization";

/** Se renueva el token cuando le quedan menos de estos días (dura 180). */
const REFRESH_MARGIN_DAYS = 30;

export interface OAuthApp {
  clientId: string;
  clientSecret: string;
}

/** Credenciales de la aplicación de Mercado Pago, o null si la instalación no las tiene. */
export function oauthApp(): OAuthApp | null {
  const clientId = process.env.MP_CLIENT_ID?.trim();
  const clientSecret = process.env.MP_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export const oauthRedirectUri = (baseUrl: string) => `${baseUrl}/api/payments/oauth/callback`;

// ─── OAuth ────────────────────────────────────────────────────────────────────

const base64url = (buf: Buffer) => buf.toString("base64url");

/** `state` contra CSRF y el par PKCE (verifier queda en el servidor, challenge viaja a MP). */
export function newAuthorization(): {
  state: string;
  verifier: string;
  challenge: string;
} {
  const verifier = base64url(randomBytes(48));
  return {
    state: base64url(randomBytes(24)),
    verifier,
    challenge: base64url(createHash("sha256").update(verifier).digest()),
  };
}

export function authorizationUrl(app: OAuthApp, opts: { state: string; challenge: string; redirectUri: string }): string {
  const params = new URLSearchParams({
    client_id: app.clientId,
    response_type: "code",
    platform_id: "mp",
    state: opts.state,
    redirect_uri: opts.redirectUri,
    code_challenge: opts.challenge,
    code_challenge_method: "S256",
  });
  return `${AUTH}?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  public_key?: string;
  user_id: number | string;
}

class OAuthError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`oauth/token → ${status}`);
  }
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new OAuthError(res.status, (await res.text().catch(() => "")).slice(0, 300));
  const data = (await res.json()) as TokenResponse;
  if (!data.access_token || !data.user_id) throw new OAuthError(res.status, "respuesta sin access_token o user_id");
  return data;
}

async function saveTokens(shopId: string, data: TokenResponse): Promise<void> {
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 180 * 86_400) * 1000).toISOString();
  await setSecret("mp_access_token", data.access_token, shopId);
  if (data.refresh_token) await setSecret("mp_refresh_token", data.refresh_token, shopId);
  await setSecret("mp_token_expires_at", expiresAt, shopId);
  if (data.public_key) await setSecret("mp_public_key", data.public_key, shopId);
}

/** Canjea el código que devolvió Mercado Pago y deja la cuenta conectada a la barbería. */
export async function connectAccount(
  shopId: string,
  app: OAuthApp,
  opts: { code: string; verifier: string; redirectUri: string },
): Promise<void> {
  let data: TokenResponse;
  try {
    data = await tokenRequest({
      client_id: app.clientId,
      client_secret: app.clientSecret,
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: opts.redirectUri,
      code_verifier: opts.verifier,
      // Credenciales productivas (con "true" Mercado Pago devuelve credenciales de prueba).
      test_token: "false",
    });
  } catch (error) {
    await reportError("mercadopago.oauth", error, {
      shopId,
      detail: error instanceof OAuthError ? error.detail : undefined,
    });
    throw new DomainError("Mercado Pago no aceptó la conexión. Probá de nuevo.", 502);
  }
  await saveTokens(shopId, data);
  await mutate((db) =>
    db.run(
      `INSERT INTO mp_accounts (shop_id, user_id, linked_at) VALUES (?, ?, ?)
       ON CONFLICT(shop_id) DO UPDATE SET user_id = excluded.user_id, linked_at = excluded.linked_at`,
      [shopId, String(data.user_id), new Date().toISOString()],
    ),
  );
}

/** Borra la conexión de la barbería. Sus clientes vuelven a ver solo transferencia y efectivo. */
export async function disconnectAccount(shopId: string): Promise<void> {
  for (const key of ["mp_access_token", "mp_refresh_token", "mp_token_expires_at", "mp_public_key"] as const) {
    await setSecret(key, "", shopId);
  }
  await mutate((db) => db.run("DELETE FROM mp_accounts WHERE shop_id = ?", [shopId]));
}

/** Barberías conectadas a una cuenta de Mercado Pago (puede ser más de una sucursal). */
export async function shopsForUser(userId: string): Promise<string[]> {
  const db = await getDb();
  return queryAll<{ shop_id: string }>(db, "SELECT shop_id FROM mp_accounts WHERE user_id = ?", [userId]).map((r) => r.shop_id);
}

export interface ConnectionInfo {
  connected: boolean;
  /** Cuenta de Mercado Pago conectada (su user id). */
  userId?: string;
  linkedAt?: string;
  expiresAt?: string;
}

export async function connectionInfo(shopId: string): Promise<ConnectionInfo> {
  const db = await getDb();
  const link = queryOne<{ user_id: string; linked_at: string }>(
    db,
    "SELECT user_id, linked_at FROM mp_accounts WHERE shop_id = ?",
    [shopId],
  );
  const token = await getSecret("mp_access_token", shopId);
  return {
    connected: !!token,
    userId: link?.user_id,
    linkedAt: link?.linked_at,
    expiresAt: await getSecret("mp_token_expires_at", shopId),
  };
}

/** Renovaciones en curso, para no pedir dos a la vez el mismo token. */
const refreshing = new Map<string, Promise<string | undefined>>();

async function refreshToken(shopId: string): Promise<string | undefined> {
  const app = oauthApp();
  const refresh = await getSecret("mp_refresh_token", shopId);
  if (!app || !refresh) return undefined;
  try {
    const data = await tokenRequest({
      client_id: app.clientId,
      client_secret: app.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refresh,
    });
    await saveTokens(shopId, data);
    return data.access_token;
  } catch (error) {
    await reportError("mercadopago.refresh", error, {
      shopId,
      detail: error instanceof OAuthError ? error.detail : undefined,
      hint: "Si sigue fallando, la barbería tiene que volver a conectar Mercado Pago.",
    });
    return undefined;
  }
}

/**
 * Token de la barbería, renovado si está por vencer. Si la renovación falla se sigue usando el
 * actual mientras no haya vencido: un corte de Mercado Pago no tiene que dejar al local sin cobrar.
 */
async function token(shopId: string): Promise<string> {
  const current = await getSecret("mp_access_token", shopId);
  if (!current) throw new DomainError("El cobro online no está configurado", 503);

  const expiresAt = Date.parse((await getSecret("mp_token_expires_at", shopId)) ?? "");
  const dueSoon = Number.isFinite(expiresAt) && expiresAt - Date.now() < REFRESH_MARGIN_DAYS * 86_400_000;
  if (!dueSoon) return current;

  let pending = refreshing.get(shopId);
  if (!pending) {
    pending = refreshToken(shopId).finally(() => refreshing.delete(shopId));
    refreshing.set(shopId, pending);
  }
  const renewed = await pending;
  if (renewed) return renewed;
  if (expiresAt > Date.now()) return current;
  throw new DomainError("La conexión con Mercado Pago venció. El local tiene que volver a conectarla.", 503);
}

/** ¿Esta barbería puede cobrar online? */
export async function mercadopagoReady(shopId: string): Promise<boolean> {
  return !!(await getSecret("mp_access_token", shopId));
}

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Identificador de plataforma que asigna Mercado Pago a las integraciones con varias cuentas
 * (OAuth). Es obligatorio en ese modelo; mientras no lo tengamos, no se manda.
 */
export function platformId(): string | undefined {
  return process.env.MP_PLATFORM_ID?.trim() || undefined;
}

async function call<T>(shopId: string, path: string, init?: RequestInit): Promise<T> {
  const platform = platformId();
  const res = await fetch(`${API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${await token(shopId)}`,
      "Content-Type": "application/json",
      ...(platform ? { "X-Platform-Id": platform } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    await reportError("mercadopago.api", new Error(`${path} → ${res.status}`), {
      shopId,
      detail: detail.slice(0, 300),
    });
    if (res.status === 401)
      throw new DomainError("La conexión con Mercado Pago no es válida. El local tiene que volver a conectarla.", 502);
    throw new DomainError("No pudimos conectarnos con Mercado Pago. Probá de nuevo.", 502);
  }
  return (await res.json()) as T;
}

export interface CheckoutResult {
  /** Id de la orden de Mercado Pago. */
  id: string;
  /** URL de Checkout Pro a la que se manda al cliente. */
  initPoint: string;
}

export type CheckoutOutcome = "exito" | "pendiente" | "error";

/** Monto en el formato de la API de Orders: string con dos decimales. */
const money = (amount: number) => amount.toFixed(2);

/**
 * Quien paga la seña. Mercado Pago pide el email y usa el resto para su motor antifraude:
 * cuanto más sabe del comprador, más pagos aprueba.
 */
export interface DepositPayer {
  name: string;
  email?: string;
  phone?: string;
  /** Alta del cliente en la app (ISO). Solo clientes con cuenta. */
  registeredAt?: string;
  /** Fecha (ISO) de su última seña pagada, si tiene. */
  lastPurchaseAt?: string;
  /** Nunca pagó una seña online en este local. */
  firstPurchaseOnline?: boolean;
  /** Reservó con su cuenta (no como invitado). */
  authenticated?: boolean;
}

interface OrderPayer {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: { area_code: string; number: string };
}

/** Campo `payer` de la orden: el email solo si es válido, el nombre partido y el teléfono por partes. */
export function orderPayer(payer: DepositPayer | undefined): OrderPayer | undefined {
  if (!payer) return undefined;
  const out: OrderPayer = {};
  const email = payer.email?.trim();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) out.email = email;
  const [first, ...rest] = payer.name.trim().split(/\s+/).filter(Boolean);
  if (first) out.first_name = first.slice(0, 60);
  if (rest.length) out.last_name = rest.join(" ").slice(0, 60);
  const phone = payer.phone ? arPhoneParts(payer.phone) : null;
  if (phone) out.phone = { area_code: phone.areaCode, number: phone.number };
  return Object.keys(out).length ? out : undefined;
}

/**
 * `additional_info` de la orden: en la API de Orders son claves planas con punto
 * (`"payer.registration_date"`), no un objeto anidado.
 */
export function orderAdditionalInfo(payer: DepositPayer | undefined): Record<string, string | boolean> | undefined {
  if (!payer) return undefined;
  const out: Record<string, string | boolean> = {};
  if (payer.authenticated) out["payer.authentication_type"] = "WEB";
  // Fechas ISO 8601 con hora: un día suelto ("2026-11-10") pasa a medianoche de Argentina.
  const iso = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000-03:00` : value);
  if (payer.registeredAt) out["payer.registration_date"] = iso(payer.registeredAt);
  if (payer.lastPurchaseAt) out["payer.last_purchase"] = iso(payer.lastPurchaseAt);
  if (payer.firstPurchaseOnline !== undefined) out["payer.is_first_purchase_online"] = payer.firstPurchaseOnline;
  return Object.keys(out).length ? out : undefined;
}

/**
 * Crea la orden de Checkout Pro por la seña del turno.
 *
 * `external_reference` lleva el id del turno, y la orden queda registrada en `mp_orders` con su
 * barbería: es lo que el webhook usa para saber con qué cuenta consultarla y qué acreditar.
 * El monto lo fija el servidor a partir del turno; el navegador no lo elige.
 */
export async function createDepositOrder(
  shopId: string,
  appointment: Appointment,
  info: Pick<BusinessInfo, "name">,
  baseUrl: string,
  /** Pantalla a la que vuelve. Por defecto, la del cliente con cuenta; el invitado usa la suya. */
  backPath: (outcome: CheckoutOutcome) => string = (outcome) => `/cliente/pago/${outcome}?turno=${appointment.id}`,
  payer?: DepositPayer,
): Promise<CheckoutResult> {
  const amount = money(appointment.deposit.amount);
  const back = (outcome: CheckoutOutcome) => `${baseUrl}${backPath(outcome)}`;
  const title = `Seña · ${appointment.serviceName}`.slice(0, 120);

  const data = await call<{ id: string; checkout_url?: string }>(shopId, "/v1/orders", {
    method: "POST",
    // Cada intento es una orden nueva: si el cliente vuelve a tocar "Pagar", sale otro link.
    headers: { "X-Idempotency-Key": randomUUID() },
    body: JSON.stringify({
      type: "online",
      processing_mode: "manual",
      total_amount: amount,
      external_reference: appointment.id,
      description: title,
      payer: orderPayer(payer ?? { name: appointment.clientName, phone: appointment.clientPhone }),
      additional_info: orderAdditionalInfo(payer),
      items: [
        {
          external_code: appointment.serviceId,
          title,
          description: `${appointment.date} ${appointment.time} hs`,
          category_id: "services",
          quantity: 1,
          unit_price: amount,
        },
      ],
      config: {
        statement_descriptor: info.name.slice(0, 22),
        online: {
          success_url: back("exito"),
          pending_url: back("pendiente"),
          failure_url: back("error"),
          auto_return: "approved",
        },
      },
    }),
  });
  if (!data.checkout_url) {
    await reportError("mercadopago.api", new Error("orden sin checkout_url"), {
      shopId,
      orderId: data.id,
    });
    throw new DomainError("No pudimos abrir el pago. Probá de nuevo.", 502);
  }

  await mutate((db) =>
    db.run("INSERT OR REPLACE INTO mp_orders (order_id, shop_id, appointment_id, created_at) VALUES (?, ?, ?, ?)", [
      data.id,
      shopId,
      appointment.id,
      new Date().toISOString(),
    ]),
  );
  // El link anterior de este turno, si nadie lo pagó, ya no sirve: se cancela en Mercado Pago.
  await cancelOpenOrders(shopId, appointment.id, data.id);
  return { id: data.id, initPoint: data.checkout_url };
}

/** Órdenes que la app creó para un turno, de la más nueva a la más vieja. */
export async function ordersForAppointment(shopId: string, appointmentId: string): Promise<string[]> {
  const db = await getDb();
  return queryAll<{ order_id: string }>(
    db,
    "SELECT order_id FROM mp_orders WHERE shop_id = ? AND appointment_id = ? ORDER BY created_at DESC",
    [shopId, appointmentId],
  ).map((r) => r.order_id);
}

/**
 * Cancela una orden por la API, solo si sigue en `created` (nadie empezó a pagarla): es lo que
 * pide Mercado Pago antes de cancelar. Devuelve si la canceló.
 */
export async function cancelOrder(shopId: string, orderId: string): Promise<boolean> {
  const order = await getOrder(shopId, orderId);
  if (order.status !== "created") return false;
  await call(shopId, `/v1/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    headers: { "X-Idempotency-Key": randomUUID() },
  });
  return true;
}

/** Cancela las órdenes sin pagar de un turno, salvo `keep`. Es prolijidad: si falla, no frena el cobro. */
export async function cancelOpenOrders(shopId: string, appointmentId: string, keep?: string): Promise<void> {
  for (const orderId of await ordersForAppointment(shopId, appointmentId)) {
    if (orderId === keep) continue;
    try {
      await cancelOrder(shopId, orderId);
    } catch {
      // Ya quedó en el log desde `call`.
    }
  }
}

/** Barbería y turno de una orden creada por la app, o null si no es nuestra. */
export async function findOrder(orderId: string): Promise<{ shopId: string; appointmentId: string } | null> {
  const db = await getDb();
  const row = queryOne<{ shop_id: string; appointment_id: string }>(
    db,
    "SELECT shop_id, appointment_id FROM mp_orders WHERE order_id = ? COLLATE NOCASE",
    [orderId],
  );
  return row ? { shopId: row.shop_id, appointmentId: row.appointment_id } : null;
}

export interface OrderInfo {
  id: string;
  status: string;
  statusDetail?: string;
  /** Id del turno que se está pagando. */
  externalReference?: string;
  totalAmount: number;
  paidAmount: number;
}

export async function getOrder(shopId: string, orderId: string): Promise<OrderInfo> {
  const data = await call<{
    id: string;
    status: string;
    status_detail?: string;
    external_reference?: string;
    total_amount?: string;
    total_paid_amount?: string;
  }>(shopId, `/v1/orders/${encodeURIComponent(orderId)}`);
  return {
    id: data.id,
    status: data.status,
    statusDetail: data.status_detail,
    externalReference: data.external_reference,
    totalAmount: Number(data.total_amount ?? 0),
    paidAmount: Number(data.total_paid_amount ?? 0),
  };
}

/** La orden está cobrada: procesada, acreditada y por el total. */
export const isOrderPaid = (order: OrderInfo) =>
  order.status === "processed" && order.statusDetail === "accredited" && order.paidAmount >= order.totalAmount;

// ─── Webhook ──────────────────────────────────────────────────────────────────

/**
 * Valida la firma del webhook (`x-signature` + `x-request-id`) con la clave de la aplicación.
 *
 * Sin `MP_WEBHOOK_SECRET` no se puede verificar nada, así que se rechaza: un webhook sin firma
 * es exactamente el agujero que estamos cerrando. Según Mercado Pago, el `data.id` va en
 * minúsculas y lo que no venga en la notificación se saca del manifiesto.
 */
export function verifyWebhookSignature(
  headers: Headers,
  dataId: string | undefined,
  secret = process.env.MP_WEBHOOK_SECRET?.trim(),
): boolean {
  if (!secret) return false;

  const signature = headers.get("x-signature");
  if (!signature) return false;
  const parts = Object.fromEntries(
    signature.split(",").map((p) => {
      const [k, ...rest] = p.split("=");
      return [k.trim(), rest.join("=").trim()];
    }),
  );
  const ts = parts.ts;
  const received = parts.v1;
  if (!ts || !received) return false;

  const requestId = headers.get("x-request-id");
  const manifest = (dataId ? `id:${dataId.toLowerCase()};` : "") + (requestId ? `request-id:${requestId};` : "") + `ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
