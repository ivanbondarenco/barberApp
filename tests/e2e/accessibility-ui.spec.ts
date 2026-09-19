import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalOverflow, loginAsAdmin, loginAsClient, resetData } from "./helpers";

test.beforeAll(resetData);

const PUBLIC_PAGES = ["/auth/login", "/auth/registro", "/auth/recuperar", "/politicas", "/ayuda", "/offline"];
const CLIENT_PAGES = ["/cliente/reservar", "/cliente/mis-turnos", "/cliente/turno/a-demo-client", "/cliente/tienda", "/cliente/perfil", "/cliente/historial"];
const ADMIN_PAGES = [
  "/admin/agenda",
  "/admin/turno/a-lucas",
  "/admin/finanzas",
  "/admin/finanzas/cierre",
  "/admin/servicios",
  "/admin/tienda",
  "/admin/clientes",
  "/admin/clientes/c-demo",
  "/admin/equipo",
  "/admin/configuracion",
];

test.describe("Accesibilidad WCAG 2.1 AA y layout mobile", () => {
  for (const path of PUBLIC_PAGES) {
    test(`pública ${path}`, async ({ page }) => {
      await page.goto(path);
      await expectAccessible(page);
      await expectNoHorizontalOverflow(page);
    });
  }

  for (const path of CLIENT_PAGES) {
    test(`cliente ${path}`, async ({ page }) => {
      await loginAsClient(page);
      await page.goto(path);
      await expectAccessible(page);
      await expectNoHorizontalOverflow(page);
    });
  }

  for (const path of ADMIN_PAGES) {
    test(`staff ${path}`, async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto(path);
      await expectAccessible(page);
      await expectNoHorizontalOverflow(page);
    });
  }

  test("hojas y diálogos también son accesibles", async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole("button", { name: "Turno", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Nuevo turno" })).toBeVisible();
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});

test.describe("Usabilidad táctil", () => {
  const TOUCH_PAGES = [
    { role: "cliente", path: "/cliente/reservar" },
    { role: "cliente", path: "/cliente/tienda" },
    { role: "cliente", path: "/cliente/perfil" },
    { role: "admin", path: "/admin/agenda" },
    { role: "admin", path: "/admin/servicios" },
    { role: "admin", path: "/admin/turno/a-lucas" },
  ] as const;

  for (const { role, path } of TOUCH_PAGES) test(`controles de al menos 40px en ${path}`, async ({ page }) => {
    await (role === "cliente" ? loginAsClient(page) : loginAsAdmin(page));
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll("button, a, [role=radio], [role=switch], [role=tab]")]
        // Los avisos son transitorios y se animan con escala; se miden aparte.
        .filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden" && !el.closest("[aria-live]") && !el.closest("p"))
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && rect.height < 40)
        .map(({ el, rect }) => `${el.tagName} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(rect.height)}px`),
    );
    expect(small, small.join("\n")).toEqual([]);
  });

  test("el botón atrás del teléfono cierra la hoja abierta sin salir de la pantalla", async ({ page }) => {
    await loginAsClient(page);
    await page.getByRole("button", { name: /Cambiar/ }).click();
    await expect(page.getByRole("dialog", { name: "Elegí tu barbero" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page).toHaveURL(/cliente\/reservar/);
  });

  test("respeta la preferencia de reducir movimiento", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, baseURL: "http://localhost:3210" });
    const page = await context.newPage();
    await loginAsClient(page);
    await page.getByRole("radio", { name: /Corte Clásico Tijera/ }).click();
    await expect(page.getByRole("heading", { name: "¿Cuándo venís?" })).toBeVisible();
    await context.close();
  });

  test("la barra de navegación marca la sección actual", async ({ page }) => {
    await loginAsClient(page);
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await nav.getByRole("link", { name: /Tienda/ }).click();
    await page.waitForURL("**/cliente/tienda");
    await expect(nav.getByRole("link", { name: /Tienda/ })).toHaveAttribute("aria-current", "page");
  });
});
