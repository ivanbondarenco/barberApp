import { createHash, createHmac } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeTime, SHOP } from "./support/fixtures";

/**
 * Mercado Pago por OAuth + API de Orders: conexión de la cuenta de cada barbería, creación de la
 * orden de la seña y el webhook que la acredita. La API de Mercado Pago se simula con `fetch`.
 */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ds-studio-mp-"));
const WEBHOOK_SECRET = "firma-de-la-app";

beforeAll(() => {
  process.env.DATABASE_PATH = path.join(dir, "test.db");
  process.env.SEED_DEMO = "1";
  process.env.MP_CLIENT_ID = "6048";
  process.env.MP_CLIENT_SECRET = "secreto-de-la-app";
  process.env.MP_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

afterAll(() => {
  delete (globalThis as { __dsDb?: unknown }).__dsDb;
  fs.rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  freezeTime();
});

type Handler = (url: string, init?: RequestInit) => unknown;

/** Reemplaza `fetch`: cada llamada pasa por `handler`, que devuelve el JSON (o un Response). */
function mockFetch(handler: Handler) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    const out = handler(url, init);
    return out instanceof Response ? out : Response.json(out);
  });
  return calls;
}

const tokenResponse = (overrides: Record<string, unknown> = {}) => ({
  access_token: "APP_USR-token-de-la-barberia",
  refresh_token: "TG-refresh",
  expires_in: 15_552_000,
  public_key: "APP_USR-public",
  user_id: 449636200,
  ...overrides,
});

function signedHeaders(dataId: string | undefined, requestId = "req-1", ts = "1700000000") {
  const manifest = (dataId ? `id:${dataId.toLowerCase()};` : "") + `request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", WEBHOOK_SECRET).update(manifest).digest("hex");
  return new Headers({ "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId, "content-type": "application/json" });
}

async function connectDemoShop() {
  const mp = await import("@/server/mercadopago");
  mockFetch(() => tokenResponse());
  await mp.connectAccount(SHOP, mp.oauthApp()!, { code: "TG-code", verifier: "v", redirectUri: "https://x/cb" });
  vi.restoreAllMocks();
  freezeTime();
  return mp;
}

async function pendingAppointment() {
  const { loadState } = await import("@/server/repository");
  const { state } = await loadState(SHOP);
  const appointment = state.appointments.find((a) => a.status === "confirmado" && a.deposit.status !== "abonada");
  // La demo trae un solo turno con seña pendiente: el test que la paga va último.
  if (!appointment) throw new Error("La demo no tiene turnos con seña pendiente");
  return appointment;
}

describe("firma del webhook", () => {
  it("acepta la firma de la aplicación, con el id en minúsculas", async () => {
    const { verifyWebhookSignature } = await import("@/server/mercadopago");
    expect(verifyWebhookSignature(signedHeaders("ORD01ABC"), "ORD01ABC")).toBe(true);
  });

  it("rechaza firmas de otra clave, sin firma o sin clave configurada", async () => {
    const { verifyWebhookSignature } = await import("@/server/mercadopago");
    const headers = signedHeaders("ORD01ABC");
    expect(verifyWebhookSignature(headers, "ORD01OTRA")).toBe(false);
    expect(verifyWebhookSignature(new Headers(), "ORD01ABC")).toBe(false);
    expect(verifyWebhookSignature(headers, "ORD01ABC", "")).toBe(false);
    expect(verifyWebhookSignature(headers, "ORD01ABC", "otra-clave")).toBe(false);
  });
});

describe("OAuth", () => {
  it("arma la autorización con PKCE S256", async () => {
    const { authorizationUrl, newAuthorization, oauthApp } = await import("@/server/mercadopago");
    const auth = newAuthorization();
    expect(auth.challenge).toBe(createHash("sha256").update(auth.verifier).digest("base64url"));

    const url = new URL(authorizationUrl(oauthApp()!, { state: auth.state, challenge: auth.challenge, redirectUri: "https://x/cb" }));
    expect(url.origin).toBe("https://auth.mercadopago.com.ar");
    expect(url.searchParams.get("client_id")).toBe("6048");
    expect(url.searchParams.get("code_challenge")).toBe(auth.challenge);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe(auth.state);
  });

  it("conectar guarda el token de la barbería y la deja lista para cobrar", async () => {
    const mp = await import("@/server/mercadopago");
    const calls = mockFetch(() => tokenResponse());
    await mp.connectAccount(SHOP, mp.oauthApp()!, { code: "TG-code", verifier: "el-verifier", redirectUri: "https://x/cb" });

    const sent = JSON.parse(String(calls[0].init?.body));
    expect(calls[0].url).toBe("https://api.mercadopago.com/oauth/token");
    expect(sent).toMatchObject({ grant_type: "authorization_code", code: "TG-code", code_verifier: "el-verifier", client_id: "6048" });

    const { getSecret } = await import("@/server/secrets");
    const { loadState } = await import("@/server/repository");
    expect(await getSecret("mp_access_token", SHOP)).toBe("APP_USR-token-de-la-barberia");
    expect((await loadState(SHOP)).state.integrations.mercadopagoReady).toBe(true);
    expect(await mp.shopsForUser("449636200")).toEqual([SHOP]);
  });

  it("si Mercado Pago rechaza el código, no conecta nada", async () => {
    const mp = await import("@/server/mercadopago");
    mockFetch(() => new Response("invalid_grant", { status: 400 }));
    await expect(
      mp.connectAccount("s-otra", mp.oauthApp()!, { code: "TG-viejo", verifier: "v", redirectUri: "https://x/cb" }),
    ).rejects.toThrow(/no aceptó/);
    expect(await mp.mercadopagoReady("s-otra")).toBe(false);
  });

  it("renueva el token cuando está por vencer", async () => {
    const mp = await connectDemoShop();
    const { setSecret, getSecret } = await import("@/server/secrets");
    await setSecret("mp_token_expires_at", new Date(Date.now() + 5 * 86_400_000).toISOString(), SHOP);

    const calls = mockFetch((url) =>
      url.endsWith("/oauth/token") ? tokenResponse({ access_token: "APP_USR-renovado" }) : { id: "ORDX", status: "created" },
    );
    await mp.getOrder(SHOP, "ORDX");

    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({ grant_type: "refresh_token", refresh_token: "TG-refresh" });
    expect(new Headers(calls[1].init?.headers).get("authorization")).toBe("Bearer APP_USR-renovado");
    expect(await getSecret("mp_access_token", SHOP)).toBe("APP_USR-renovado");
  });

  it("desconectar borra el token y la seña online deja de ofrecerse", async () => {
    const mp = await connectDemoShop();
    await mp.disconnectAccount(SHOP);
    const { loadState } = await import("@/server/repository");
    expect(await mp.mercadopagoReady(SHOP)).toBe(false);
    expect((await loadState(SHOP)).state.integrations.mercadopagoReady).toBe(false);
    expect(await mp.shopsForUser("449636200")).toEqual([]);
  });
});

describe("orden de la seña", () => {
  it("crea la orden con el token de la barbería y la registra para el webhook", async () => {
    const mp = await connectDemoShop();
    const appointment = await pendingAppointment();
    const calls = mockFetch(() => ({ id: "ORD01SENA", checkout_url: "https://www.mercadopago.com.ar/checkout/v1/redirect?order_id=ORD01SENA" }));

    const result = await mp.createDepositOrder(SHOP, appointment, { name: "DS Studio" }, "https://mibarberia.live");

    expect(result.initPoint).toContain("order_id=ORD01SENA");
    const headers = new Headers(calls[0].init?.headers);
    expect(calls[0].url).toBe("https://api.mercadopago.com/v1/orders");
    expect(headers.get("authorization")).toBe("Bearer APP_USR-token-de-la-barberia");
    expect(headers.get("x-idempotency-key")).toBeTruthy();
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body).toMatchObject({
      type: "online",
      processing_mode: "manual",
      total_amount: appointment.deposit.amount.toFixed(2),
      external_reference: appointment.id,
    });
    expect(body.items[0].unit_price).toBe(body.total_amount);
    expect(body.config.online.success_url).toBe(`https://mibarberia.live/cliente/pago/exito?turno=${appointment.id}`);
    expect(await mp.findOrder("ord01sena")).toEqual({ shopId: SHOP, appointmentId: appointment.id });
  });
});

describe("webhook", () => {
  async function post(body: unknown, headers: Headers, query: string) {
    const { POST } = await import("@/app/api/payments/webhook/route");
    return POST(new Request(`https://mibarberia.live/api/payments/webhook?${query}`, { method: "POST", headers, body: JSON.stringify(body) }));
  }

  async function depositStatus(id: string) {
    const { loadState } = await import("@/server/repository");
    return (await loadState(SHOP)).state.appointments.find((a) => a.id === id)!.deposit.status;
  }

  it("ignora notificaciones sin firma válida, de órdenes ajenas o sin cobrar", async () => {
    const mp = await connectDemoShop();
    const appointment = await pendingAppointment();
    mockFetch(() => ({ id: "ORD01PEND", checkout_url: "https://mp/redirect" }));
    await mp.createDepositOrder(SHOP, appointment, { name: "DS Studio" }, "https://mibarberia.live");

    const calls = mockFetch(() => ({ id: "ORD01PEND", status: "action_required", external_reference: appointment.id }));
    const order = (id: string) => ({ type: "order", data: { id } });

    // Sin firma: ni siquiera se consulta a Mercado Pago.
    await post(order("ORD01PEND"), new Headers({ "content-type": "application/json" }), "data.id=ORD01PEND&type=order");
    // Orden que no creó la app.
    await post(order("ORD01AJENA"), signedHeaders("ORD01AJENA"), "data.id=ORD01AJENA&type=order");
    expect(calls).toHaveLength(0);

    // Orden nuestra, pero todavía sin pagar.
    await post(order("ORD01PEND"), signedHeaders("ORD01PEND"), "data.id=ORD01PEND&type=order");
    expect(calls).toHaveLength(1);
    expect(await depositStatus(appointment.id)).not.toBe("abonada");
  });

  it("acredita la seña una sola vez cuando la orden queda cobrada", async () => {
    const mp = await connectDemoShop();
    const appointment = await pendingAppointment();
    const amount = appointment.deposit.amount.toFixed(2);
    mockFetch(() => ({ id: "ORD01PAGA", checkout_url: "https://mp/redirect" }));
    await mp.createDepositOrder(SHOP, appointment, { name: "DS Studio" }, "https://mibarberia.live");

    const calls = mockFetch(() => ({
      id: "ORD01PAGA",
      status: "processed",
      status_detail: "accredited",
      external_reference: appointment.id,
      total_amount: amount,
      total_paid_amount: amount,
    }));
    const notification = { type: "order", action: "order.processed", user_id: "449636200", data: { id: "ORD01PAGA" } };
    await post(notification, signedHeaders("ORD01PAGA"), "data.id=ORD01PAGA&type=order");
    await post(notification, signedHeaders("ORD01PAGA"), "data.id=ORD01PAGA&type=order");

    expect(calls[0].url).toBe("https://api.mercadopago.com/v1/orders/ORD01PAGA");
    expect(await depositStatus(appointment.id)).toBe("abonada");
    const { getDb, queryAll } = await import("@/server/db");
    expect(queryAll(await getDb(), "SELECT id FROM payment_events WHERE id = 'ORD01PAGA'")).toHaveLength(1);
  });

  it("si la cuenta desvincula la app desde Mercado Pago, la barbería queda desconectada", async () => {
    const mp = await connectDemoShop();
    await post({ type: "mp-connect", action: "application.deauthorized", user_id: 449636200 }, signedHeaders(undefined), "type=mp-connect");
    expect(await mp.mercadopagoReady(SHOP)).toBe(false);
  });
});
