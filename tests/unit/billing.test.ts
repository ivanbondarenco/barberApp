import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addMonths,
  billingStatus,
  daysLeft,
  extendPaidUntil,
  needsAttention,
  nextRenewal,
  planMinPrice,
  planPrice,
  planReferenceService,
} from "@/lib/billing";
import { freezeTime, MONDAY_9AM, SHOP } from "./support/fixtures";

/**
 * Suscripción de las barberías a BarberApp: reglas puras (estado, días, precio) y lo que hace el
 * servidor con ellas (prueba al crear el local, corte al suspenderse, pagos, webhook y avisos).
 */

const DAY = 86_400_000;
const at = (days: number) => new Date(MONDAY_9AM.getTime() + days * DAY).toISOString();

describe("estado de la suscripción", () => {
  const now = MONDAY_9AM;

  it("pasa de prueba a vencida (7 días de gracia) y después a suspendida", () => {
    const dates = { trialEndsAt: at(10), paidUntil: null };
    expect(billingStatus(dates, now)).toBe("trial");
    expect(billingStatus(dates, new Date(at(10)))).toBe("past_due");
    expect(billingStatus(dates, new Date(at(16.9)))).toBe("past_due");
    expect(billingStatus(dates, new Date(at(17)))).toBe("suspended");
  });

  it("con la cuota paga está al día, y la gracia corre desde lo pago", () => {
    const dates = { trialEndsAt: at(-40), paidUntil: at(5) };
    expect(billingStatus(dates, now)).toBe("active");
    expect(billingStatus(dates, new Date(at(6)))).toBe("past_due");
    expect(billingStatus(dates, new Date(at(12)))).toBe("suspended");
  });

  it("durante la prueba informa prueba aunque ya haya pagado por adelantado", () => {
    expect(billingStatus({ trialEndsAt: at(3), paidUntil: at(33) }, now)).toBe("trial");
  });

  it("cuenta los días restantes redondeando para arriba", () => {
    expect(daysLeft({ trialEndsAt: at(7), paidUntil: null }, now)).toBe(7);
    expect(daysLeft({ trialEndsAt: at(0.1), paidUntil: null }, now)).toBe(1);
    expect(daysLeft({ trialEndsAt: at(-3), paidUntil: null }, now)).toBe(-3);
    expect(daysLeft({ trialEndsAt: at(2), paidUntil: at(20) }, now)).toBe(20);
  });

  it("avisa con 7 días o menos de prueba, vencida o suspendida", () => {
    expect(needsAttention({ trialEndsAt: at(8), paidUntil: null }, now)).toBe(false);
    expect(needsAttention({ trialEndsAt: at(7), paidUntil: null }, now)).toBe(true);
    expect(needsAttention({ trialEndsAt: at(-1), paidUntil: null }, now)).toBe(true);
    expect(needsAttention({ trialEndsAt: at(-40), paidUntil: at(3) }, now)).toBe(false);
  });

  it("suma meses sin desbordar el fin de mes", () => {
    expect(addMonths(new Date("2026-01-31T12:00:00Z"), 1).toISOString()).toBe("2026-02-28T12:00:00.000Z");
    expect(addMonths(new Date("2028-01-31T12:00:00Z"), 1).toISOString()).toBe("2028-02-29T12:00:00.000Z");
    expect(addMonths(new Date("2026-11-15T12:00:00Z"), 3).toISOString()).toBe("2027-02-15T12:00:00.000Z");
  });

  it("extiende desde lo más tarde entre hoy, lo pago y el fin de la prueba", () => {
    // Paga durante la prueba: no pierde días de prueba.
    expect(extendPaidUntil({ trialEndsAt: at(10), paidUntil: null }, 1, now).toISOString()).toBe(addMonths(new Date(at(10)), 1).toISOString());
    // Paga por adelantado: se suma a lo que ya tenía.
    expect(extendPaidUntil({ trialEndsAt: at(-40), paidUntil: at(5) }, 2, now).toISOString()).toBe(addMonths(new Date(at(5)), 2).toISOString());
    // Paga vencida: arranca hoy, los días suspendidos no se cobran.
    expect(extendPaidUntil({ trialEndsAt: at(-40), paidUntil: at(-20) }, 1, now).toISOString()).toBe(addMonths(now, 1).toISOString());
  });

  it("el próximo cobro es cuando termina lo cubierto, o ya si venció", () => {
    expect(nextRenewal({ trialEndsAt: at(4), paidUntil: null }, now).toISOString()).toBe(at(4));
    expect(nextRenewal({ trialEndsAt: at(-4), paidUntil: null }, now).toISOString()).toBe(now.toISOString());
  });
});

describe("precio del plan", () => {
  const svc = (price: number, category: "corte" | "barba" | "combo" | "tratamiento", active = true) => ({ price, category, active });

  it("vale 2 cortes, tomando el corte activo más barato", () => {
    expect(planPrice([svc(12000, "corte"), svc(9000, "corte"), svc(4000, "barba")])).toBe(18000);
  });

  it("ignora los servicios inactivos", () => {
    expect(planPrice([svc(6000, "corte", false), svc(15000, "corte")])).toBe(30000);
  });

  it("sin cortes, usa el servicio activo más barato", () => {
    expect(planPrice([svc(8000, "combo"), svc(7000, "barba")])).toBe(14000);
    expect(planReferenceService([svc(8000, "combo"), svc(7000, "barba")])?.price).toBe(7000);
  });

  it("nunca baja del piso, tampoco sin servicios", () => {
    expect(planPrice([svc(3000, "corte")])).toBe(10000);
    expect(planPrice([])).toBe(10000);
    expect(planPrice([svc(3000, "corte")], 5000)).toBe(6000);
  });

  it("el piso sale de PLAN_MIN_PRICE, con 10.000 si falta o no es válido", () => {
    expect(planMinPrice({ PLAN_MIN_PRICE: "15000" })).toBe(15000);
    expect(planMinPrice({})).toBe(10000);
    expect(planMinPrice({ PLAN_MIN_PRICE: "nada" })).toBe(10000);
  });
});

// ───────── Servidor ─────────

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ds-studio-billing-"));

async function loadServer() {
  vi.resetModules();
  delete (globalThis as { __dsDb?: unknown }).__dsDb;
  return {
    ...(await import("@/server/repository")),
    ...(await import("@/server/db")),
    ...(await import("@/server/billing")),
  };
}

type Handler = (url: string, init?: RequestInit) => unknown;
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

let shopCount = 0;
async function newShop(ownerIdentifier?: string) {
  const { createShop, executeCommand } = await loadServer();
  shopCount += 1;
  const { shop } = await createShop({
    name: `Barbería Cobro ${shopCount}`,
    ownerName: "Dueño Prueba",
    ownerIdentifier: ownerIdentifier ?? `dueno${shopCount}@example.com`,
    ownerPassword: "clave-segura",
    address: "Calle 123",
    whatsapp: "+54 9 11 5555-0000",
  });
  await executeCommand({ role: "admin", shopId: shop.id }, {
    type: "service.upsert",
    service: { id: "s-corte", name: "Corte clásico", description: "", price: 9000, durationMin: 30, category: "corte", active: true },
  });
  return shop;
}

/** Lleva la barbería a una fecha de fin de prueba (y de pago) dada. */
async function setDates(shopId: string, trialEndsAt: string, paidUntil: string | null = null) {
  const { mutate } = await loadServer();
  await mutate((db) =>
    db.run("UPDATE shop_billing SET trial_ends_at = ?, paid_until = ? WHERE shop_id = ?", [trialEndsAt, paidUntil, shopId]),
  );
}

beforeAll(() => {
  process.env.DATABASE_PATH = path.join(dir, "test.db");
  process.env.SEED_DEMO = "1";
  process.env.MP_PLATFORM_ACCESS_TOKEN = "APP_USR-plataforma";
  delete process.env.E2E_TEST_MODE;
  delete process.env.PLAN_MIN_PRICE;
});

afterAll(() => {
  delete (globalThis as { __dsDb?: unknown }).__dsDb;
  fs.rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  freezeTime();
});

describe("suscripción en el servidor", () => {
  it("una barbería nueva arranca con 30 días de prueba", async () => {
    const shop = await newShop();
    const { getBillingInfo } = await loadServer();
    const info = await getBillingInfo(shop.id);
    expect(info.status).toBe("trial");
    expect(info.daysLeft).toBe(30);
    expect(info.price).toBe(18000);
    expect(info.reference).toEqual({ name: "Corte clásico", price: 9000 });
    expect(info.ownerEmail).toMatch(/@example\.com$/);
  });

  it("las barberías que ya existían reciben 30 días de prueba al migrar", async () => {
    const { getDb, queryOne, mutate } = await loadServer();
    await getDb();
    await mutate((db) => {
      db.run("INSERT INTO shops (id, slug, name, created_at) VALUES ('s-vieja', 'vieja', 'Vieja', '2024-01-01T00:00:00.000Z')");
      db.run("DELETE FROM shop_billing WHERE shop_id = 's-vieja'");
    });
    // Nuevo "proceso": al abrir la base se completa la fila que falta.
    const reopened = await loadServer();
    const row = queryOne<{ trial_ends_at: string }>(await reopened.getDb(), "SELECT trial_ends_at FROM shop_billing WHERE shop_id = 's-vieja'");
    expect(row?.trial_ends_at).toBe(at(30));
  });

  it("suspendida: el staff no opera, los clientes no reservan y el sistema sí acredita", async () => {
    const shop = await newShop();
    await setDates(shop.id, at(-8));
    const { executeCommand, loadState } = await loadServer();

    await expect(
      executeCommand({ role: "admin", shopId: shop.id }, { type: "settings.info", patch: { instagram: "@x" } }),
    ).rejects.toMatchObject({ status: 402, message: expect.stringContaining("suspendida") });
    await expect(
      executeCommand({ role: "barbero", shopId: shop.id, barberId: "b-1" }, { type: "block.delete", id: "nada" }),
    ).rejects.toMatchObject({ status: 402 });
    await expect(
      executeCommand(
        { role: "invitado", shopId: shop.id },
        {
          type: "appointment.book",
          payload: {
            id: "a-x", newClientId: "c-x", clientName: "Ana", clientPhone: "+54 9 11 5555-1111", barberId: "b-1",
            serviceId: "s-corte", date: "2026-09-16", time: "10:00", depositMethod: "efectivo",
          },
        },
      ),
    ).rejects.toThrow("no está tomando reservas online");

    // El sistema pasa el control de suscripción (lo que lo frena es que el turno no existe).
    await expect(
      executeCommand({ role: "sistema", shopId: shop.id }, { type: "appointment.deposit", id: "nada", method: "mercadopago" }),
    ).rejects.not.toMatchObject({ status: 402 });

    // Los datos siguen ahí.
    const { state } = await loadState(shop.id);
    expect(state.services.map((s) => s.id)).toContain("s-corte");
  });

  it("vencida con gracia sigue operando", async () => {
    const shop = await newShop();
    await setDates(shop.id, at(-3));
    const { executeCommand, getBillingStatus } = await loadServer();
    expect((await getBillingStatus(shop.id)).status).toBe("past_due");
    await expect(
      executeCommand({ role: "admin", shopId: shop.id }, { type: "settings.info", patch: { instagram: "@ok" } }),
    ).resolves.toBeTruthy();
  });

  it("la barbería de demostración nunca se suspende", async () => {
    const { executeCommand, mutate, getBillingStatus, getDb } = await loadServer();
    await getDb();
    await mutate((db) =>
      db.run(
        `INSERT INTO shop_billing (shop_id, trial_ends_at, updated_at) VALUES (?, '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z')
         ON CONFLICT(shop_id) DO UPDATE SET trial_ends_at = excluded.trial_ends_at, paid_until = NULL`,
        [SHOP],
      ),
    );
    expect((await getBillingStatus(SHOP)).status).toBe("active");
    await expect(
      executeCommand({ role: "admin", shopId: SHOP }, { type: "settings.info", patch: { instagram: "@demo" } }),
    ).resolves.toBeTruthy();
  });

  it("los tests E2E nunca suspenden", async () => {
    const { billingExempt } = await import("@/server/billing-access");
    expect(billingExempt("s-cualquiera", { NODE_ENV: "production", E2E_TEST_MODE: "1", APP_URL: "http://localhost:3210" })).toBe(true);
    expect(billingExempt("s-cualquiera", { NODE_ENV: "production", E2E_TEST_MODE: "1", APP_URL: "https://turnos.com" })).toBe(false);
    expect(billingExempt("s-cualquiera", { NODE_ENV: "production" })).toBe(false);
  });

  it("un pago a mano reactiva una barbería suspendida desde hoy", async () => {
    const shop = await newShop();
    await setDates(shop.id, at(-20));
    const { recordPayment, getBillingInfo } = await loadServer();
    await recordPayment(shop.id, { months: 2, amount: 36000, method: "transferencia", createdBy: "admin@barberapp.com" });
    const info = await getBillingInfo(shop.id);
    expect(info.status).toBe("active");
    expect(info.paidUntil).toBe(addMonths(MONDAY_9AM, 2).toISOString());
    expect(info.payments).toMatchObject([{ amount: 36000, method: "transferencia" }]);
  });

  it("prorrogar la prueba suma desde el final, o desde hoy si ya terminó", async () => {
    const shop = await newShop();
    const { extendTrial, getBillingInfo } = await loadServer();
    await extendTrial(shop.id, 10);
    expect((await getBillingInfo(shop.id)).trialEndsAt).toBe(at(40));
    await setDates(shop.id, at(-30));
    await extendTrial(shop.id, 5);
    expect((await getBillingInfo(shop.id)).trialEndsAt).toBe(at(5));
  });

  it("crea la suscripción con la cuenta de la plataforma y el primer cobro al terminar la prueba", async () => {
    const shop = await newShop();
    const calls = mockFetch(() => ({ id: "pre-1", status: "pending", init_point: "https://mp.test/subs/pre-1" }));
    const { createSubscription, getBillingInfo } = await loadServer();
    const { initPoint } = await createSubscription(shop.id, { baseUrl: "https://app.test" });
    expect(initPoint).toBe("https://mp.test/subs/pre-1");

    const [call] = calls;
    expect(call.url).toBe("https://api.mercadopago.com/preapproval");
    expect((call.init?.headers as Record<string, string>).Authorization).toBe("Bearer APP_USR-plataforma");
    const body = JSON.parse(String(call.init?.body));
    expect(body).toMatchObject({
      reason: `BarberApp – ${shop.name}`,
      external_reference: shop.id,
      back_url: "https://app.test/admin/suscripcion?mp=volvio",
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 18000, currency_id: "ARS", start_date: at(30) },
    });
    expect(body.payer_email).toMatch(/@example\.com$/);
    expect((await getBillingInfo(shop.id)).subscription).toEqual({ id: "pre-1", status: "pending" });
  });

  it("si el dueño entró con el celular, pide el email para Mercado Pago", async () => {
    const shop = await newShop("+54 9 11 4444-0101");
    mockFetch(() => ({ id: "pre-x", status: "pending", init_point: "https://mp.test/x" }));
    const { createSubscription } = await loadServer();
    await expect(createSubscription(shop.id, { baseUrl: "https://app.test" })).rejects.toMatchObject({ status: 422 });
    await expect(createSubscription(shop.id, { baseUrl: "https://app.test", email: "dueno@cel.com" })).resolves.toBeTruthy();
  });

  it("sin MP_PLATFORM_ACCESS_TOKEN avisa que se pague por transferencia", async () => {
    const shop = await newShop();
    const saved = process.env.MP_PLATFORM_ACCESS_TOKEN;
    delete process.env.MP_PLATFORM_ACCESS_TOKEN;
    try {
      const { createSubscription, getBillingInfo } = await loadServer();
      expect((await getBillingInfo(shop.id)).mercadopagoAvailable).toBe(false);
      await expect(createSubscription(shop.id, { baseUrl: "https://app.test" })).rejects.toThrow("transferencia");
    } finally {
      process.env.MP_PLATFORM_ACCESS_TOKEN = saved;
    }
  });

  it("el webhook guarda el estado de la suscripción y cada débito aprobado suma un mes, una sola vez", async () => {
    const shop = await newShop();
    await setDates(shop.id, at(-2));
    mockFetch((url) => {
      if (url.endsWith("/preapproval")) return { id: "pre-ok", status: "pending", init_point: "https://mp.test/ok" };
      if (url.includes("/preapproval/pre-ok")) return { id: "pre-ok", status: "authorized", external_reference: shop.id };
      if (url.includes("/authorized_payments/777"))
        return { id: 777, preapproval_id: "pre-ok", transaction_amount: 18000, payment: { id: 1, status: "approved" } };
      if (url.includes("/authorized_payments/778"))
        return { id: 778, preapproval_id: "pre-ok", transaction_amount: 18000, payment: { id: 2, status: "rejected" } };
      return new Response("not found", { status: 404 });
    });
    const server = await loadServer();
    await server.createSubscription(shop.id, { baseUrl: "https://app.test" });
    await server.handlePreapprovalEvent("pre-ok");
    expect((await server.getBillingInfo(shop.id)).subscription?.status).toBe("authorized");

    await server.handleAuthorizedPaymentEvent("777");
    await server.handleAuthorizedPaymentEvent("777"); // Mercado Pago reintenta.
    await server.handleAuthorizedPaymentEvent("778"); // Rechazado: no suma.
    const info = await server.getBillingInfo(shop.id);
    expect(info.status).toBe("active");
    expect(info.paidUntil).toBe(addMonths(MONDAY_9AM, 1).toISOString());
    expect(info.payments).toHaveLength(1);
    expect(info.payments[0]).toMatchObject({ id: "mp:777", method: "mercadopago", amount: 18000 });
  });

  it("un link viejo sin autorizar no pisa la suscripción vigente", async () => {
    const shop = await newShop();
    const { mutate, handlePreapprovalEvent, getBillingInfo } = await loadServer();
    await mutate((db) =>
      db.run("UPDATE shop_billing SET mp_preapproval_id = 'pre-nueva', mp_preapproval_status = 'authorized' WHERE shop_id = ?", [shop.id]),
    );
    mockFetch(() => ({ id: "pre-vieja", status: "cancelled", external_reference: shop.id }));
    await handlePreapprovalEvent("pre-vieja");
    expect((await getBillingInfo(shop.id)).subscription).toEqual({ id: "pre-nueva", status: "authorized" });
  });

  it("superadmin: solo los identificadores de SUPERADMIN_IDENTIFIERS, normalizados", async () => {
    const { isSuperadmin } = await loadServer();
    const env = { SUPERADMIN_IDENTIFIERS: " Yo@BarberApp.com , +54 9 11 3096-9716" };
    expect(isSuperadmin("yo@barberapp.com", env)).toBe(true);
    expect(isSuperadmin("tel:1130969716", env)).toBe(true);
    expect(isSuperadmin("otro@barberapp.com", env)).toBe(false);
    expect(isSuperadmin("yo@barberapp.com", {})).toBe(false);
  });

  it("el listado del superadmin trae estado, precio y actividad de cada barbería", async () => {
    const shop = await newShop();
    const { listShopsForSuperadmin } = await loadServer();
    const row = (await listShopsForSuperadmin()).find((s) => s.id === shop.id);
    expect(row).toMatchObject({ status: "trial", price: 18000, appointments30d: 0, exempt: false });
    expect(row?.owner).toMatch(/@example\.com$/);
  });

  it("los avisos por mail salen una vez por vencimiento, y nada sin SMTP", async () => {
    const shop = await newShop();
    await setDates(shop.id, at(5));

    // SMTP simulado: se cambia mailReady y se juntan los mails en vez de mandarlos.
    let ready = false;
    const sent: string[] = [];
    vi.resetModules();
    delete (globalThis as { __dsDb?: unknown }).__dsDb;
    vi.doMock("@/server/mail", () => ({
      appUrl: () => "https://app.test",
      mailReady: () => ready,
      sendMail: async (m: { to: string; subject: string }) => {
        sent.push(`${m.to}|${m.subject}`);
        return true;
      },
    }));
    try {
      const billing = await import("@/server/billing");
      expect(await billing.runBillingSweep()).toEqual({ sent: 0 });

      ready = true;
      await billing.runBillingSweep();
      await billing.runBillingSweep();
      const mine = () => sent.filter((s) => s.includes(shop.name));
      expect(mine()).toHaveLength(1);
      expect(mine()[0]).toContain("7 días");

      // Al día siguiente del fin de la prueba: vencida, otro aviso (una vez).
      freezeTime(new Date(at(6)));
      await billing.runBillingSweep();
      await billing.runBillingSweep();
      expect(mine()).toHaveLength(2);
      expect(mine()[1]).toContain("vencida");
    } finally {
      vi.doUnmock("@/server/mail");
    }
  });
});
