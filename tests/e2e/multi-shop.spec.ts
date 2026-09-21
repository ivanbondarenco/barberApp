import { expect, test, type Page } from "@playwright/test";
import { ADMIN, captureOtp, newDevice, openShop, pageState, resetData, SHOP_SLUG } from "./helpers";

test.beforeAll(resetData);

/**
 * Multi-barbería: cada local es una isla.
 *
 * Este archivo deja una barbería nueva publicada, así que corre al final y el resto de los
 * tests fija la suya con `openShop` (el link /b/<slug>), igual que un cliente real.
 */
const NUEVA = {
  name: "Barbería Del Sur",
  slug: "barberia-del-sur",
  owner: "Marcos Duarte",
  address: "Av. Rivadavia 8800",
  whatsapp: "+54 9 11 6500 4400",
  email: "marcos@delsur.com.ar",
  pin: "5678",
};

async function registerShop(page: Page) {
  await page.goto("/auth/nueva-barberia");
  await page.getByLabel("Nombre de la barbería").fill(NUEVA.name);
  await page.getByLabel("Dirección").fill(NUEVA.address);
  await page.getByLabel("WhatsApp del local").fill(NUEVA.whatsapp);
  await page.getByLabel("Tu nombre").fill(NUEVA.owner);
  await page.getByLabel("Tu celular o email").fill(NUEVA.email);
  await page.getByLabel("PIN de 4 dígitos").fill(NUEVA.pin);
  await page.getByRole("button", { name: "Crear barbería" }).click();
  await page.waitForURL("**/admin/agenda");
}

test.describe.serial("alta y aislamiento de barberías", () => {
  test("registrar una barbería deja al dueño en su propia agenda vacía", async ({ page }) => {
    await registerShop(page);

    const { session, state } = await pageState(page);
    expect(session?.role).toBe("admin");
    expect(session?.shop.name).toBe(NUEVA.name);
    expect(session?.shop.slug).toBe(NUEVA.slug);

    // Arranca con catálogo mínimo y sin nada de la barbería demo.
    expect(state.businessInfo.name).toBe(NUEVA.name);
    expect(state.appointments).toEqual([]);
    expect(state.clients).toEqual([]);
    expect(state.services.length).toBeGreaterThan(0);
    expect(state.services.map((s) => s.name)).not.toContain("Corte Clásico Tijera");
    // Y publica SUS datos, no los del local de demostración.
    expect(state.businessInfo).toMatchObject({ address: NUEVA.address, whatsapp: NUEVA.whatsapp });
    expect(state.barbers.map((b) => b.name)).toEqual([NUEVA.owner]);
    await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
  });

  test("el dueño de una barbería no ve nada de la otra", async ({ page }) => {
    await openShop(page, NUEVA.slug);
    await page.goto("/auth/login");
    await page.getByRole("tab", { name: "Soy barbero" }).click();
    await page.getByLabel("Email").fill(NUEVA.email);
    await page.getByLabel("PIN", { exact: true }).fill(NUEVA.pin);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL("**/admin/agenda");

    const { state } = await pageState(page);
    expect(state.appointments).toEqual([]);
    expect(state.clients).toEqual([]);

    // Y los turnos de la otra barbería no se alcanzan ni por id.
    const otra = await newDevice(page.context().browser()!);
    await openShop(otra.page, SHOP_SLUG);
    const demoAdmin = await otra.page.request.post("/api/auth/login", {
      data: { role: "admin", identifier: ADMIN.email, pin: ADMIN.pin },
    });
    expect(demoAdmin.ok()).toBeTruthy();
    const ajeno = (await pageState(otra.page)).state.appointments.find((a) => a.status === "confirmado")!;
    await otra.context.close();

    const res = await page.request.post("/api/commands", {
      data: { command: { type: "appointment.cancel", id: ajeno.id } },
    });
    expect(res.status()).toBe(404);
  });

  test("las credenciales del dueño de una barbería no sirven en la otra", async ({ page }) => {
    await openShop(page, NUEVA.slug);
    await page.goto("/auth/login");
    await page.getByRole("tab", { name: "Soy barbero" }).click();
    await page.getByLabel("Email").fill(ADMIN.email); // dueño de la barbería demo
    await page.getByLabel("PIN", { exact: true }).fill(ADMIN.pin);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByText(/Datos incorrectos/)).toBeVisible();
  });

  test("el mismo celular puede ser cliente de las dos barberías", async ({ page, browser }) => {
    const phone = "+54 9 11 8888 7777";
    const registrar = async (target: Page, slug: string, name: string) => {
      await openShop(target, slug);
      await target.goto("/auth/registro");
      await target.getByLabel("Nombre y apellido").fill(name);
      await target.getByLabel("Celular").fill(phone);
      await target.getByLabel("PIN", { exact: true }).fill("2468");
      await target.getByLabel("Repetir PIN").fill("2468");
      await target.getByLabel(/Acepto las/).check();
      const code = await captureOtp(target, "/api/auth/register", () =>
        target.getByRole("button", { name: "Continuar" }).click(),
      );
      await target.getByLabel("Código").fill(code);
      await target.getByRole("button", { name: "Verificar y crear cuenta" }).click();
      await target.waitForURL("**/cliente/reservar");
    };

    await registrar(page, SHOP_SLUG, "Cliente Demo Sur");
    expect((await pageState(page)).session?.shop.slug).toBe(SHOP_SLUG);

    const otra = await newDevice(browser);
    await registrar(otra.page, NUEVA.slug, "Cliente Del Sur");
    expect((await pageState(otra.page)).session?.shop.slug).toBe(NUEVA.slug);
    // Son dos cuentas distintas: cada una ve solo su barbería.
    expect((await pageState(otra.page)).state.appointments).toEqual([]);
    await otra.context.close();
  });

  test("un visitante sin barbería elegida ve el selector", async ({ browser }) => {
    const { context, page } = await newDevice(browser);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Elegí tu barbería" })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(NUEVA.name) })).toBeVisible();

    // Al elegir una queda fijada y se ve su carta pública, sin pedir cuenta todavía.
    await page.getByRole("link", { name: new RegExp(NUEVA.name) }).click();
    await page.waitForURL("**/local");
    await expect(page.getByRole("heading", { name: NUEVA.name })).toBeVisible();
    await expect(page.getByRole("link", { name: /Reservar turno/ })).toBeVisible();
    await context.close();
  });

  test("un slug inexistente vuelve al selector", async ({ browser }) => {
    const { context, page } = await newDevice(browser);
    await page.goto("/b/no-existe-esta-barberia");
    await expect(page.getByRole("heading", { name: "Elegí tu barbería" })).toBeVisible();
    await context.close();
  });
});
