import { expect, test } from "@playwright/test";
import { adminApi, loginAsAdmin, loginAsClient, newDevice, openShop, pageState, resetData, runCommand, SHOP_SLUG } from "./helpers";

test.beforeAll(resetData);

test.describe("carta pública del local", () => {
  test("el link del local lleva directo al ingreso como cliente de esa barbería", async ({ browser }) => {
    const { context, page } = await newDevice(browser);
    // Llega por el link que comparte la barbería, sin sesión.
    await page.goto(`/b/${SHOP_SLUG}`);
    await page.waitForURL("**/auth/login**");

    await expect(page.getByRole("heading", { name: "Ingresá a tu cuenta" })).toBeVisible();
    // Parado en esa barbería y con la solapa de cliente abierta, sin pasar por la carta.
    await expect(page.getByText(/Reservá tu turno en D\.S Studio/)).toBeVisible();
    await expect(page.getByRole("tab", { name: "Soy cliente" })).toHaveAttribute("aria-selected", "true");
    await context.close();
  });

  test("la carta pública muestra servicios, precios y horarios", async ({ browser }) => {
    const { context, page } = await newDevice(browser);
    // Ya no es el destino del link: se abre por su propia URL, con la barbería en la cookie.
    await page.goto(`/b/${SHOP_SLUG}`);
    await page.goto("/local");

    await expect(page.getByRole("heading", { name: /D\.S Studio/ })).toBeVisible();
    // Lo que la gente viene a ver: qué hacen y cuánto sale.
    await expect(page.getByText("Corte Clásico Tijera")).toBeVisible();
    await expect(page.getByText("$9.500")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Horarios" })).toBeVisible();
    await expect(page.getByText("Domingo")).toBeVisible();
    await expect(page.getByText(/seña del 50%/i)).toBeVisible();

    // Y recién ahí se le pide cuenta.
    await page.getByRole("link", { name: /Reservar turno/ }).click();
    await page.waitForURL("**/auth/login");
    await context.close();
  });

  test("con sesión, la carta lleva directo a la app", async ({ page }) => {
    await loginAsClient(page);
    await page.goto("/local");
    await page.getByRole("link", { name: /Ir a mi cuenta/ }).click();
    await page.waitForURL("**/cliente/reservar");
  });

  test("el dueño encuentra y copia su link para compartir", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await loginAsAdmin(page);
    await page.goto("/admin/configuracion");

    await expect(page.getByText("Tu link para compartir")).toBeVisible();
    await expect(page.getByText(`/b/${SHOP_SLUG}`)).toBeVisible();

    // Acotado al contenido: el aviso de "Copiado" también aparece en el toast.
    await page.getByRole("main").getByRole("button", { name: "Copiar" }).click();
    await expect(page.getByRole("main").getByRole("button", { name: "Copiado" })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain(`/b/${SHOP_SLUG}`);
  });
});

test.describe("reseñas", () => {
  test("el cliente califica su turno y el rating aparece en la carta pública", async ({ page, browser }) => {
    // El local cobra el turno del cliente demo para dejarlo terminado.
    const api = await adminApi();
    const before = (await (await api.get("/api/state")).json()) as {
      state: { appointments: { id: string; clientId?: string; barberId: string; status: string }[] };
    };
    const target = before.state.appointments.find((a) => a.clientId === "c-demo" && a.status === "confirmado")!;
    expect(target).toBeDefined();
    expect((await runCommand(api, { type: "appointment.charge", id: target.id, method: "efectivo" })).status).toBe(200);
    await api.dispose();

    await loginAsClient(page);
    await page.goto(`/cliente/turno/${target.id}`);
    await expect(page.getByText(/¿Cómo estuvo tu corte/)).toBeVisible();
    await page.getByRole("radio", { name: "5 estrellas" }).click();
    await expect(page.getByText("Gracias por tu reseña")).toBeVisible();

    await expect
      .poll(async () => (await pageState(page)).state.appointments.find((a) => a.id === target.id)?.rating)
      .toBe(5);

    // Ya calificado, no se puede volver a calificar.
    const again = await page.request.post("/api/commands", {
      data: { command: { type: "appointment.rate", id: target.id, rating: 1 } },
    });
    expect(again.status()).toBe(400);

    // Y el número que ve un visitante sale de esa reseña real.
    const { context, page: visitor } = await newDevice(browser);
    await openShop(visitor);
    await visitor.goto("/local");
    await expect(visitor.getByText(/5\.0 · 1 reseña/)).toBeVisible();
    await context.close();
  });

  test("el local no puede calificarse a sí mismo", async ({ page }) => {
    await loginAsAdmin(page);
    const { state } = await pageState(page);
    const completed = state.appointments.find((a) => a.status === "completado")!;
    const res = await page.request.post("/api/commands", {
      data: { command: { type: "appointment.rate", id: completed.id, rating: 5 } },
    });
    expect(res.status()).toBe(403);
  });
});
