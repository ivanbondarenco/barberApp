import { expect, test, type Locator, type Page } from "@playwright/test";
import { loginAsClient, pageState, pickFirstSlot, resetData } from "./helpers";

test.beforeAll(resetData);
test.beforeEach(async ({ page }) => loginAsClient(page));

async function chooseService(page: Page, name: RegExp) {
  await page.getByRole("radio", { name }).click();
  await expect(page.getByRole("heading", { name: "¿Cuándo venís?" })).toBeVisible();
}

async function chooseDay(scope: Page | Locator, index: number) {
  const enabled = scope.getByRole("radiogroup", { name: "Día" }).locator("button:not([disabled])");
  await enabled.nth(index).click();
  await expect(enabled.nth(index)).toHaveAttribute("aria-checked", "true");
}

async function continueToConfirm(page: Page) {
  const time = await pickFirstSlot(page);
  await page.getByRole("button", { name: new RegExp(`Continuar · ${time}`) }).click();
  await expect(page.getByRole("heading", { name: "Confirmá tu turno" })).toBeVisible();
  return time;
}

test("reserva pagando la seña online y ve el turno confirmado", async ({ page }) => {
  await chooseService(page, /Corte Clásico Tijera/);
  await expect(page.getByText("$4.750")).toBeVisible(); // seña 50% de $9.500
  const time = await continueToConfirm(page);

  await expect(page.getByRole("radio", { name: /Pagar online/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Pagar seña" }).click();
  const checkout = page.getByRole("dialog", { name: "Pagar seña" });
  await expect(checkout.getByText("$4.750", { exact: true })).toBeVisible();
  await checkout.getByRole("button", { name: /con Mercado Pago/ }).click();

  await page.waitForURL(/cliente\/pago\/exito\?turno=/);
  await expect(page.getByRole("heading", { name: "¡Listo, te esperamos!" })).toBeVisible();
  await expect(page.getByText(`${time} hs`)).toBeVisible();

  const id = new URL(page.url()).searchParams.get("turno")!;
  const appointment = (await pageState(page)).state.appointments.find((a) => a.id === id);
  expect(appointment).toMatchObject({ status: "confirmado", deposit: { status: "abonada", method: "mercadopago" } });

  await page.getByRole("link", { name: "Ver mi turno" }).click();
  await page.waitForURL(`**/cliente/turno/${id}`);
  await expect(page.getByText("Abonada · Mercado Pago")).toBeVisible();
});

test("reserva con seña en efectivo y luego la paga online", async ({ page }) => {
  await chooseService(page, /Barboterapia/);
  await chooseDay(page, 3);
  await continueToConfirm(page);
  const cash = page.getByRole("radio", { name: /Efectivo en el local/ });
  await expect(cash, "la seña en efectivo debería estar disponible para un turno lejano").toBeEnabled();
  await cash.click();
  await page.getByRole("button", { name: "Reservar" }).click();

  await page.waitForURL(/cliente\/pago\/pendiente/);
  await expect(page.getByRole("heading", { name: "Turno reservado" })).toBeVisible();
  await expect(page.getByText(/Aboná \$3\.750 en el local antes del/)).toBeVisible();

  await page.getByRole("button", { name: "Pagar online ahora" }).click();
  await page.getByRole("dialog", { name: "Pagar seña" }).getByRole("button", { name: /con Mercado Pago/ }).click();
  await page.waitForURL(/cliente\/pago\/exito/);
});

test("un pago rechazado no reserva y permite reintentar con el servicio elegido", async ({ page }) => {
  const before = (await pageState(page)).state.appointments.length;
  await chooseService(page, /Combo Corte/);
  await continueToConfirm(page);
  await page.getByRole("button", { name: "Pagar seña" }).click();
  await page.getByRole("button", { name: "Simular pago rechazado (demo)" }).click();

  await page.waitForURL(/cliente\/pago\/error/);
  await expect(page.getByRole("heading", { name: "El pago no se completó" })).toBeVisible();
  expect((await pageState(page)).state.appointments.length).toBe(before);

  await page.getByRole("link", { name: "Intentar de nuevo" }).click();
  await expect(page.getByRole("heading", { name: "¿Cuándo venís?" })).toBeVisible();
  await expect(page.getByText(/Combo Corte \+ Barba Clásica · 60 min/)).toBeVisible();
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
  await chooseDay(sheet, 4);
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
  await chooseDay(page, 5);
  await continueToConfirm(page);
  await page.getByRole("button", { name: "Pagar seña" }).click();
  await page.getByRole("dialog", { name: "Pagar seña" }).getByRole("button", { name: /con Mercado Pago/ }).click();
  await page.waitForURL(/cliente\/pago\/exito/);
  const id = new URL(page.url()).searchParams.get("turno")!;

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

test("historial filtra turnos y permite repetir", async ({ page }) => {
  await page.goto("/cliente/historial");
  await page.getByRole("tab", { name: "Realizados" }).click();
  await expect(page.getByText("Cobrado").first()).toBeVisible();
  await page.getByRole("link", { name: /Repetir/ }).first().click();
  await expect(page.getByRole("heading", { name: "¿Cuándo venís?" })).toBeVisible();
});
