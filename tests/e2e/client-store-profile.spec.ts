import { expect, test } from "@playwright/test";
import { CLIENT, loginAsClient, pageState, resetData } from "./helpers";

test.beforeAll(resetData);
test.beforeEach(async ({ page }) => loginAsClient(page));

test("suma productos a la bolsa del próximo turno", async ({ page }) => {
  await page.goto("/cliente/tienda");
  await expect(page.getByText(/Se entregan en tu turno del/)).toBeVisible();

  await page.getByRole("button", { name: "Agregar Matte Styling Clay" }).click();
  const bag = page.getByRole("button", { name: /Ver bolsa/ });
  await expect(bag).toContainText("$9.800");
  await page.getByRole("button", { name: "Sumar Matte Styling Clay" }).click();
  await expect(bag).toContainText("$19.600");

  await bag.click();
  const sheet = page.getByRole("dialog", { name: "Tu bolsa" });
  await expect(sheet.getByText("Matte Styling Clay")).toBeVisible();
  await sheet.getByRole("button", { name: "Quitar" }).click();
  await expect(sheet.getByText("$9.800").last()).toBeVisible();

  const next = (await pageState(page)).state.appointments.find((a) => a.id === "a-demo-client");
  expect(next?.products).toHaveLength(1);
});

test("filtra la tienda por categoría", async ({ page }) => {
  await page.goto("/cliente/tienda");
  await page.getByRole("tab", { name: "Barba" }).click();
  await expect(page.getByText("Beard Elixir Cedro")).toBeVisible();
  await expect(page.getByText("Matte Styling Clay")).toBeHidden();
});

test("edita sus datos y preferencias", async ({ page }) => {
  await page.goto("/cliente/perfil");
  await page.getByRole("button", { name: /Mis datos/ }).click();
  const sheet = page.getByRole("dialog", { name: "Mis datos" });
  await sheet.getByLabel("Nombre y apellido").fill("Tomás F. Ferreyra");
  await sheet.getByLabel("Preferencias de corte").fill("Fade medio, sin navaja");
  await sheet.getByRole("button", { name: "Guardar" }).click();
  await expect(sheet).toBeHidden();
  await page.reload();
  await expect(page.getByText("Tomás F. Ferreyra")).toBeVisible();
  await expect(page.getByText("Fade medio, sin navaja")).toBeVisible();
});

test("activa y desactiva avisos", async ({ page }) => {
  await page.goto("/cliente/perfil");
  const reminder = page.getByRole("switch", { name: /Recordatorio 24/ });
  await expect(reminder).toHaveAttribute("aria-checked", "true");
  await reminder.click();
  await expect(reminder).toHaveAttribute("aria-checked", "false");
  await page.reload();
  await expect(page.getByRole("switch", { name: /Recordatorio 24/ })).toHaveAttribute("aria-checked", "false");

  // El switch de promociones se quitó: no había nada detrás que las enviara.
  await expect(page.getByRole("switch", { name: "Novedades de la tienda" })).toHaveCount(0);
});

test("cambia la contraseña y vuelve a ingresar", async ({ page }) => {
  await page.goto("/cliente/perfil");
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  const sheet = page.getByRole("dialog", { name: "Cambiar contraseña" });
  await sheet.getByLabel("Contraseña actual").fill("no-es-esta");
  await sheet.getByLabel("Contraseña nueva").fill("corta");
  await sheet.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(sheet.getByText("Usá al menos 8 caracteres")).toBeVisible();
  await sheet.getByLabel("Contraseña nueva").fill("tomas-nueva-2026");
  await sheet.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(sheet.getByText("La contraseña actual no es correcta")).toBeVisible();
  await sheet.getByLabel("Contraseña actual").fill(CLIENT.password);
  await sheet.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.waitForURL("**/auth/login");
  await loginAsClient(page, CLIENT.email, "tomas-nueva-2026");

  // Restaura la contraseña demo para el resto de los tests.
  const res = await page.request.post("/api/auth/password", { data: { current: "tomas-nueva-2026", next: CLIENT.password } });
  expect(res.ok()).toBeTruthy();
});

test("políticas y ayuda son accesibles desde el perfil", async ({ page }) => {
  await page.goto("/cliente/perfil");
  await page.getByRole("link", { name: /Políticas de seña/ }).click();
  // El título refleja la seña que cobra ESTE local, no un 50% escrito a mano.
  await expect(page.getByRole("heading", { name: "Seña del 50%" })).toBeVisible();
  await page.goto("/ayuda");
  await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", /wa\.me/);
  await page.getByRole("button", { name: "¿Cómo reprogramo o cancelo?" }).click();
  await expect(page.getByText(/hasta 3 horas antes/)).toBeVisible();
});
