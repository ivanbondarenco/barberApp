import { expect, test } from "@playwright/test";
import { ADMIN, captureOtp, CLIENT, fillLogin, loginAsAdmin, loginAsClient, openShop, pageState, resetData } from "./helpers";

test.beforeAll(resetData);

/** Cuenta que crea el test de registro y usan los de recuperación. */
const BRUNO = { name: "Bruno Díaz", email: "bruno.diaz@example.com", phone: "+54 9 11 2222 3333", password: "bruno-2026" };

test.describe("Landing", () => {
  test("sin sesión, la portada presenta la app y el alta se abre en un modal", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Una sola agenda");
    await expect(page.getByText("2 cortes", { exact: false }).first()).toBeVisible();
    await page.getByRole("link", { name: "Probar la demo gratis" }).first().click();
    const signup = page.getByRole("dialog", { name: "Registrar mi barbería" });
    await expect(signup.getByLabel("Nombre de la barbería")).toBeVisible();
    // Sigue en la portada: el modal no navega.
    expect(new URL(page.url()).pathname).toBe("/");

    // Los términos se abren encima del alta, sin perder lo que ya se escribió.
    await signup.getByLabel("Nombre de la barbería").fill("Barbería del Modal");
    await signup.getByRole("link", { name: "términos y condiciones" }).click();
    const terms = page.getByRole("dialog", { name: "Términos y condiciones" });
    await expect(terms.getByText("1 mes de prueba gratis")).toBeVisible();
    await terms.getByRole("button", { name: "Entendido" }).click();
    await expect(terms).toBeHidden();
    await expect(signup.getByLabel("Nombre de la barbería")).toHaveValue("Barbería del Modal");
  });

  test("el alta desde el modal crea la barbería y entra al panel", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Empezar mi prueba gratis" }).click();
    const signup = page.getByRole("dialog", { name: "Registrar mi barbería" });
    await signup.getByLabel("Nombre de la barbería").fill("Barbería del Modal");
    await signup.getByLabel("Dirección").fill("Av. Corrientes 1234");
    await signup.getByLabel("Tu número de teléfono").fill("11 4444 5555");
    await signup.getByLabel("Tu nombre").fill("Dueño del Modal");
    await signup.getByLabel("Tu email").fill("modal@example.com");
    await signup.getByLabel("Contraseña", { exact: true }).fill("modal-2026");
    await signup.getByLabel("Repetir contraseña").fill("modal-2026");
    await page.getByRole("button", { name: "Crear barbería" }).click();
    await page.waitForURL("**/admin/agenda");
  });

  test("el alta no deja escribir letras en el teléfono ni números en el nombre", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Probar la demo gratis" }).first().click();
    const signup = page.getByRole("dialog", { name: "Registrar mi barbería" });
    await signup.getByLabel("Tu número de teléfono").pressSequentially("11abc3096x9716");
    await expect(signup.getByLabel("Tu número de teléfono")).toHaveValue("1130969716");
    await signup.getByLabel("Tu nombre").pressSequentially("Iván2 Pérez");
    await expect(signup.getByLabel("Tu nombre")).toHaveValue("Iván Pérez");
    await signup.getByLabel("Dirección").fill("Corrientes");
    await signup.getByLabel("Tu nombre").click();
    await expect(signup.getByText("Incluí la altura")).toBeVisible();
  });

  test("el pie abre los términos y la privacidad en un modal", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name: "Términos" }).click();
    await expect(page.getByRole("dialog", { name: "Términos y condiciones" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("contentinfo").getByRole("link", { name: "Privacidad" }).click();
    await expect(page.getByRole("dialog", { name: "Política de privacidad" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("el link directo a los términos sigue siendo una página", async ({ page }) => {
    await page.goto("/terminos");
    await expect(page.getByRole("heading", { name: "Términos y condiciones" })).toBeVisible();
  });

  test("Ingresar lleva al formulario de ingreso", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Ingresar" }).click();
    await expect(page.getByRole("heading", { name: "Ingresá a tu cuenta" })).toBeVisible();
  });
});

test.describe("Ingreso", () => {
  test("el ingreso muestra las dos solapas", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("heading", { name: "Ingresá a tu cuenta" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Soy cliente" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("¿No tenés cuenta?")).toBeVisible();

    // El staff ve la opción de crear su barbería.
    await page.getByRole("tab", { name: "Soy barbero" }).click();
    await expect(page.getByText("¿No creaste tu barbería?")).toBeVisible();
    await page.getByRole("link", { name: "Creala" }).click();
    await expect(page.getByRole("dialog", { name: "Registrar mi barbería" }).getByLabel("Nombre de la barbería")).toBeVisible();
  });

  test("recuerda la última solapa usada", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("tab", { name: "Soy barbero" }).click();
    await page.reload();
    await expect(page.getByRole("tab", { name: "Soy barbero" })).toHaveAttribute("aria-selected", "true");
  });

  test("cliente ingresa con email y contraseña", async ({ page }) => {
    await loginAsClient(page);
    await expect(page.getByRole("heading", { name: "¿Qué te hacés?" })).toBeVisible();
    const { session } = await pageState(page);
    expect(session).toMatchObject({ role: "cliente", clientId: "c-demo", shop: { slug: "ds-studio" } });
  });

  test("barbero ingresa con email y contraseña", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
    expect((await pageState(page)).session?.role).toBe("admin");
  });

  test("contraseña incorrecta muestra un error claro y no inicia sesión", async ({ page }) => {
    await page.goto("/auth/login");
    await fillLogin(page, "cliente", CLIENT.email, "no-es-esta");
    await expect(page.getByRole("alert").filter({ hasText: "Email o contraseña incorrectos" })).toBeVisible();
    expect((await pageState(page)).session).toBeNull();
  });

  test("valida el formulario antes de enviar", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByText("Ingresá tu email")).toBeVisible();
    await expect(page.getByText("Ingresá tu contraseña")).toBeVisible();
  });

  test("una cuenta de cliente no entra como barbero", async ({ page }) => {
    await page.goto("/auth/login");
    await fillLogin(page, "barbero", CLIENT.email, CLIENT.password);
    await expect(page.getByRole("alert").filter({ hasText: "Email o contraseña incorrectos" })).toBeVisible();
  });

  test("varios intentos fallidos no bloquean el ingreso", async ({ request }) => {
    for (let i = 0; i < 7; i++) {
      const res = await request.post("/api/auth/login", { data: { role: "cliente", identifier: CLIENT.email, password: "equivocada" } });
      expect(res.status()).toBe(401);
    }
    const ok = await request.post("/api/auth/login", { data: { role: "cliente", identifier: CLIENT.email, password: CLIENT.password } });
    expect(ok.status()).toBe(200);
  });

  test("mostrar y ocultar la contraseña", async ({ page }) => {
    await page.goto("/auth/login");
    const password = page.getByLabel("Contraseña", { exact: true });
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Mostrar contraseña" }).click();
    await expect(password).toHaveAttribute("type", "text");
  });
});

test.describe("Sesión y rutas protegidas", () => {
  test("sin sesión, las pantallas privadas llevan al ingreso", async ({ page }) => {
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

  test("con sesión abierta, abrir la app lleva a su pantalla", async ({ page }) => {
    await loginAsClient(page);
    await page.goto("/");
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

test.describe("Registro y recuperación", () => {
  test("crea una cuenta con email y contraseña desde el link de la barbería", async ({ page }) => {
    await openShop(page);
    await page.goto("/auth/registro");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Ingresá nombre y apellido")).toBeVisible();

    await page.getByLabel("Nombre y apellido").fill(BRUNO.name);
    await page.getByLabel("Email").fill(BRUNO.email);
    await page.getByLabel("Celular").fill(BRUNO.phone);
    await page.getByLabel("Contraseña", { exact: true }).fill("corta");
    await page.getByLabel("Repetir contraseña").fill("corta");
    await page.getByLabel(/Acepto las/).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Usá al menos 8 caracteres")).toBeVisible();

    await page.getByLabel("Contraseña", { exact: true }).fill(BRUNO.password);
    await page.getByLabel("Repetir contraseña").fill(BRUNO.password);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    // Llegó por el link del local: ya queda sumado a esa barbería y va directo a reservar.
    await page.waitForURL("**/cliente/reservar");
    const { session, state } = await pageState(page);
    expect(session).toMatchObject({ name: BRUNO.name, identifier: BRUNO.email, shop: { slug: "ds-studio" } });
    expect(state.clients[0]).toMatchObject({ name: BRUNO.name, phone: BRUNO.phone, credit: 0 });
  });

  test("no permite registrar un email que ya tiene cuenta", async ({ request }) => {
    const res = await request.post("/api/auth/register", {
      data: { name: "Otro Tomás", email: CLIENT.email.toUpperCase(), phone: "+54 9 11 8888 0000", password: "otra-clave" },
    });
    expect(res.status()).toBe(409);
  });

  test("recupera la contraseña y entra con la nueva", async ({ page }) => {
    await page.goto("/auth/recuperar");
    await page.getByLabel("Email de tu cuenta").fill(BRUNO.email);
    const code = await captureOtp(page, "/api/auth/recover", () => page.getByRole("button", { name: "Enviar código" }).click());
    await page.getByLabel("Código").fill("000000");
    await page.getByRole("button", { name: "Verificar" }).click();
    await expect(page.getByText("Código incorrecto")).toBeVisible();

    await page.getByLabel("Código").fill(code);
    await page.getByRole("button", { name: "Verificar" }).click();
    await page.getByLabel("Nueva contraseña").fill("corta");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page.getByText("Usá al menos 8 caracteres")).toBeVisible();
    await page.getByLabel("Nueva contraseña").fill("bruno-nueva-2026");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page.getByText("Contraseña actualizada")).toBeVisible();

    // El código ya se usó: no sirve para cambiarla de nuevo.
    const reuse = await page.request.post("/api/auth/recover", {
      data: { role: "cliente", identifier: BRUNO.email, code, password: "otra-mas-2026" },
    });
    expect(reuse.status()).toBe(401);

    await loginAsClient(page, BRUNO.email, "bruno-nueva-2026");
  });

  test("un código equivocado se bloquea tras varios intentos", async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: "http://localhost:3210" });
    const pedido = { role: "cliente", identifier: CLIENT.email };
    const emitido = (await (await api.post("/api/auth/recover", { data: pedido })).json()) as { code?: string };
    expect(emitido.code).toBeTruthy();

    for (let i = 0; i < 5; i++) {
      const res = await api.post("/api/auth/recover", { data: { ...pedido, code: "000000" } });
      expect(res.status()).toBe(401);
    }
    // Agotados los intentos, ni el código bueno sirve: hay que pedir otro.
    const blocked = await api.post("/api/auth/recover", { data: { ...pedido, code: emitido.code } });
    expect([401, 429]).toContain(blocked.status());
    // Y el cooldown impide pedir uno nuevo enseguida.
    expect((await api.post("/api/auth/recover", { data: pedido })).status()).toBe(429);
    await api.dispose();
  });

  test("el admin demo sigue funcionando", async ({ request }) => {
    const res = await request.post("/api/auth/login", { data: { role: "staff", identifier: ADMIN.email, password: ADMIN.password } });
    expect(res.ok()).toBeTruthy();
  });
});
