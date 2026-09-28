import { expect, test, type Locator, type Page } from "@playwright/test";
import { adminApi, chooseCalendarDay, chooseDayAhead, loginAsClient, nextSunday, pageState, pickFirstSlot, resetData, runCommand } from "./helpers";

test.beforeAll(resetData);
test.beforeEach(async ({ page }) => loginAsClient(page));

async function chooseService(page: Page, name: RegExp) {
  await page.getByRole("radio", { name }).click();
  await expect(page.getByRole("heading", { name: "¿Cuándo venís?" })).toBeVisible();
}

async function continueToConfirm(page: Page) {
  const time = await pickFirstSlot(page);
  await page.getByRole("button", { name: new RegExp(`Continuar · ${time}`) }).click();
  await expect(page.getByRole("heading", { name: "Confirmá tu turno" })).toBeVisible();
  return time;
}

test("reserva avisando una transferencia: queda en revisión hasta que el local la confirme", async ({ page }) => {
  await chooseService(page, /Corte Clásico Tijera/);
  await expect(page.getByText("$4.750")).toBeVisible(); // seña 50% de $9.500
  const time = await continueToConfirm(page);

  await expect(page.getByRole("radio", { name: /Pagar online/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Pagar seña" }).click();
  const checkout = page.getByRole("dialog", { name: "Pagar seña" });
  await expect(checkout.getByText("$4.750", { exact: true })).toBeVisible();
  await checkout.getByRole("button", { name: /Reservar y transferir/ }).click();

  await page.waitForURL(/cliente\/pago\/pendiente\?turno=/);
  const id = new URL(page.url()).searchParams.get("turno")!;
  await expect(page.getByText(`${time} hs`)).toBeVisible();

  // El turno existe, pero la seña NO está abonada: el navegador no puede acreditarla.
  let appointment = (await pageState(page)).state.appointments.find((a) => a.id === id);
  expect(appointment).toMatchObject({ status: "confirmado", deposit: { status: "pendiente", method: "transferencia" } });

  // El cliente avisa que transfirió: pasa a revisión, que todavía no es plata.
  await page.getByRole("button", { name: "Ver datos y avisar" }).click();
  await page.getByRole("dialog", { name: "Pagar seña" }).getByRole("button", { name: /Ya transferí/ }).click();
  await expect.poll(async () => (await pageState(page)).state.appointments.find((a) => a.id === id)?.deposit.status).toBe("en_revision");

  await page.getByRole("link", { name: "Ver mi turno" }).click();
  await page.waitForURL(`**/cliente/turno/${id}`);
  await expect(page.getByText("Estamos confirmando tu transferencia")).toBeVisible();

  // Recién el staff, con el comprobante a la vista, la acredita.
  const api = await adminApi();
  expect((await runCommand(api, { type: "appointment.deposit", id, method: "transferencia" })).status).toBe(200);
  await api.dispose();

  await page.reload();
  await expect(page.getByText("Abonada · Transferencia")).toBeVisible();
  appointment = (await pageState(page)).state.appointments.find((a) => a.id === id);
  expect(appointment?.deposit.status).toBe("abonada");
});

test("el cliente no puede acreditarse la seña ni llamando a la API", async ({ page }) => {
  await chooseService(page, /Corte Clásico Tijera/);
  await continueToConfirm(page);
  await page.getByRole("button", { name: "Pagar seña" }).click();
  await page.getByRole("dialog", { name: "Pagar seña" }).getByRole("button", { name: /Reservar y transferir/ }).click();
  await page.waitForURL(/cliente\/pago\/pendiente\?turno=/);
  const id = new URL(page.url()).searchParams.get("turno")!;

  // Comando de staff enviado con la sesión del cliente: el servidor lo rechaza.
  const res = await page.request.post("/api/commands", {
    data: { command: { type: "appointment.deposit", id, method: "mercadopago" } },
  });
  expect(res.status()).toBe(403);
  expect((await pageState(page)).state.appointments.find((a) => a.id === id)?.deposit.status).toBe("pendiente");
});

test("reserva con seña en efectivo y después avisa la transferencia", async ({ page }) => {
  await chooseService(page, /Barboterapia/);
  await chooseDayAhead(page, 4);
  await continueToConfirm(page);
  const cash = page.getByRole("radio", { name: /Efectivo en el local/ });
  await expect(cash, "la seña en efectivo debería estar disponible para un turno lejano").toBeEnabled();
  await cash.click();
  await page.getByRole("button", { name: "Reservar" }).click();

  await page.waitForURL(/cliente\/pago\/pendiente/);
  const id = new URL(page.url()).searchParams.get("turno")!;
  await expect(page.getByRole("heading", { name: "Turno reservado" })).toBeVisible();
  await expect(page.getByText(/Aboná \$3\.750 en el local antes del/)).toBeVisible();

  await page.getByRole("button", { name: "Pagar online ahora" }).click();
  await page.getByRole("dialog", { name: "Pagar seña" }).getByRole("button", { name: /Ya transferí/ }).click();
  await expect.poll(async () => (await pageState(page)).state.appointments.find((a) => a.id === id)?.deposit.status).toBe("en_revision");
});

test("el asistente permite volver y cambiar de barbero", async ({ page }) => {
  await page.getByRole("button", { name: /Cambiar/ }).click();
  const sheet = page.getByRole("dialog", { name: "Elegí tu barbero" });
  await sheet.getByRole("button", { name: /Diego S\./ }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Diego S.")).toBeVisible();

  await chooseService(page, /Corte Skin Fade/);
  await page.getByRole("button", { name: "Paso anterior" }).click();
  await expect(page.getByRole("heading", { name: "¿Qué te hacés?" })).toBeVisible();
});

test("reprograma un turno propio", async ({ page }) => {
  await page.goto("/cliente/mis-turnos");
  await page.getByRole("link", { name: /Tu próximo turno/ }).click();
  await page.waitForURL(/cliente\/turno\//);
  const id = page.url().split("/").pop()!;
  const original = (await pageState(page)).state.appointments.find((a) => a.id === id)!;

  await page.getByRole("button", { name: "Reprogramar" }).click();
  const sheet = page.getByRole("dialog", { name: "Reprogramar" });
  await chooseDayAhead(sheet, 5);
  await pickFirstSlot(sheet);
  await sheet.getByRole("button", { name: /^Confirmar/ }).click();
  await expect(sheet).toBeHidden();

  await expect
    .poll(async () => (await pageState(page)).state.appointments.find((a) => a.id === id)?.date)
    .not.toBe(original.date);
});

test("cancela con anticipación, recibe crédito y lo usa como seña", async ({ page }) => {
  // Reserva lejana para quedar dentro de la ventana de cancelación sin cargo.
  await chooseService(page, /Corte Signature Fade/);
  await chooseDayAhead(page, 6);
  await continueToConfirm(page);
  await page.getByRole("button", { name: "Pagar seña" }).click();
  await page.getByRole("dialog", { name: "Pagar seña" }).getByRole("button", { name: /Reservar y transferir/ }).click();
  await page.waitForURL(/cliente\/pago\/pendiente/);
  const id = new URL(page.url()).searchParams.get("turno")!;

  // La seña la acredita el staff; solo entonces puede volver como crédito.
  const api = await adminApi();
  expect((await runCommand(api, { type: "appointment.deposit", id, method: "transferencia" })).status).toBe(200);
  await api.dispose();

  await page.goto(`/cliente/turno/${id}`);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: "¿Cancelar este turno?" });
  await expect(confirm).toContainText("$6.000 queda como crédito");
  await confirm.getByRole("button", { name: "Cancelar turno" }).click();
  await expect(page.getByText("Cancelado").first()).toBeVisible();

  const credit = (await pageState(page)).state.clients[0].credit;
  expect(credit).toBeGreaterThanOrEqual(6000);

  await page.goto("/cliente/perfil");
  await expect(page.getByText("Crédito a favor")).toBeVisible();

  await page.goto("/cliente/reservar");
  await chooseService(page, /Corte Signature Fade/);
  await continueToConfirm(page);
  await page.getByRole("radio", { name: /Usar mi crédito/ }).click();
  await page.getByRole("button", { name: "Usar crédito" }).click();
  await page.waitForURL(/cliente\/pago\/exito/);
  await expect(page.getByText("Seña abonada con Crédito a favor.")).toBeVisible();
  expect((await pageState(page)).state.clients[0].credit).toBe(credit - 6000);
});

test("desde el calendario del mes el cliente elige la fecha y después el servicio", async ({ page }) => {
  await page.goto("/cliente/mis-turnos");
  await chooseDayAhead(page, 7);

  await page.getByRole("link", { name: "Reservar turno", exact: true }).click();
  await page.waitForURL(/cliente\/reservar\?fecha=/);
  const fecha = new URL(page.url()).searchParams.get("fecha")!;

  await chooseService(page, /Corte Clásico Tijera/);
  // La fecha que venía del calendario queda elegida en el paso del horario.
  const checked = page.getByRole("radiogroup", { name: "Día" }).getByRole("radio", { checked: true });
  await expect(checked).toHaveAttribute("aria-label", new RegExp(` ${Number(fecha.slice(8, 10))} `));
});

test("el cliente toca un domingo y la agenda le dice por qué no puede reservar", async ({ page }) => {
  await page.goto("/cliente/mis-turnos");
  const calendar = page.getByRole("radiogroup", { name: "Día" });
  await expect(calendar.getByRole("radio").first()).toBeVisible();
  await chooseCalendarDay(page, nextSunday());
  await expect(page.getByText("Ese día el local está cerrado")).toBeVisible();
  await expect(page.getByRole("link", { name: "Reservar turno", exact: true })).toBeHidden();
});

test("la agenda del cliente llega hasta dos semanas: más lejos lo rechaza el servidor", async ({ page }) => {
  await page.goto("/cliente/mis-turnos");
  const state = (await pageState(page)).state;
  const far = new Date();
  far.setDate(far.getDate() + 30);
  const date = `${far.getFullYear()}-${String(far.getMonth() + 1).padStart(2, "0")}-${String(far.getDate()).padStart(2, "0")}`;

  const res = await page.request.post("/api/commands", {
    data: {
      command: {
        type: "appointment.book",
        payload: {
          id: "a-lejano",
          clientName: "Tomás Ferreyra",
          clientPhone: "+54 9 11 5555-0192",
          barberId: state.barbers[0].id,
          serviceId: state.services.find((s) => s.active)!.id,
          date,
          time: "10:00",
          depositMethod: "transferencia",
        },
      },
    },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toMatch(/2 semanas/);
  expect((await pageState(page)).state.appointments.some((a) => a.id === "a-lejano")).toBe(false);
});

test("historial filtra turnos y permite repetir", async ({ page }) => {
  await page.goto("/cliente/historial");
  await page.getByRole("tab", { name: "Realizados" }).click();
  await expect(page.getByText("Cobrado").first()).toBeVisible();
  await page.getByRole("link", { name: /Repetir/ }).first().click();
  await expect(page.getByRole("heading", { name: "¿Cuándo venís?" })).toBeVisible();
});
