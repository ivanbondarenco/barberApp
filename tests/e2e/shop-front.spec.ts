import { expect, test } from "@playwright/test";
import { adminApi, chooseDayAhead, loginAsAdmin, loginAsClient, newDevice, openShop, pageState, pickFirstSlot, resetData, runCommand, SHOP_SLUG } from "./helpers";

test.beforeAll(resetData);

test.describe("carta pública del local", () => {
  test("el link del local lleva directo a reservar, sin cuenta", async ({ browser }) => {
    const { context, page } = await newDevice(browser);
    // Llega por el link que comparte la barbería, sin sesión.
    await page.goto(`/b/${SHOP_SLUG}`);
    await page.waitForURL("**/reservar");
    await expect(page.getByRole("heading", { name: "¿Qué te hacés?" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Corte Clásico Tijera/ })).toBeVisible();
    await context.close();
  });

  test("reserva sin cuenta: servicio, horario, nombre y celular, y paga la seña en el local", async ({ browser }) => {
    const { context, page } = await newDevice(browser);
    await page.goto(`/b/${SHOP_SLUG}`);
    await page.waitForURL("**/reservar");

    await page.getByRole("radio", { name: /Corte Clásico Tijera/ }).click();
    await expect(page.getByRole("heading", { name: "¿Cuándo venís?" })).toBeVisible();
    // Con días de anticipación: la seña en el local tiene plazo, y hoy ya puede haber pasado.
    await chooseDayAhead(page, 3);
    const time = await pickFirstSlot(page);
    await page.getByRole("button", { name: new RegExp(`Continuar · ${time}`) }).click();
    await expect(page.getByRole("heading", { name: "Confirmá tu turno" })).toBeVisible();

    // Lo único que se le pide: nombre y celular. Y la seña, online o en el local.
    await page.getByRole("radio", { name: /Pagar en el local/ }).click();
    await page.getByRole("button", { name: "Reservar turno" }).click();
    await expect(page.getByText("Ingresá tu nombre")).toBeVisible();

    await page.getByLabel("Nombre").fill("Lucas Invitado");
    await page.getByLabel("Celular").fill("11 4444 7788");
    await page.getByRole("button", { name: "Reservar turno" }).click();

    await page.waitForURL(/\/reserva\/pendiente\?turno=.+&t=/);
    await expect(page.getByRole("heading", { name: "Turno reservado" })).toBeVisible();
    await expect(page.getByText(`${time} hs`)).toBeVisible();
    await expect(page.getByText("A nombre de Lucas Invitado")).toBeVisible();

    // El local lo ve en su agenda, con la seña pendiente y sin verificar.
    const id = new URL(page.url()).searchParams.get("turno")!;
    const api = await adminApi();
    const res = await api.get("/api/state");
    const { state } = (await res.json()) as { state: { appointments: { id: string; clientName: string; verified: boolean; deposit: { status: string; method: string } }[] } };
    expect(state.appointments.find((a) => a.id === id)).toMatchObject({
      clientName: "Lucas Invitado",
      verified: false,
      deposit: { status: "pendiente", method: "efectivo" },
    });
    await api.dispose();

    // Sin el token, nadie más puede ver la reserva.
    const leaked = await page.request.get(`/api/reservas?turno=${id}&t=otro`);
    expect(leaked.status()).toBe(404);

    // Después de reservar se lo invita a crear la cuenta: nombre y celular ya vienen cargados.
    await page.getByRole("link", { name: "Crear mi cuenta" }).click();
    await page.waitForURL("**/auth/registro?desde=reserva");
    await expect(page.getByLabel("Nombre y apellido")).toHaveValue("Lucas Invitado");
    await expect(page.getByLabel("Celular")).toHaveValue("11 4444 7788");
    await page.getByLabel("Email").fill("lucas.invitado@example.com");
    await page.getByLabel("Contraseña", { exact: true }).fill("clave-segura-1");
    await page.getByLabel("Repetir contraseña").fill("clave-segura-1");
    await page.getByLabel(/Acepto las/).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    // El turno que reservó como invitado ya está en su cuenta.
    await page.waitForURL("**/cliente/mis-turnos");
    const { session, state: mine } = await pageState(page);
    expect(mine.appointments.find((a) => a.id === id)).toMatchObject({ clientId: session?.clientId, clientName: "Lucas Invitado" });
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

    // Y reserva sin crear cuenta.
    await page.getByRole("link", { name: /Reservar turno/ }).click();
    await page.waitForURL("**/reservar");
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
