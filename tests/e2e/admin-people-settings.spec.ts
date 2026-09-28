import { expect, test } from "@playwright/test";
import { loginAsAdmin, loginAsClient, newDevice, pageState, resetData } from "./helpers";

test.beforeAll(resetData);
test.beforeEach(async ({ page }) => loginAsAdmin(page));

test("clientes: busca, crea, edita y elimina", async ({ page }) => {
  await page.goto("/admin/clientes");
  await page.getByLabel("Buscar cliente").fill("mateo");
  await expect(page.getByRole("link", { name: /Mateo Rossi/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Lucas Gómez/ })).toBeHidden();
  await page.getByLabel("Buscar cliente").fill("6120");
  await expect(page.getByRole("link", { name: /Lucas Gómez/ })).toBeVisible();
  await page.getByLabel("Buscar cliente").fill("");

  await page.getByRole("button", { name: "Cliente", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Nuevo cliente" });
  await form.getByLabel("Nombre y apellido").fill("Ramiro Test");
  await form.getByLabel("Celular").fill("+54 9 11 4321 8890"); // celular de Mateo
  await form.getByRole("button", { name: "Crear cliente" }).click();
  await expect(page.getByText("Ya existe un cliente con ese celular")).toBeVisible();
  await form.getByLabel("Celular").fill("+54 9 11 7777 8888");
  await form.getByRole("button", { name: "Crear cliente" }).click();
  await expect(form).toBeHidden();

  await page.getByRole("link", { name: /Ramiro Test/ }).click();
  await page.waitForURL(/admin\/clientes\/c-/);
  await page.getByRole("button", { name: "Editar" }).click();
  const edit = page.getByRole("dialog", { name: "Editar cliente" });
  await edit.getByLabel("Nombre y apellido").fill("Ramiro Editado");
  await edit.getByLabel("Nota interna").fill("Viene los viernes");
  await edit.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("heading", { name: "Ramiro Editado" })).toBeVisible();
  await expect(page.getByText("Viene los viernes")).toBeVisible();

  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByRole("dialog", { name: "Editar cliente" }).getByRole("button", { name: "Eliminar cliente" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar cliente" }).click();
  await page.waitForURL("**/admin/clientes");
  expect((await pageState(page)).state.clients.some((c) => c.name === "Ramiro Editado")).toBe(false);
});

test("clientes: no se elimina un cliente con turnos próximos", async ({ page }) => {
  await page.goto("/admin/clientes/c-demo");
  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByRole("dialog", { name: "Editar cliente" }).getByRole("button", { name: "Eliminar cliente" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar cliente" }).click();
  await expect(page.getByText(/turnos próximos/)).toBeVisible();
  expect((await pageState(page)).state.clients.some((c) => c.id === "c-demo")).toBe(true);
});

test("ficha del cliente agenda un turno con sus datos precargados", async ({ page }) => {
  await page.goto("/admin/clientes/c-mateo");
  await page.getByRole("button", { name: "Turno", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Nuevo turno" });
  // Llega con la ficha ya elegida: el turno se cuelga de ese cliente, no de un nombre escrito.
  await expect(form.getByText("Mateo Rossi")).toBeVisible();
  await expect(form.getByRole("button", { name: "Cambiar" })).toBeVisible();
});

test("equipo: alta, desactivar y baja de un barbero", async ({ page }) => {
  await page.goto("/admin/equipo");
  await page.getByRole("button", { name: "Barbero", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Nuevo barbero" });
  await form.getByLabel("Nombre").fill("Lucía Fernández");
  await form.getByLabel("Sillón").fill("1");
  await form.getByRole("button", { name: "Agregar al equipo" }).click();
  await expect(page.getByText("El sillón #1 ya está asignado")).toBeVisible();
  await form.getByLabel("Sillón").fill("3");
  await form.getByRole("button", { name: "Agregar al equipo" }).click();
  await expect(form).toBeHidden();

  const active = page.getByRole("switch", { name: "Lucía Fernández recibe reservas" });
  await active.click();
  await expect(active).toHaveAttribute("aria-checked", "false");

  await page.getByRole("main").getByRole("button", { name: /Lucía Fernández/ }).click();
  await page.getByRole("dialog", { name: "Editar barbero" }).getByRole("button", { name: "Eliminar del equipo" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByRole("main").getByRole("button", { name: /Lucía Fernández/ })).toBeHidden();
});

test("equipo: un barbero con turnos próximos no se puede eliminar", async ({ page }) => {
  await page.goto("/admin/equipo");
  await page.getByRole("button", { name: /Diego S\./ }).click();
  await page.getByRole("dialog", { name: "Editar barbero" }).getByRole("button", { name: "Eliminar del equipo" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText(/Tiene turnos próximos/)).toBeVisible();
});

test("configuración: datos del negocio con validación", async ({ page }) => {
  await page.goto("/admin/configuracion");
  await page.getByLabel("CBU / CVU").fill("123");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("22 dígitos")).toBeVisible();
  await page.getByLabel("CBU / CVU").fill("0000003100092837465099");
  await page.getByLabel("Alias").fill("DS.STUDIO.PAGOS");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect.poll(async () => (await pageState(page)).state).toBeTruthy();
  await page.reload();
  await expect(page.getByLabel("Alias")).toHaveValue("DS.STUDIO.PAGOS");
});

test("configuración: el dueño le cambia el nombre a su barbería", async ({ page }) => {
  await page.goto("/admin/configuracion");
  await page.getByLabel("Nombre de la barbería").fill("  ");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Ingresá el nombre de la barbería")).toBeVisible();

  await page.getByLabel("Nombre de la barbería").fill("Barbería Renombrada");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  // Cambia para sus clientes, y el link del local sigue siendo el mismo.
  await expect.poll(async () => (await pageState(page)).shop?.name).toBe("Barbería Renombrada");
  expect((await pageState(page)).shop?.slug).toBe("ds-studio");
  await page.reload();
  await expect(page.getByLabel("Nombre de la barbería")).toHaveValue("Barbería Renombrada");

  // Se deja como estaba para el resto de los tests.
  await page.getByLabel("Nombre de la barbería").fill("D.S Studio Barbería");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect.poll(async () => (await pageState(page)).shop?.name).toBe("D.S Studio Barbería");
});

test("configuración: cerrar un día lo quita de la reserva del cliente", async ({ page, browser }) => {
  await page.goto("/admin/configuracion");
  await page.getByRole("tab", { name: "Horarios" }).click();
  const saturday = page.getByRole("switch", { name: "Sábado abierto" });
  await saturday.click();
  await expect(saturday).toHaveAttribute("aria-checked", "false");
  await expect.poll(async () => (await pageState(page)).state.businessHours[6].closed).toBe(true);

  const client = await newDevice(browser);
  await loginAsClient(client.page);
  await client.page.getByRole("radio", { name: /Corte Clásico Tijera/ }).click();
  const calendar = client.page.getByRole("radiogroup", { name: "Día" });
  await expect(calendar.getByRole("radio").first()).toBeVisible();
  const open = await calendar
    .locator("button:not([disabled])")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
  expect(open.length).toBeGreaterThan(0);
  expect(open.some((label) => label.startsWith("Sábado"))).toBe(false);
  await client.context.close();

  await saturday.click();
  await expect.poll(async () => (await pageState(page)).state.businessHours[6].closed).toBe(false);
});
