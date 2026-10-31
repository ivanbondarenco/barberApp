import { expect, test } from "@playwright/test";
import { loginAsAdmin, resetData } from "./helpers";

test.beforeAll(resetData);
test.beforeEach(async ({ page }) => loginAsAdmin(page));

test("sueldos: comisión, adelanto, liquidación con recibo y anulación", async ({ page }) => {
  // La comisión se define en la ficha del barbero.
  await page.goto("/admin/equipo");
  await page.getByRole("main").getByRole("button", { name: /Nico/ }).click();
  const form = page.getByRole("dialog", { name: "Editar barbero" });
  await form.getByRole("tab", { name: "Porcentaje" }).click();
  await form.getByLabel("Porcentaje del servicio").fill("150");
  await form.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(form.getByText("Entre 0 y 100")).toBeVisible();
  await form.getByLabel("Porcentaje del servicio").fill("50");
  await form.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(form).toBeHidden();

  await page.goto("/admin/sueldos");
  const card = page.getByRole("article", { name: /Sueldo de Nico/ });
  await expect(card.getByText("50 % por servicio")).toBeVisible();

  // Adelanto: se descuenta de lo que lleva ganado.
  await card.getByRole("button", { name: "Adelanto" }).click();
  const advance = page.getByRole("dialog", { name: "Registrar adelanto" });
  await advance.getByLabel("Monto").fill("15000");
  await advance.getByLabel("Detalle").fill("Vale de la semana");
  await advance.getByRole("button", { name: "Registrar adelanto" }).click();
  await expect(advance).toBeHidden();
  await expect(card.getByText("Vale de la semana")).toBeVisible();

  // Liquidar genera el recibo con el adelanto descontado.
  await card.getByRole("button", { name: "Liquidar" }).click();
  const pay = page.getByRole("dialog", { name: /Liquidar a Nico/ });
  await pay.getByRole("tab", { name: "Transferencia" }).click();
  await pay.getByRole("button", { name: /generar recibo/ }).click();
  await page.waitForURL("**/admin/sueldos/recibo/**");
  const receipt = page.getByRole("article", { name: "Recibo número 1" });
  await expect(receipt.getByText("Vale de la semana")).toBeVisible();
  await expect(receipt.getByText("Transferencia")).toBeVisible();
  await expect(page.getByRole("button", { name: "Imprimir o guardar PDF" })).toBeVisible();

  // Anular devuelve el adelanto a pendiente.
  await page.getByRole("button", { name: "Anular liquidación" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Anular" }).click();
  await page.waitForURL("**/admin/sueldos");
  await expect(page.getByRole("article", { name: /Sueldo de Nico/ }).getByText("Vale de la semana")).toBeVisible();
});

test("el menú ofrece soporte por WhatsApp a la barbería", async ({ page }) => {
  await page.goto("/admin/agenda");
  await page.getByRole("button", { name: "Abrir menú de cuenta" }).click();
  const support = page.getByRole("link", { name: /Soporte por WhatsApp/ });
  await expect(support).toHaveAttribute("href", /wa\.me\/5491130969716/);
});

test("la campana muestra la actividad y el perfil se ve como botón", async ({ page }) => {
  await page.goto("/admin/agenda");
  await page.getByRole("button", { name: /^Notificaciones/ }).click();
  const panel = page.getByRole("dialog", { name: "Notificaciones" });
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(page.getByRole("button", { name: "Abrir menú de cuenta" })).toHaveAttribute("aria-haspopup", "dialog");
});
