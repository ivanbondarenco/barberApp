import AxeBuilder from "@axe-core/playwright";
import { expect, request as playwrightRequest, type APIRequestContext, type Browser, type Page } from "@playwright/test";

export const CLIENT = { phone: "+54 9 11 5555 0192", pin: "1234", name: "Tomás" };
export const ADMIN = { email: "admin@dsstudio.com.ar", pin: "1234" };
export const OTP = "123456";

const BASE_URL = "http://localhost:3210";

/** Contexto de API autenticado como staff. */
export async function adminApi(): Promise<APIRequestContext> {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const res = await api.post("/api/auth/login", { data: { role: "admin", identifier: ADMIN.email, pin: ADMIN.pin } });
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

export async function loginAsClient(page: Page, phone = CLIENT.phone, pin = CLIENT.pin) {
  await page.goto("/auth/login");
  await page.getByLabel("Celular o email").fill(phone);
  await page.getByLabel("PIN", { exact: true }).fill(pin);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL("**/cliente/reservar");
}

export async function loginAsAdmin(page: Page) {
  await page.goto("/auth/login");
  await page.getByRole("tab", { name: "Soy barbero" }).click();
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("PIN", { exact: true }).fill(ADMIN.pin);
  await page.getByRole("button", { name: "Ingresar" }).click();
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
    session: { role: string; name: string; clientId?: string } | null;
    state: {
      services: { id: string; name: string; price: number; active: boolean }[];
      products: { id: string; name: string; stock: number }[];
      barbers: { id: string; name: string }[];
      clients: { id: string; name: string; phone: string; credit: number }[];
      appointments: { id: string; clientId?: string; clientName: string; status: string; time: string; date: string; deposit: { status: string; method: string }; products: unknown[] }[];
      blocks: { id: string; reason: string }[];
      cashRegister: { open: boolean };
      businessHours: { closed: boolean; open: string; close: string }[];
    };
  };
}

/** Elige el primer horario libre visible en un selector de turnos. */
export async function pickFirstSlot(scope: Page | ReturnType<Page["locator"]>) {
  const slots = scope.getByRole("radiogroup", { name: "Horario" }).getByRole("radio");
  await expect(slots.first()).toBeVisible();
  const time = (await slots.first().textContent())?.trim() ?? "";
  await slots.first().click();
  return time;
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
