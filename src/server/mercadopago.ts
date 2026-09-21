import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { DomainError } from "@/lib/commands";
import type { Appointment, BusinessInfo } from "@/lib/types";
import { getSecret } from "./secrets";

const API = "https://api.mercadopago.com";

/** ¿Esta barbería puede cobrar online? */
export async function mercadopagoReady(shopId: string): Promise<boolean> {
  return !!(await getSecret("mp_access_token", shopId));
}

async function token(shopId: string): Promise<string> {
  const value = await getSecret("mp_access_token", shopId);
  if (!value) throw new DomainError("El cobro online no está configurado", 503);
  return value;
}

/**
 * La referencia externa lleva la barbería además del turno: el webhook llega sin sesión y
 * es lo único que le dice a qué local acreditarle el pago.
 */
export const externalReference = (shopId: string, appointmentId: string) => `${shopId}:${appointmentId}`;

export function parseExternalReference(value: string | undefined): { shopId: string; appointmentId: string } | null {
  const [shopId, appointmentId] = (value ?? "").split(":");
  return shopId && appointmentId ? { shopId, appointmentId } : null;
}

async function call<T>(shopId: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${await token(shopId)}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`Mercado Pago ${path} → ${res.status}`, detail.slice(0, 500));
    throw new DomainError("No pudimos conectarnos con Mercado Pago. Probá de nuevo.", 502);
  }
  return (await res.json()) as T;
}

export interface PreferenceResult {
  id: string;
  /** URL de Checkout Pro a la que se manda al cliente. */
  initPoint: string;
}

/**
 * Crea la preferencia de Checkout Pro por la seña del 50%.
 *
 * `external_reference` lleva el id del turno: es lo que el webhook usa para saber qué acreditar.
 * El monto lo fija el servidor a partir del precio del servicio; el navegador no lo elige.
 */
export async function createDepositPreference(
  shopId: string,
  appointment: Appointment,
  info: Pick<BusinessInfo, "name">,
  baseUrl: string,
): Promise<PreferenceResult> {
  const data = await call<{ id: string; init_point: string; sandbox_init_point?: string }>(shopId, "/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      external_reference: externalReference(shopId, appointment.id),
      statement_descriptor: info.name.slice(0, 22),
      items: [
        {
          id: appointment.id,
          title: `Seña 50% · ${appointment.serviceName}`,
          description: `${appointment.date} ${appointment.time} hs`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: appointment.deposit.amount,
        },
      ],
      payer: { name: appointment.clientName },
      back_urls: {
        success: `${baseUrl}/cliente/pago/exito?turno=${appointment.id}`,
        pending: `${baseUrl}/cliente/pago/pendiente?turno=${appointment.id}`,
        failure: `${baseUrl}/cliente/pago/error?turno=${appointment.id}`,
      },
      auto_return: "approved",
      // La barbería viaja en la URL: el webhook llega sin sesión y la necesita antes
      // de poder verificar la firma o consultar el pago.
      notification_url: `${baseUrl}/api/payments/webhook?shop=${encodeURIComponent(shopId)}`,
      // El turno se libera solo pasado el hold; no tiene sentido pagar después.
      expires: false,
      binary_mode: true,
    }),
  });
  return { id: data.id, initPoint: data.sandbox_init_point ?? data.init_point };
}

export interface PaymentInfo {
  id: string;
  status: string;
  /** Id del turno que se está pagando. */
  externalReference?: string;
  amount: number;
}

export async function getPayment(shopId: string, paymentId: string): Promise<PaymentInfo> {
  const data = await call<{
    id: number | string;
    status: string;
    external_reference?: string;
    transaction_amount?: number;
  }>(shopId, `/v1/payments/${encodeURIComponent(paymentId)}`);
  return {
    id: String(data.id),
    status: data.status,
    externalReference: data.external_reference,
    amount: data.transaction_amount ?? 0,
  };
}

/**
 * Valida la firma del webhook (`x-signature` + `x-request-id`).
 *
 * Sin `mp_webhook_secret` cargado no se puede verificar nada, así que se rechaza:
 * un webhook sin firma es exactamente el agujero que estamos cerrando.
 */
export async function verifyWebhookSignature(headers: Headers, dataId: string, shopId: string): Promise<boolean> {
  const secret = await getSecret("mp_webhook_secret", shopId);
  if (!secret) return false;

  const signature = headers.get("x-signature");
  const requestId = headers.get("x-request-id") ?? "";
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

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
