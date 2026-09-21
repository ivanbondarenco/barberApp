import { expect, test, type APIRequestContext } from "@playwright/test";
import { ADMIN, captureOtp, CLIENT, SHOP_SLUG, loginAsAdmin, loginAsClient, openShop, pageState, resetData } from "./helpers";

test.beforeAll(resetData);

test.describe("Ingreso", () => {
  test("cliente ingresa con celular y PIN", async ({ page }) => {
    await loginAsClient(page);
    await expect(page.getByRole("heading", { name: "¿Qué te hacés?" })).toBeVisible();
    const { session } = await pageState(page);
    expect(session).toMatchObject({ role: "cliente", clientId: "c-demo" });
  });

  test("barbero ingresa con email y PIN", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
    expect((await pageState(page)).session?.role).toBe("admin");
  });

  test("PIN incorrecto muestra un error claro y no inicia sesión", async ({ page }) => {
    await openShop(page);
    await page.goto("/auth/login");
    await page.getByLabel("Celular o email").fill(CLIENT.phone);
    await page.getByLabel("PIN", { exact: true }).fill("0000");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Datos incorrectos" })).toBeVisible();
    await expect(page).toHaveURL(/auth\/login/);
    expect((await pageState(page)).session).toBeNull();
  });

  test("valida el formulario antes de enviar", async ({ page }) => {
    await openShop(page);
    await page.goto("/auth/login");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByText("Ingresá tu celular o email")).toBeVisible();
    await expect(page.getByText("El PIN tiene 4 dígitos")).toBeVisible();
  });

  test("una cuenta de cliente no entra como barbero", async ({ page }) => {
    await openShop(page);
    await page.goto("/auth/login");
    await page.getByRole("tab", { name: "Soy barbero" }).click();
    await page.getByLabel("Email").fill(CLIENT.phone);
    await page.getByLabel("PIN", { exact: true }).fill(CLIENT.pin);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Datos incorrectos" })).toBeVisible();
  });

  test("bloquea el usuario tras 5 intentos fallidos", async ({ request }) => {
    const identifier = "+54 9 11 9999 0001";
    for (let i = 0; i < 5; i++) {
      const res = await request.post("/api/auth/login", { data: { role: "cliente", identifier, pin: "1111" } });
      expect(res.status()).toBe(401);
    }
    const locked = await request.post("/api/auth/login", { data: { role: "cliente", identifier, pin: "1111" } });
    expect(locked.status()).toBe(429);
  });

  test("mostrar y ocultar el PIN", async ({ page }) => {
    await openShop(page);
    await page.goto("/auth/login");
    const pin = page.getByLabel("PIN", { exact: true });
    await expect(pin).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Mostrar PIN" }).click();
    await expect(pin).toHaveAttribute("type", "text");
  });
});

test.describe("Sesión y rutas protegidas", () => {
  test("sin sesión, las pantallas privadas llevan al login", async ({ page }) => {
    await page.goto("/cliente/perfil");
    await page.waitForURL("**/auth/login");
    await page.goto("/admin/agenda");
    await page.waitForURL("**/auth/login");
  });

  test("un cliente no accede al panel del barbero", async ({ page }) => {
    await loginAsClient(page);
    await page.goto("/admin/agenda");
    await page.waitForURL("**/cliente/reservar");
  });

  test("la sesión se mantiene al recargar y se cierra desde el menú", async ({ page }) => {
    await loginAsClient(page);
    await page.reload();
    await expect(page).toHaveURL(/cliente\/reservar/);
    await page.getByRole("button", { name: "Abrir menú de cuenta" }).click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await page.waitForURL("**/auth/login");
    expect((await pageState(page)).session).toBeNull();
    await page.goto("/cliente/mis-turnos");
    await page.waitForURL("**/auth/login");
  });

  test("la cookie de sesión es httpOnly", async ({ page, context }) => {
    await loginAsAdmin(page);
    const cookie = (await context.cookies()).find((c) => c.name === "ds_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(await page.evaluate(() => document.cookie)).not.toContain("ds_session");
  });
});

test.describe("Registro, código y recuperación", () => {
  test("crea una cuenta nueva verificando el código", async ({ page }) => {
    await openShop(page);
    await page.goto("/auth/registro");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Ingresá nombre y apellido")).toBeVisible();

    await page.getByLabel("Nombre y apellido").fill("Bruno Díaz");
    await page.getByLabel("Celular").fill("+54 9 11 2222 3333");
    await page.getByLabel("PIN", { exact: true }).fill("4826");
    await page.getByLabel("Repetir PIN").fill("4826");
    await page.getByLabel(/Acepto las/).check();
    const code = await captureOtp(page, "/api/auth/register", () =>
      page.getByRole("button", { name: "Continuar" }).click(),
    );

    await page.getByLabel("Código").fill("000000");
    await page.getByRole("button", { name: "Verificar y crear cuenta" }).click();
    await expect(page.getByText("Código incorrecto")).toBeVisible();

    await page.getByLabel("Código").fill(code);
    await page.getByRole("button", { name: "Verificar y crear cuenta" }).click();
    await page.waitForURL("**/cliente/reservar");
    const { session, state } = await pageState(page);
    expect(session?.name).toBe("Bruno Díaz");
    expect(state.clients[0]).toMatchObject({ name: "Bruno Díaz", credit: 0 });
  });

  test("no permite registrar un celular que ya tiene cuenta", async ({ request }) => {
    await request.get(`/b/${SHOP_SLUG}`);
    // Se rechaza antes de gastar un envío de WhatsApp, así que ni siquiera pide código.
    const res = await request.post("/api/auth/register", {
      data: { name: "Otro Tomás", phone: CLIENT.phone, pin: "5678" },
    });
    expect(res.status()).toBe(409);
  });

  /** Pide un código por API y lo devuelve (el servidor de los tests corre con OTP_DEBUG). */
  async function requestOtp(api: APIRequestContext, phone: string): Promise<string> {
    const res = await api.post("/api/auth/otp", { data: { phone } });
    const body = (await res.json()) as { code?: string; error?: string };
    expect(body.code, `el servidor debía emitir un código (${body.error ?? "sin error"})`).toBeTruthy();
    return body.code!;
  }

  test("un código no sirve para otro trámite ni después de usarse", async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: "http://localhost:3210" });
    await api.get(`/b/${SHOP_SLUG}`);

    // Código pedido para "acceso": no vale para recuperar el PIN.
    const acceso = await requestOtp(api, CLIENT.phone);
    const cruzado = await api.post("/api/auth/recover", { data: { identifier: CLIENT.phone, code: acceso } });
    expect(cruzado.status()).toBe(401);

    // Entra una vez…
    expect((await api.post("/api/auth/otp", { data: { phone: CLIENT.phone, code: acceso } })).ok()).toBeTruthy();
    // …y ya no se puede reusar.
    expect((await api.post("/api/auth/otp", { data: { phone: CLIENT.phone, code: acceso } })).status()).toBe(401);
    await api.dispose();
  });

  test("un código equivocado no entra y se bloquea tras varios intentos", async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: "http://localhost:3210" });
    await api.get(`/b/${SHOP_SLUG}`);
    // Otro celular, para no chocar con el cooldown del test anterior.
    const phone = "+54 9 11 4444 5555";
    const alta = { name: "Fuerza Bruta", phone, pin: "1357" };
    // Un solo pedido: pedir otro código antes del minuto está bloqueado a propósito.
    const emitido = (await (await api.post("/api/auth/register", { data: alta })).json()) as { code?: string };
    expect(emitido.code).toBeTruthy();

    for (let i = 0; i < 5; i++) {
      const res = await api.post("/api/auth/register", { data: { ...alta, code: "000000" } });
      expect(res.status()).toBe(401);
    }
    // Agotados los intentos, ni el código bueno sirve: hay que pedir otro.
    const blocked = await api.post("/api/auth/register", { data: { ...alta, code: emitido.code } });
    expect([401, 429]).toContain(blocked.status());

    // Y el cooldown impide pedir uno nuevo enseguida.
    expect((await api.post("/api/auth/register", { data: alta })).status()).toBe(429);
    await api.dispose();
  });

  test("ingresa con código por WhatsApp", async ({ page }) => {
    await openShop(page);
    await page.goto("/auth/login");
    await page.getByRole("button", { name: "Entrar con código" }).click();
    const dialog = page.getByRole("dialog", { name: "Entrar con código" });
    await dialog.getByLabel("Celular").fill(CLIENT.phone);
    const code = await captureOtp(page, "/api/auth/otp", () =>
      dialog.getByRole("button", { name: "Enviar código" }).click(),
    );
    await dialog.getByLabel(/Código enviado/).fill(code);
    await dialog.getByRole("button", { name: "Verificar" }).click();
    await page.waitForURL("**/cliente/reservar");
  });

  test("recupera el PIN y entra con el nuevo", async ({ page }) => {
    await openShop(page);
    await page.goto("/auth/recuperar");
    await page.getByLabel("Celular o email de tu cuenta").fill("+54 9 11 2222 3333");
    const code = await captureOtp(page, "/api/auth/recover", () =>
      page.getByRole("button", { name: "Enviar código" }).click(),
    );
    await page.getByLabel("Código").fill(code);
    await page.getByRole("button", { name: "Verificar" }).click();
    await page.getByLabel("Nuevo PIN").fill("1234");
    await page.getByRole("button", { name: "Guardar PIN" }).click();
    await expect(page.getByText("Elegí un PIN menos predecible")).toBeVisible();
    await page.getByLabel("Nuevo PIN").fill("7391");
    await page.getByRole("button", { name: "Guardar PIN" }).click();
    await expect(page.getByText("PIN actualizado")).toBeVisible();

    await loginAsClient(page, "+54 9 11 2222 3333", "7391");
  });

  test("el admin demo sigue funcionando", async ({ request }) => {
    const res = await request.post("/api/auth/login", { data: { role: "admin", identifier: ADMIN.email, pin: ADMIN.pin } });
    expect(res.ok()).toBeTruthy();
  });
});
