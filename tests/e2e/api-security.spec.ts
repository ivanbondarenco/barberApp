import { expect, request as playwrightRequest, test } from "@playwright/test";
import { adminApi, CLIENT, resetData, runCommand } from "./helpers";

const BASE_URL = "http://localhost:3210";

test.beforeAll(resetData);

async function clientApi() {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const res = await api.post("/api/auth/login", { data: { role: "cliente", identifier: CLIENT.email, password: CLIENT.password } });
  expect(res.ok()).toBeTruthy();
  return api;
}

test("sin sesión: datos públicos y comandos rechazados", async ({ request }) => {
  const res = await request.get("/api/state");
  const body = await res.json();
  expect(res.headers()["cache-control"]).toContain("no-store");
  expect(body.session).toBeNull();
  expect(body.state.clients).toEqual([]);
  expect(body.state.appointments).toEqual([]);

  const cmd = await request.post("/api/commands", { data: { command: { type: "demo.reset" } } });
  expect(cmd.status()).toBe(401);
});

test("cliente: no ve datos personales de otros ni puede usar acciones del staff", async () => {
  const api = await clientApi();
  const { state } = await (await api.get("/api/state")).json();
  expect(state.clients).toHaveLength(1);
  const others = state.appointments.filter((a: { clientId?: string }) => a.clientId !== "c-demo");
  expect(others.length).toBeGreaterThan(0);
  expect(others.every((a: { clientName: string; clientPhone: string }) => a.clientName === "" && a.clientPhone === "")).toBe(true);

  for (const command of [
    { type: "service.delete", id: "s-tijera" },
    { type: "client.delete", id: "c-mateo" },
    { type: "appointment.charge", id: "a-demo-client", method: "efectivo" },
    { type: "demo.reset" },
  ]) {
    const { status, body } = await runCommand(api, command);
    expect(status).toBe(403);
    expect(body.error).toMatch(/staff/);
  }

  const foreign = await runCommand(api, { type: "appointment.cancel", id: "a-mateo" });
  expect(foreign.status).toBe(403);
  await api.dispose();
});

test("el cliente no puede auto-asignarse crédito ni notas internas", async () => {
  const api = await clientApi();
  const { state } = await (await api.get("/api/state")).json();
  const me = state.clients[0];
  const { status, body } = await runCommand(api, { type: "client.upsert", client: { ...me, credit: 999999, internalNotes: "VIP" } });
  expect(status).toBe(200);
  expect(body.state.clients[0].credit).toBe(me.credit);
  expect(body.state.clients[0].internalNotes).toBeUndefined();
  await api.dispose();
});

test("valida entradas y reglas en el servidor", async ({ request }) => {
  const badJson = await request.post("/api/commands", { headers: { "content-type": "application/json" }, data: "{" });
  expect([400, 401]).toContain(badJson.status());

  const admin = await adminApi();
  const invalid = await admin.post("/api/commands", { data: { nope: true } });
  expect(invalid.status()).toBe(422);

  const unknownAppointment = await runCommand(admin, { type: "appointment.cancel", id: "no-existe" });
  expect(unknownAppointment.status).toBe(404);

  const clash = await runCommand(admin, {
    type: "appointment.book",
    payload: {
      id: "a-clash",
      newClientId: "c-clash",
      clientName: "Choque",
      clientPhone: "+54 9 11 3333 4444",
      barberId: "b-diego",
      serviceId: "s-signature",
      date: "2099-01-01",
      time: "03:00",
      depositMethod: "efectivo",
      depositPaid: false,
    },
  });
  expect(clash.status).toBe(409);

  const noPassword = await request.post("/api/auth/login", { data: { role: "staff", identifier: "x@y.z", password: "" } });
  expect(noPassword.status()).toBe(422);
  await admin.dispose();
});

test("una sesión cerrada ya no sirve", async () => {
  const api = await clientApi();
  expect((await (await api.get("/api/state")).json()).session).not.toBeNull();
  await api.post("/api/auth/logout");
  expect((await (await api.get("/api/state")).json()).session).toBeNull();
  await api.dispose();
});

test("el estado soporta consultas incrementales por versión", async () => {
  const admin = await adminApi();
  const first = await (await admin.get("/api/state")).json();
  const unchanged = await (await admin.get(`/api/state?v=${first.version}`)).json();
  expect(unchanged).toMatchObject({ unchanged: true, version: first.version });
  await runCommand(admin, { type: "product.stock", id: "p-clay", delta: 1 });
  const changed = await (await admin.get(`/api/state?v=${first.version}`)).json();
  expect(changed.version).toBe(first.version + 1);
  expect(changed.state).toBeTruthy();
  await admin.dispose();
});
