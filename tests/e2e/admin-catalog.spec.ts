import { expect, test } from "@playwright/test";
import { loginAsAdmin, loginAsClient, newDevice, pageState, resetData } from "./helpers";

test.beforeAll(resetData);
test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/servicios");
});

test("servicios: alta, modificación, ocultar y baja con deshacer", async ({ page }) => {
  await page.getByRole("button", { name: "Servicio", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Nuevo servicio" });
  await form.getByRole("button", { name: "Crear servicio" }).click();
  await expect(form.getByText("Mínimo 3 caracteres")).toBeVisible();

  await form.getByLabel("Nombre").fill("Afeitado Express");
  await form.getByLabel("Precio").fill("6500");
  await expect(form.getByText("Seña 50%: $3.250")).toBeVisible();
  await form.getByLabel("Duración").selectOption("30");
  await form.getByRole("button", { name: "Crear servicio" }).click();
  await expect(form).toBeHidden();
  await expect(page.getByRole("main").getByRole("button", { name: /Afeitado Express/ })).toContainText("$6.500");

  await page.getByRole("main").getByRole("button", { name: /Afeitado Express/ }).click();
  const edit = page.getByRole("dialog", { name: "Editar servicio" });
  await edit.getByLabel("Precio").fill("7000");
  await edit.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("main").getByRole("button", { name: /Afeitado Express/ })).toContainText("$7.000");

  const visible = page.getByRole("switch", { name: "Afeitado Express visible" });
  await visible.click();
  await expect(visible).toHaveAttribute("aria-checked", "false");
  await expect.poll(async () => (await pageState(page)).state.services.find((s) => s.name === "Afeitado Express")?.active).toBe(false);
  await visible.click();

  await page.getByRole("main").getByRole("button", { name: /Afeitado Express/ }).click();
  await page.getByRole("dialog", { name: "Editar servicio" }).getByRole("button", { name: "Eliminar servicio" }).click();
  await expect(page.getByRole("main").getByRole("button", { name: /Afeitado Express/ })).toBeHidden();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByRole("main").getByRole("button", { name: /Afeitado Express/ })).toBeVisible();
  expect((await pageState(page)).state.services.find((s) => s.name === "Afeitado Express")?.price).toBe(7000);
});

test("productos: alta con stock, edición y baja", async ({ page }) => {
  await page.getByRole("tab", { name: /Productos/ }).click();
  await page.getByRole("button", { name: "Producto", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Nuevo producto" });
  await form.getByLabel("Nombre").fill("Cera Mate Viaje");
  await form.getByLabel("Precio").fill("4500");
  await form.getByLabel("Tamaño").fill("30g");
  await form.getByRole("button", { name: "Sumar stock" }).click();
  await form.getByRole("button", { name: "Crear producto" }).click();
  await expect(form).toBeHidden();
  await expect(page.getByRole("main").getByRole("button", { name: /Cera Mate Viaje/ })).toContainText("stock 11");

  await page.getByRole("main").getByRole("button", { name: /Cera Mate Viaje/ }).click();
  const edit = page.getByRole("dialog", { name: "Editar producto" });
  for (let i = 0; i < 9; i++) await edit.getByRole("button", { name: "Restar stock" }).click();
  await edit.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("main").getByRole("button", { name: /Cera Mate Viaje/ })).toContainText("stock 2");

  await page.getByRole("main").getByRole("button", { name: /Cera Mate Viaje/ }).click();
  await page.getByRole("dialog", { name: "Editar producto" }).getByRole("button", { name: "Eliminar producto" }).click();
  await expect(page.getByRole("main").getByRole("button", { name: /Cera Mate Viaje/ })).toBeHidden();
  expect((await pageState(page)).state.products.some((p) => p.name === "Cera Mate Viaje")).toBe(false);
});

test("reglas de seña: el 50% es fijo y el efectivo se puede desactivar", async ({ page }) => {
  await page.getByRole("tab", { name: "Seña" }).click();
  await expect(page.getByText("Seña fija del 50%")).toBeVisible();
  const cash = page.getByRole("switch", { name: "Seña en efectivo" });
  await cash.click();
  await expect(cash).toHaveAttribute("aria-checked", "false");
  await cash.click();
  await expect(cash).toHaveAttribute("aria-checked", "true");
});

test("los cambios del catálogo llegan al celular del cliente sin recargar", async ({ page, browser }) => {
  const client = await newDevice(browser);
  await loginAsClient(client.page);
  await expect(client.page.getByRole("radio", { name: /Corte Clásico Tijera/ })).toBeVisible();

  await page.getByRole("switch", { name: "Corte Clásico Tijera visible" }).click();
  await expect(client.page.getByRole("radio", { name: /Corte Clásico Tijera/ })).toBeHidden({ timeout: 20_000 });

  await page.getByRole("switch", { name: "Corte Clásico Tijera visible" }).click();
  await expect(client.page.getByRole("radio", { name: /Corte Clásico Tijera/ })).toBeVisible({ timeout: 20_000 });
  await client.context.close();
});

test("la tienda del local muestra entregas y permite reponer stock", async ({ page }) => {
  await page.goto("/admin/tienda");
  await expect(page.getByRole("link", { name: /Lucas Gómez/ })).toBeVisible();
  await expect(page.getByText("Beard Elixir Cedro", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "+5" }).first().click();
  await expect.poll(async () => (await pageState(page)).state.products.find((p) => p.id === "p-elixir")?.stock).toBe(8);
});
