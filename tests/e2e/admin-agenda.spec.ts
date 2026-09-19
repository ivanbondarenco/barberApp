import { expect, test } from "@playwright/test";
import { loginAsAdmin, pageState, pickFirstSlot, resetData } from "./helpers";

test.beforeAll(resetData);
test.beforeEach(async ({ page }) => loginAsAdmin(page));

test("la agenda del día muestra turnos, bloqueos y estado de caja", async ({ page }) => {
  for (const name of ["Mateo Rossi", "Lucas Gómez", "Julián Pérez", "Santiago Díaz", "Martín López"]) {
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /Almuerzo/ })).toBeVisible();
  await expect(page.getByText("5 turnos")).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: /Caja abierta/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Julián Pérez/ })).toContainText("Seña pendiente");
});

test("carga un turno manual, registra la seña, suma un producto y cobra", async ({ page }) => {
  await page.getByRole("button", { name: "Turno", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Nuevo turno" });
  await form.getByRole("button", { name: /^Agendar/ }).click();
  await expect(form.getByText(/Elegí servicio, día y horario|Ingresá el nombre/)).toBeVisible();

  await form.getByLabel("Cliente").fill("Walk In Test");
  await form.getByLabel("Celular").fill("+54 9 11 1234 5678");
  await form.getByLabel("Servicio").selectOption({ label: "Corte Clásico Tijera" });
  const time = await pickFirstSlot(form);
  await form.getByRole("button", { name: `Agendar ${time} hs` }).click();
  await expect(form).toBeHidden();

  const state = (await pageState(page)).state;
  const appointment = state.appointments.find((a) => a.clientName === "Walk In Test")!;
  expect(appointment).toMatchObject({ status: "confirmado", deposit: { status: "pendiente" } });
  expect(state.clients.some((c) => c.name === "Walk In Test")).toBe(true);

  await page.goto(`/admin/turno/${appointment.id}`);
  await page.getByRole("button", { name: "Registrar seña $4.750" }).click();
  await page.getByRole("dialog", { name: "Registrar seña" }).getByRole("button", { name: "Registrar $4.750" }).click();
  await expect(page.getByText("Abonada · Efectivo")).toBeVisible();

  await page.getByRole("button", { name: "Agregar producto" }).click();
  await page.getByRole("dialog", { name: "Agregar producto" }).getByRole("button", { name: /Pomada Brillo Clásico/ }).click();
  await expect(page.getByRole("button", { name: "Cobrar $13.650" })).toBeVisible(); // 4.750 saldo + 8.900 producto

  await page.getByRole("button", { name: "Cobrar $13.650" }).click();
  const charge = page.getByRole("dialog", { name: "Cobrar" });
  await charge.getByRole("radio", { name: "Mercado Pago" }).click();
  await charge.getByRole("button", { name: "Cobrar $13.650" }).click();
  await expect(page.getByText("Cobrado").first()).toBeVisible();

  const charged = (await pageState(page)).state.appointments.find((a) => a.id === appointment.id);
  expect(charged?.status).toBe("completado");
});

test("edita y cancela un turno; luego lo elimina", async ({ page }) => {
  await page.getByRole("link", { name: /Martín López/ }).click();
  await page.waitForURL(/admin\/turno\/a-martin/);

  await page.getByRole("button", { name: "Editar" }).click();
  const form = page.getByRole("dialog", { name: "Editar turno" });
  await form.getByLabel("Servicio").selectOption({ label: "Combo Corte + Barba Clásica" });
  await form.getByLabel("Nota técnica (opcional)").fill("Prefiere barba corta");
  await form.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(form).toBeHidden();
  await expect(page.getByText("Prefiere barba corta")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Combo Corte + Barba Clásica" }).or(page.getByText("Combo Corte + Barba Clásica").first())).toBeVisible();

  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar turno" }).click();
  await expect(page.getByText("Cancelado").first()).toBeVisible();

  await page.getByRole("button", { name: "Eliminar definitivamente" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
  await page.waitForURL("**/admin/agenda");
  expect((await pageState(page)).state.appointments.some((a) => a.id === "a-martin")).toBe(false);
});

test("bloquea un horario y lo vuelve a liberar", async ({ page }) => {
  await page.getByRole("button", { name: "Bloquear horario" }).click();
  const sheet = page.getByRole("dialog", { name: "Bloquear horario" });
  await sheet.getByLabel("Barbero").selectOption({ index: 0 });
  await sheet.getByLabel("Desde").selectOption("16:00");
  await sheet.getByLabel("Hasta").selectOption("17:00");
  await sheet.getByLabel("Motivo").fill("Capacitación");
  await sheet.getByRole("button", { name: "Bloquear 16:00–17:00" }).click();
  await expect(page.getByRole("main").getByRole("button", { name: /Capacitación/ })).toBeVisible();

  await page.getByRole("main").getByRole("button", { name: /Capacitación/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Quitar" }).click();
  await expect(page.getByRole("main").getByRole("button", { name: /Capacitación/ })).toBeHidden();
  expect((await pageState(page)).state.blocks.some((b) => b.reason === "Capacitación")).toBe(false);
});

test("con la caja cerrada no se puede cobrar; el cierre registra el arqueo", async ({ page }) => {
  await page.getByRole("main").getByRole("button", { name: /Caja abierta/ }).click();
  await page.waitForURL("**/admin/finanzas/cierre");
  await page.getByLabel("Contado").fill("5000");
  await expect(page.getByText("Faltante")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar caja" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cerrar caja" }).click();
  await expect(page.getByText("La caja está cerrada")).toBeVisible();

  await page.goto("/admin/turno/a-mateo");
  await page.getByRole("button", { name: /^Cobrar/ }).click();
  await expect(page.getByText("Abrí la caja para registrar cobros")).toBeVisible();

  await page.goto("/admin/agenda");
  await page.getByRole("main").getByRole("button", { name: /Caja cerrada/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Abrir caja" }).click();
  await expect(page.getByRole("main").getByRole("button", { name: /Caja abierta/ })).toBeVisible();
});

test("finanzas muestra lo cobrado y los movimientos", async ({ page }) => {
  await page.goto("/admin/finanzas");
  await expect(page.getByText(/Cobrado ·/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Movimientos" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Mateo Rossi/ })).toBeVisible();
});

test("la agenda cambia de día y de semana", async ({ page }) => {
  const days = page.getByRole("radiogroup", { name: "Día" }).getByRole("radio");
  await days.nth(2).click();
  await expect(days.nth(2)).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Semana siguiente" }).click();
  await expect(page.getByText(/Día libre|turnos/).first()).toBeVisible();
});
