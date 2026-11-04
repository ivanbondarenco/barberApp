import { expect, test, type Page } from "@playwright/test";
import { adminApi, fillLogin, loginAsAdmin, loginAsClient, newDevice, pageState, resetData, runCommand } from "./helpers";

test.beforeAll(resetData);

const BARBER = { name: "Nico", email: "nico@dsstudio.com.ar", password: "nico-2026" };

async function loginAsBarber(page: Page) {
  await page.goto("/auth/login");
  await fillLogin(page, "barbero", BARBER.email, BARBER.password);
  await page.waitForURL("**/admin/agenda");
}

test.describe.serial("cuentas de barbero", () => {
  test("el dueño le da acceso a un barbero desde el equipo", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/equipo");
    await page.getByRole("main").getByRole("button", { name: new RegExp(BARBER.name) }).click();

    const form = page.getByRole("dialog", { name: "Editar barbero" });
    await form.getByLabel("Email o celular").fill(BARBER.email);
    await form.getByLabel("Contraseña inicial").fill(BARBER.password);
    await form.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(form).toBeHidden();

    await expect.poll(async () => {
      const state = (await pageState(page)).state as unknown as { barbers: { id: string; hasAccount?: boolean }[] };
      return state.barbers.find((b) => b.id === "b-nico")?.hasAccount;
    }).toBe(true);
  });

  test("el barbero entra y ve solo su agenda", async ({ page }) => {
    await loginAsBarber(page);

    const { session, state } = await pageState(page);
    expect(session?.role).toBe("barbero");

    // Los turnos de otros sillones llegan sin datos del cliente.
    const own = state.appointments.filter((a) => a.clientName !== "");
    expect(own.length).toBeGreaterThan(0);
    const mine = new Set(own.map((a) => a.id));
    const others = state.appointments.filter((a) => !mine.has(a.id));
    for (const a of others) expect(a.clientName).toBe("");
  });

  test("el barbero no tiene finanzas ni catálogo", async ({ page }) => {
    await loginAsBarber(page);

    for (const label of ["Finanzas", "Catálogo", "Tienda"]) {
      await expect(page.getByRole("navigation").getByRole("link", { name: label })).toBeHidden();
    }

    // Entrar por URL tampoco sirve: vuelve a su agenda.
    for (const path of ["/admin/finanzas", "/admin/servicios", "/admin/configuracion", "/admin/equipo"]) {
      await page.goto(path);
      await page.waitForURL("**/admin/agenda");
    }
  });

  test("el servidor rechaza los comandos del dueño aunque los mande un barbero", async ({ page }) => {
    await loginAsBarber(page);
    for (const command of [
      { type: "settings.deposit", allowCash: false },
      { type: "service.delete", id: "s-tijera" },
      { type: "barber.delete", id: "b-diego" },
      { type: "settings.info", patch: { address: "hackeado" } },
    ]) {
      const res = await page.request.post("/api/commands", { data: { command } });
      expect(res.status(), `${command.type} debería estar reservado al dueño`).toBe(403);
    }
  });

  test("el barbero no puede operar el turno de otro sillón", async ({ page }) => {
    await loginAsBarber(page);
    const { state } = await pageState(page);
    // Un turno anonimizado es, por definición, de otro sillón.
    const foreign = state.appointments.find((a) => a.clientName === "" && a.status === "confirmado")!;
    expect(foreign).toBeDefined();

    const res = await page.request.post("/api/commands", {
      data: { command: { type: "appointment.charge", id: foreign.id, method: "efectivo" } },
    });
    expect(res.status()).toBe(403);
  });

  test("el dueño le puede quitar el acceso", async ({ page, browser }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/equipo");
    await page.getByRole("main").getByRole("button", { name: new RegExp(BARBER.name) }).click();
    const form = page.getByRole("dialog", { name: "Editar barbero" });
    await form.getByLabel("Email o celular").fill("");
    await form.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(form).toBeHidden();

    await expect.poll(async () => {
      const state = (await pageState(page)).state as unknown as { barbers: { id: string; hasAccount?: boolean }[] };
      return state.barbers.find((b) => b.id === "b-nico")?.hasAccount;
    }).toBe(false);

    // Y ya no entra. Hace falta un dispositivo limpio: esta pestaña sigue siendo la del dueño.
    const { context, page: fresh } = await newDevice(browser);
    await fresh.goto("/auth/login");
    await fillLogin(fresh, "barbero", BARBER.email, BARBER.password);
    await expect(fresh.getByText(/Email o contraseña incorrectos/)).toBeVisible();
    await context.close();
  });
});

test.describe("ausencias y recordatorios", () => {
  test("marcar ausente retiene la seña y no genera crédito", async ({ page }) => {
    await loginAsAdmin(page);
    const api = await adminApi();

    // Para marcar una ausencia el turno tiene que haber empezado. En vez de depender de la
    // hora a la que corran los tests, se agenda uno en una fecha ya pasada: es lo que hace el
    // local cuando carga a mano un turno que ya ocurrió.
    const pad = (n: number) => String(n).padStart(2, "0");
    const day = new Date();
    do {
      day.setDate(day.getDate() - 1);
    } while (day.getDay() === 0); // el local cierra los domingos
    const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;

    const id = `a-noshow-${Date.now()}`;
    const booked = await runCommand(api, {
      type: "appointment.book",
      payload: {
        id,
        newClientId: `c-noshow-${Date.now()}`,
        clientName: "Tomás Ferreyra",
        clientPhone: "+54 9 11 5555-0192", // el cliente demo: así se puede mirar su crédito
        barberId: "b-nico",
        serviceId: "s-tijera",
        date,
        time: "10:00",
        depositMethod: "efectivo",
        depositPaid: true,
      },
    });
    await api.dispose();
    expect(booked.status, JSON.stringify(booked.body)).toBe(200);

    const before = (await pageState(page)).state;
    const target = before.appointments.find((a) => a.id === id)!;
    expect(target.deposit.status).toBe("abonada");
    const creditBefore = before.clients.find((c) => c.id === target.clientId)?.credit ?? 0;

    await page.goto(`/admin/turno/${id}`);
    await page.getByRole("button", { name: "No vino" }).click();
    const dialog = page.getByRole("alertdialog", { name: "¿El cliente no se presentó?" });
    await expect(dialog).toContainText("queda para el local");
    await dialog.getByRole("button", { name: "Marcar ausente" }).click();

    await expect(page.getByText("No vino").first()).toBeVisible();
    const after = (await pageState(page)).state;
    expect(after.appointments.find((a) => a.id === id)?.status).toBe("no_show");
    // La seña no vuelve como crédito: es justamente para lo que sirve cobrarla.
    expect(after.clients.find((c) => c.id === target.clientId)?.credit).toBe(creditBefore);
  });

  test("los recordatorios se listan con el mensaje listo y se marcan enviados", async ({ page }) => {
    await loginAsAdmin(page);
    const api = await adminApi();
    const { state } = await pageState(page);
    const target = state.appointments.find((a) => a.status === "confirmado" && a.clientId)!;
    expect(target).toBeDefined();

    // La ventana del recordatorio es de 24 h, así que el turno se coloca a propósito dentro de
    // ella, entre 2 y 6 horas adelante. Se abre el local todo el día para que el hueco exista sin
    // importar a qué hora corran los tests; el `demo.reset` del próximo archivo restaura el horario.
    // Cada horario candidato lleva SU fecha: de noche, "dentro de unas horas" ya es mañana.
    const pad = (n: number) => String(n).padStart(2, "0");
    let placed = false;
    for (let step = 0; step < 8 && !placed; step++) {
      const slot = new Date(Date.now() + 2 * 3_600_000 + step * 30 * 60_000);
      slot.setMinutes(slot.getMinutes() < 30 ? 0 : 30, 0, 0);
      await runCommand(api, {
        type: "settings.hours",
        dayIndex: slot.getDay(),
        patch: { open: "00:00", close: "23:30", closed: false },
      });
      const date = `${slot.getFullYear()}-${pad(slot.getMonth() + 1)}-${pad(slot.getDate())}`;
      const time = `${pad(slot.getHours())}:${pad(slot.getMinutes())}`;
      // Puede haber otro turno en ese hueco: se prueba el siguiente.
      placed = (await runCommand(api, { type: "appointment.update", id: target.id, patch: { date, time } })).status === 200;
    }
    await api.dispose();
    expect(placed, "no se encontró un horario libre dentro de la ventana de 24 h").toBe(true);

    await page.goto("/admin/recordatorios");
    const row = page.getByRole("listitem").filter({ hasText: target.clientName });
    await expect(row).toBeVisible();

    // El enlace de WhatsApp lleva el mensaje ya escrito.
    await expect(row.getByRole("link", { name: /Avisar a/ })).toHaveAttribute("href", /wa\.me\/\d+\?text=.+/);

    await row.getByRole("button", { name: /Marcar como avisado/ }).click();
    await expect(page.getByText("Ya avisados")).toBeVisible();
    await expect
      .poll(async () => (await pageState(page)).state.appointments.find((a) => a.id === target.id)?.reminderSentAt)
      .toBeTruthy();
  });
});

/**
 * Conexiones del local. Se limpian sí o sí al terminar: `demo.reset` no toca la tabla de
 * secretos, y una credencial de mentira dejada ahí rompería el resto de la suite.
 */
test.describe.serial("configuración de Mercado Pago", () => {
  const clearCredentials = async () => {
    const api = await adminApi();
    await api.delete("/api/settings/payments");
    await api.post("/api/settings/whatsapp", { data: { accessToken: "", phoneNumberId: "" } });
    await api.dispose();
  };
  test.afterAll(clearCredentials);

  test("conectar Mercado Pago lleva a autorizar la app con OAuth y PKCE", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/configuracion");
    await page.getByRole("tab", { name: "Conexiones" }).click();
    await expect(page.getByText("Cobro online sin conectar")).toBeVisible();

    // Ya no se pega ninguna credencial: hay un solo botón.
    await expect(page.getByLabel("Access token de Mercado Pago")).toHaveCount(0);
    const connect = page.getByRole("link", { name: "Conectar con Mercado Pago" });
    await expect(connect).toHaveAttribute("href", "/api/payments/oauth/start");

    // El inicio del OAuth redirige a Mercado Pago (no se sigue: saldría a internet).
    const res = await page.request.get("/api/payments/oauth/start", { maxRedirects: 0 });
    expect(res.status()).toBe(303);
    const auth = new URL(res.headers().location);
    expect(auth.origin).toBe("https://auth.mercadopago.com");
    expect(auth.searchParams.get("client_id")).toBe("e2e-client-id");
    expect(auth.searchParams.get("code_challenge_method")).toBe("S256");
    expect(auth.searchParams.get("redirect_uri")).toMatch(/\/api\/payments\/oauth\/callback$/);

    // Una vuelta con un state que no es el nuestro no conecta nada.
    const forged = await page.request.get("/api/payments/oauth/callback?code=TG-robado&state=otro", { maxRedirects: 0 });
    expect(forged.headers().location).toMatch(/mp=error/);
    const status = await (await page.request.get("/api/settings/payments")).json();
    expect(status).toMatchObject({ connected: false, available: true, canReceiveWebhooks: true });
  });

  test("cargar WhatsApp habilita los códigos y no devuelve el token entero", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/configuracion");
    await page.getByRole("tab", { name: "Conexiones" }).click();
    await expect(page.getByText("WhatsApp sin configurar")).toBeVisible();

    await page.getByLabel("Access token de WhatsApp").fill("EAAG-token-de-whatsapp-1234");
    await page.getByLabel("Phone number ID").fill("558899001122");
    await page.getByRole("button", { name: "Guardar WhatsApp" }).click();
    await expect(page.getByText("WhatsApp conectado")).toBeVisible();

    const status = await (await page.request.get("/api/settings/whatsapp")).json();
    expect(status.ready).toBe(true);
    expect(status.accessToken).toBe("••••1234");
    expect(JSON.stringify(status)).not.toContain("EAAG-token-de-whatsapp");
    // El id del número no es secreto: se muestra entero para poder verificarlo.
    expect(status.phoneNumberId).toBe("558899001122");
  });

  test("las credenciales solo las ve el dueño", async ({ page }) => {
    await loginAsClient(page);
    for (const url of ["/api/settings/payments", "/api/settings/whatsapp"]) {
      expect((await page.request.get(url)).status()).toBe(403);
    }
    expect((await page.request.delete("/api/settings/payments")).status()).toBe(403);
    expect((await page.request.post("/api/settings/whatsapp", { data: { accessToken: "robado" } })).status()).toBe(403);
    expect((await page.request.get("/api/payments/oauth/start", { maxRedirects: 0 })).headers().location).toMatch(/auth\/login/);
  });
});
