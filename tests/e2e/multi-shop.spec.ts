import { expect, test, type Page } from "@playwright/test";
import { ADMIN, fillLogin, newDevice, openShop, pageState, resetData, SHOP_SLUG } from "./helpers";

test.beforeAll(resetData);

/**
 * Multi-barbería: cada local es una isla, y el cliente tiene una sola cuenta para todas.
 *
 * Este archivo deja una barbería nueva publicada, así que corre al final y el resto de los
 * tests fija la suya con `openShop` (el link /b/<slug>), igual que un cliente real.
 */
const NUEVA = {
  name: "Barbería Del Sur",
  slug: "barberia-del-sur",
  owner: "Marcos Duarte",
  address: "Av. Rivadavia 8800",
  whatsapp: "11 6500-4400",
  whatsappStored: "+54 9 11 6500-4400",
  email: "marcos@delsur.com.ar",
  password: "delsur-2026",
};

async function registerShop(page: Page) {
  await page.goto("/auth/nueva-barberia");
  await page.getByLabel("Nombre de la barbería").fill(NUEVA.name);
  await page.getByLabel("Dirección").fill(NUEVA.address);
  await page.getByLabel("Tu número de teléfono").fill(NUEVA.whatsapp);
  await page.getByLabel("Tu nombre").fill(NUEVA.owner);
  await page.getByLabel("Tu email").fill(NUEVA.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(NUEVA.password);
  await page.getByLabel("Repetir contraseña").fill(NUEVA.password);
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

    // Arranca sin catálogo (los servicios y los precios son de cada local) y sin nada de la demo.
    expect(state.businessInfo.name).toBe(NUEVA.name);
    expect(state.appointments).toEqual([]);
    expect(state.clients).toEqual([]);
    expect(state.services).toEqual([]);
    // Y publica SUS datos, no los del local de demostración.
    expect(state.businessInfo).toMatchObject({ address: NUEVA.address, whatsapp: NUEVA.whatsappStored });
    expect(state.barbers.map((b) => b.name)).toEqual([NUEVA.owner]);
    await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
  });

  test("el dueño carga, edita y elimina sus propios servicios, con su precio", async ({ page }) => {
    await page.goto("/auth/login");
    await fillLogin(page, "barbero", NUEVA.email, NUEVA.password);
    await page.waitForURL("**/admin/agenda");
    await page.goto("/admin/servicios");

    // Sin catálogo no se puede agendar: la pantalla lo dice y ofrece cargar el primero.
    await expect(page.getByText("Todavía no cargaste tus servicios")).toBeVisible();
    await page.getByRole("button", { name: "Crear mi primer servicio" }).click();

    // Alta con el precio del local.
    const form = page.getByRole("dialog", { name: "Nuevo servicio" });
    await form.getByLabel("Nombre").fill("Corte a máquina");
    await form.getByLabel("Precio").fill("7000");
    await form.getByLabel("Duración").selectOption("30");
    await form.getByRole("button", { name: "Crear servicio" }).click();
    await expect(form).toBeHidden();
    await expect(page.getByRole("button", { name: /Corte a máquina/ })).toContainText("$7.000");

    // Modificación: el precio es de esta barbería y nadie más lo cambia.
    await page.getByRole("button", { name: /Corte a máquina/ }).click();
    const edit = page.getByRole("dialog", { name: "Editar servicio" });
    await edit.getByLabel("Precio").fill("9500");
    await edit.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(edit).toBeHidden();
    await expect(page.getByRole("button", { name: /Corte a máquina/ })).toContainText("$9.500");

    const mine = (await pageState(page)).state.services;
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ name: "Corte a máquina", price: 9500 });

    // La barbería de al lado sigue con las suyas, intactas.
    const other = await newDevice(page.context().browser()!);
    await openShop(other.page);
    await fillLogin(other.page, "barbero", ADMIN.email, ADMIN.password);
    await other.page.waitForURL("**/admin/agenda");
    const theirs = (await pageState(other.page)).state.services;
    expect(theirs.map((s) => s.name)).toContain("Corte Clásico Tijera");
    expect(theirs.map((s) => s.name)).not.toContain("Corte a máquina");
    await other.context.close();

    // Baja: se puede sacar del catálogo y vuelve a quedar vacío.
    await page.getByRole("button", { name: /Corte a máquina/ }).click();
    await page.getByRole("dialog", { name: "Editar servicio" }).getByRole("button", { name: "Eliminar servicio" }).click();
    await expect(page.getByText("Todavía no cargaste tus servicios")).toBeVisible();
    expect((await pageState(page)).state.services).toEqual([]);
  });

  test("el dueño entra a su barbería sin elegirla y no ve nada de la otra", async ({ page }) => {
    await page.goto("/auth/login");
    await fillLogin(page, "barbero", NUEVA.email, NUEVA.password);
    await page.waitForURL("**/admin/agenda");

    const { session, state } = await pageState(page);
    expect(session?.shop.slug).toBe(NUEVA.slug);
    expect(state.appointments).toEqual([]);
    expect(state.clients).toEqual([]);

    // Y los turnos de la otra barbería no se alcanzan ni por id.
    const otra = await newDevice(page.context().browser()!);
    const demoAdmin = await otra.page.request.post("/api/auth/login", {
      data: { role: "staff", identifier: ADMIN.email, password: ADMIN.password },
    });
    expect(demoAdmin.ok()).toBeTruthy();
    const ajeno = (await pageState(otra.page)).state.appointments.find((a) => a.status === "confirmado")!;
    await otra.context.close();

    const res = await page.request.post("/api/commands", {
      data: { command: { type: "appointment.cancel", id: ajeno.id } },
    });
    expect(res.status()).toBe(404);
  });

  test("un barbero trabaja en una sola barbería: su email no abre otra", async ({ request }) => {
    const res = await request.post("/api/shops", {
      data: {
        name: "Barbería Duplicada",
        address: "Calle 1",
        whatsapp: "+54 9 11 6500 0000",
        ownerName: "Diego Sosa",
        identifier: ADMIN.email,
        password: "otra-clave-2026",
      },
    });
    expect(res.status()).toBe(409);
  });

  test("una sola cuenta de cliente se suma a las dos barberías y pasa de una a otra", async ({ browser }) => {
    // Dispositivo nuevo, sin link de ningún local: con dos barberías publicadas no hay una implícita.
    const { context, page } = await newDevice(browser);
    await page.goto("/auth/registro");
    await page.getByLabel("Nombre y apellido").fill("Julia Paz");
    await page.getByLabel("Email").fill("julia.paz@example.com");
    await page.getByLabel("Celular").fill("+54 9 11 8888 7777");
    await page.getByLabel("Contraseña", { exact: true }).fill("julia-2026");
    await page.getByLabel("Repetir contraseña").fill("julia-2026");
    await page.getByLabel(/Acepto las/).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    // Todavía no eligió dónde se atiende: primero eso.
    await page.waitForURL("**/cliente/barberias");
    const lista = page.getByRole("list", { name: "Barberías" });
    await lista.getByRole("button", { name: /D\.S Studio/ }).click();
    await expect(lista.getByRole("button", { name: /D\.S Studio/ })).toHaveAttribute("aria-pressed", "true");
    await lista.getByRole("button", { name: new RegExp(NUEVA.name) }).click();
    await expect(lista.getByRole("button", { name: new RegExp(NUEVA.name) })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.waitForURL("**/cliente/reservar");

    let { session } = await pageState(page);
    expect(session?.shop.slug).toBe(SHOP_SLUG);
    expect(session?.shops?.map((s) => s.slug).sort()).toEqual([NUEVA.slug, SHOP_SLUG].sort());

    // Pasa a la otra desde el encabezado: ve los datos de esa barbería.
    await page.getByRole("button", { name: /Barbería activa/ }).click();
    await page.getByRole("dialog", { name: "Tus barberías" }).getByRole("button", { name: new RegExp(NUEVA.name) }).click();
    await expect(page.getByRole("button", { name: `Barbería activa: ${NUEVA.name}` })).toBeVisible();
    ({ session } = await pageState(page));
    expect(session?.shop.slug).toBe(NUEVA.slug);
    const { state } = await pageState(page);
    expect(state.businessInfo.name).toBe(NUEVA.name);
    // Cada barbería tiene su propia ficha del cliente.
    expect(state.clients).toEqual([expect.objectContaining({ name: "Julia Paz", phone: "+54 9 11 8888 7777" })]);
    await context.close();
  });

  test("el link de una barbería lleva al ingreso parado en ella", async ({ browser }) => {
    const { context, page } = await newDevice(browser);
    await openShop(page, NUEVA.slug);
    await page.waitForURL("**/auth/login**");
    await expect(page.getByText(`Reservá tu turno en ${NUEVA.name}`)).toBeVisible();
    await context.close();
  });

  test("un slug inexistente vuelve al ingreso", async ({ browser }) => {
    const { context, page } = await newDevice(browser);
    await page.goto("/b/no-existe-esta-barberia");
    await expect(page.getByRole("heading", { name: "Ingresá a tu cuenta" })).toBeVisible();
    await context.close();
  });
});
