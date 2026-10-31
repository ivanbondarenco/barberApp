import AxeBuilder from "@axe-core/playwright";
import { expect, request as playwrightRequest, type APIRequestContext, type Browser, type Locator, type Page } from "@playwright/test";

export const CLIENT = { email: "tomas.ferreyra@example.com", password: "demo1234", name: "Tomás" };
export const ADMIN = { email: "admin@dsstudio.com.ar", password: "demo1234" };
/**
 * Los códigos ahora son aleatorios y se mandan por WhatsApp. En los tests el servidor corre
 * con OTP_DEBUG=1 y devuelve el código en la respuesta: `captureOtp` lo lee de ahí.
 */
/** Barbería de la demo. Es a la que apuntan todos los tests salvo los de multi-barbería. */
export const SHOP_SLUG = "ds-studio";

const BASE_URL = "http://localhost:3210";

/**
 * Dispara la acción que pide un código y devuelve el que emitió el servidor.
 * Lee la respuesta de red en vez de tocar la UI, así no hace falta exponer el código en pantalla.
 */
export async function captureOtp(page: Page, urlPart: string, action: () => Promise<unknown>): Promise<string> {
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(urlPart) && r.request().method() === "POST"),
    action(),
  ]);
  const body = (await res.json()) as { code?: string; error?: string };
  expect(body.code, `el servidor debía emitir un código (${body.error ?? "sin error"})`).toBeTruthy();
  return body.code!;
}

/**
 * Fija la barbería del contexto, como haría un cliente que abre el link del local.
 * Con más de una barbería publicada, sin esto no hay contra cuál autenticar.
 */
export async function openShop(page: Page, slug = SHOP_SLUG) {
  await page.goto(`/b/${slug}`);
}

/** Contexto de API autenticado como staff de la barbería indicada. */
export async function adminApi(slug = SHOP_SLUG): Promise<APIRequestContext> {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  await api.get(`/b/${slug}`);
  const res = await api.post("/api/auth/login", { data: { role: "staff", identifier: ADMIN.email, password: ADMIN.password } });
  expect(res.ok()).toBeTruthy();
  return api;
}

/** Restablece la base a los datos demo (se llama al inicio de cada archivo). */
export async function resetData() {
  const api = await adminApi();
  const res = await api.post("/api/commands", { data: { command: { type: "demo.reset" } } });
  expect(res.ok()).toBeTruthy();
  await api.dispose();
}

export async function runCommand(api: APIRequestContext, command: Record<string, unknown>) {
  const res = await api.post("/api/commands", { data: { command } });
  return { status: res.status(), body: await res.json() };
}

/** Completa el ingreso que se ve al abrir la app. `tab`: la solapa de cliente o de barbero. */
export async function fillLogin(page: Page, tab: "cliente" | "barbero", identifier: string, password: string) {
  await page.getByRole("tab", { name: tab === "cliente" ? "Soy cliente" : "Soy barbero" }).click();
  await page.getByLabel(tab === "cliente" ? "Email" : "Celular o email").fill(identifier);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

export async function loginAsClient(page: Page, email = CLIENT.email, password = CLIENT.password) {
  await page.goto("/auth/login");
  await fillLogin(page, "cliente", email, password);
  await page.waitForURL("**/cliente/reservar");
}

export async function loginAsAdmin(page: Page) {
  await page.goto("/auth/login");
  await fillLogin(page, "barbero", ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin/agenda");
}

/** Abre un segundo "dispositivo" (contexto aislado con su propia sesión). */
export async function newDevice(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    locale: "es-AR",
    baseURL: BASE_URL,
  });
  return { context, page: await context.newPage() };
}

/** Estado visible para la sesión de la página. */
export async function pageState(page: Page) {
  const res = await page.request.get("/api/state");
  return (await res.json()) as {
    version: number;
    session: {
      role: string;
      name: string;
      identifier: string;
      clientId?: string;
      shop: { id: string; slug: string; name: string };
      shops?: { id: string; slug: string; name: string }[];
    } | null;
    state: {
      services: { id: string; name: string; price: number; active: boolean }[];
      products: { id: string; name: string; stock: number }[];
      barbers: { id: string; name: string }[];
      clients: { id: string; name: string; phone: string; credit: number }[];
      appointments: { id: string; clientId?: string; clientName: string; status: string; time: string; date: string; deposit: { status: string; method: string }; products: unknown[]; reminderSentAt?: string; holdUntil?: string; rating?: number; barberId: string }[];
      blocks: { id: string; reason: string }[];
      businessHours: { closed: boolean; open: string; close: string }[];
      businessInfo: { name: string; address: string; whatsapp: string };
      depositSettings: { allowCash: boolean; rate: number };
      integrations: { mercadopagoReady: boolean; whatsappReady: boolean };
    };
    shop?: { id: string; slug: string; name: string } | null;
    shops?: { id: string; slug: string; name: string }[];
  };
}

/**
 * Elige el primer horario libre visible y devuelve el que realmente quedó seleccionado.
 *
 * La lista se re-renderiza cuando llega la sincronización con el servidor (un horario que se
 * libera o se toma), así que leer el texto ANTES de hacer clic devolvía a veces un horario
 * distinto del que terminaba marcado.
 */
export async function pickFirstSlot(scope: Page | ReturnType<Page["locator"]>) {
  const group = scope.getByRole("radiogroup", { name: "Horario" });
  await expect(group.getByRole("radio").first()).toBeVisible();
  const selected = group.getByRole("radio", { checked: true });
  // Si la sincronización rehace la lista justo después del click, el horario queda sin marcar:
  // se vuelve a intentar hasta que uno quede elegido.
  await expect(async () => {
    await group.getByRole("radio").first().click();
    await expect(selected).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  return (await selected.textContent())?.trim() ?? "";
}

const MONTH_LONG = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/**
 * Elige esa fecha en el calendario mensual, pasando al mes siguiente si hace falta.
 *
 * El cambio de mes se anima: hasta que la primera casilla no es del mes nuevo, las que están en
 * pantalla siguen siendo las del anterior. Las casillas van en orden, una por día, así que la del
 * día N es la enésima.
 */
export async function chooseCalendarDay(scope: Page | Locator, target: Date) {
  const cells = scope.getByRole("radiogroup", { name: "Día" }).getByRole("radio");
  const wanted = MONTH_LONG[target.getMonth()];
  await expect(cells.first()).toBeVisible();
  const visibleLabel = (await cells.first().getAttribute("aria-label")) ?? "";
  if (!visibleLabel.includes(wanted)) {
    const visible = MONTH_LONG.findIndex((m) => visibleLabel.includes(m));
    const forward = (target.getMonth() - visible + 12) % 12 <= 6;
    await scope.getByRole("button", { name: forward ? "Mes siguiente" : "Mes anterior" }).click();
    await expect(cells.first()).toHaveAttribute("aria-label", new RegExp(wanted));
  }
  const cell = cells.nth(target.getDate() - 1);
  await expect(cell).toBeEnabled();
  await cell.click();
  await expect(cell).toHaveAttribute("aria-checked", "true");
}

/** Elige el día que cae `daysAhead` días después de hoy, salteando el domingo (el local cierra). */
export async function chooseDayAhead(scope: Page | Locator, daysAhead: number) {
  const day = new Date();
  day.setDate(day.getDate() + daysAhead);
  while (day.getDay() === 0) day.setDate(day.getDate() + 1);
  await chooseCalendarDay(scope, day);
  return day;
}

/** Próximo domingo (el local cierra): sirve para probar los días sin atención. */
export function nextSunday(): Date {
  const day = new Date();
  day.setDate(day.getDate() + ((7 - day.getDay()) % 7 || 7));
  return day;
}

/** Espera a que desaparezcan los avisos y animaciones de entrada. */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
}

/** Auditoría WCAG 2.1 AA con axe. */
export async function expectAccessible(page: Page) {
  await settle(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // Los toasts se animan y pueden quedar a mitad de opacidad durante el escaneo.
    .exclude("[aria-live]")
    .analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, summary.join("\n")).toEqual([]);
}

/** Ningún contenido debe generar scroll horizontal en mobile. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const main = document.querySelector("main");
    const widest = [document.documentElement, document.body, main].filter(Boolean).map((el) => (el as HTMLElement).scrollWidth - (el as HTMLElement).clientWidth);
    return Math.max(...widest);
  });
  expect(overflow).toBeLessThanOrEqual(1);
}
