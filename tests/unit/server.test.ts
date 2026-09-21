import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeTime, SHOP } from "./support/fixtures";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ds-studio-test-"));
const dbFile = path.join(dir, "test.db");

async function loadServer() {
  vi.resetModules();
  delete (globalThis as { __dsDb?: unknown }).__dsDb;
  const repository = await import("@/server/repository");
  const db = await import("@/server/db");
  return { ...repository, ...db };
}

beforeAll(() => {
  process.env.DATABASE_PATH = dbFile;
  // Estos tests parten de la barbería de demostración.
  process.env.SEED_DEMO = "1";
});

afterAll(() => {
  delete (globalThis as { __dsDb?: unknown }).__dsDb;
  fs.rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  freezeTime();
});

describe("crypto", () => {
  it("hashea el PIN con sal y lo verifica", async () => {
    const { hashPin, verifyPin, normalizeIdentifier } = await import("@/server/crypto");
    const a = hashPin("1234");
    const b = hashPin("1234");
    expect(a).not.toBe(b);
    expect(a).not.toContain("1234");
    expect(verifyPin("1234", a)).toBe(true);
    expect(verifyPin("4321", a)).toBe(false);
    expect(verifyPin("1234", "corrupto")).toBe(false);
    expect(normalizeIdentifier(" Admin@DSStudio.com.ar ")).toBe("admin@dsstudio.com.ar");
    expect(normalizeIdentifier("+54 9 11 5555-0192")).toBe("tel:1155550192");
  });
});

describe("repositorio SQLite", () => {
  it("siembra la base una sola vez con usuarios demo", async () => {
    fs.rmSync(dbFile, { force: true });
    const { loadState, getDb, queryAll } = await loadServer();
    const { state, version } = await loadState(SHOP);
    expect(version).toBe(1);
    expect(state.services.length).toBeGreaterThan(0);
    expect(state.clients.find((c) => c.id === "c-demo")?.hasAccount).toBe(true);
    const users = queryAll<{ identifier: string; pin_hash: string }>(await getDb(), "SELECT identifier, pin_hash FROM users ORDER BY identifier");
    expect(users.map((u) => u.identifier)).toEqual(["admin@dsstudio.com.ar", "tel:1155550192"]);
    expect(users.every((u) => u.pin_hash.includes(":"))).toBe(true);
    expect(fs.existsSync(dbFile)).toBe(true);
  });

  it("aplica comandos, sube la versión y persiste en disco", async () => {
    const { executeCommand } = await loadServer();
    const { state, version } = await executeCommand({ role: "admin", shopId: SHOP }, {
      type: "service.upsert",
      service: { id: "s-persist", name: "Servicio persistido", description: "", price: 5000, durationMin: 30, category: "corte", active: true },
    });
    expect(version).toBe(2);
    expect(state.services.some((s) => s.id === "s-persist")).toBe(true);

    // Nuevo "proceso": se recarga desde el archivo.
    const reloaded = await loadServer();
    const after = await reloaded.loadState(SHOP);
    expect(after.version).toBe(2);
    expect(after.state.services.some((s) => s.id === "s-persist")).toBe(true);
  });

  it("si el comando falla no escribe nada (transacción)", async () => {
    const { executeCommand, loadState } = await loadServer();
    const before = await loadState(SHOP);
    await expect(executeCommand({ role: "cliente", shopId: SHOP, clientId: "c-demo" }, { type: "service.delete", id: "s-persist" })).rejects.toThrow(/reservada al staff/);
    const after = await loadState(SHOP);
    expect(after.version).toBe(before.version);
    expect(after.state.services.some((s) => s.id === "s-persist")).toBe(true);
  });

  it("guarda turnos con columnas indexadas y borra filas eliminadas", async () => {
    const { executeCommand, getDb, queryAll } = await loadServer();
    await executeCommand({ role: "admin", shopId: SHOP }, { type: "appointment.cancel", id: "a-martin" });
    const rows = queryAll<{ status: string; date: string; barber_id: string }>(await getDb(), "SELECT status, date, barber_id FROM appointments WHERE id = ?", ["a-martin"]);
    expect(rows[0]).toEqual({ status: "cancelado", date: "2026-09-14", barber_id: "b-diego" });
    await executeCommand({ role: "admin", shopId: SHOP }, { type: "appointment.delete", id: "a-martin" });
    expect(queryAll(await getDb(), "SELECT id FROM appointments WHERE id = ?", ["a-martin"])).toHaveLength(0);
  });

  it("eliminar un cliente borra también su cuenta y sesiones", async () => {
    freezeTime(new Date(2026, 8, 14, 21, 0)); // después de su turno de hoy
    const { executeCommand, mutate, getDb, queryAll } = await loadServer();
    await mutate((db) => {
      db.run("INSERT INTO users (id, shop_id, role, identifier, name, client_id, pin_hash, created_at) VALUES ('u-lucas','s-default','cliente','tel:1161204471','Lucas','c-lucas','x:y','now')");
      db.run("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('tok','u-lucas','2099-01-01')");
    });
    await executeCommand({ role: "admin", shopId: SHOP }, { type: "client.delete", id: "c-lucas" });
    const db = await getDb();
    expect(queryAll(db, "SELECT id FROM users WHERE id = 'u-lucas'")).toHaveLength(0);
    expect(queryAll(db, "SELECT token_hash FROM sessions WHERE user_id = 'u-lucas'")).toHaveLength(0);
  });

  it("demo.reset regenera los datos", async () => {
    const { executeCommand } = await loadServer();
    const { state } = await executeCommand({ role: "admin", shopId: SHOP }, { type: "demo.reset" });
    expect(state.services.some((s) => s.id === "s-persist")).toBe(false);
    expect(state.appointments.some((a) => a.id === "a-martin")).toBe(true);
  });
});

describe("visibilidad por rol", () => {
  it("anónimo: solo catálogo público", async () => {
    const { loadState } = await loadServer();
    const { stateForActor } = await import("@/server/visibility");
    const { state } = await loadState(SHOP);
    const view = stateForActor(state, null);
    expect(view.clients).toEqual([]);
    expect(view.appointments).toEqual([]);
    expect(view.cashClosures).toEqual([]);
    expect(view.services.every((s) => s.active)).toBe(true);
  });

  it("cliente: sus datos completos y los ajenos anónimos", async () => {
    const { loadState } = await loadServer();
    const { stateForActor } = await import("@/server/visibility");
    const { state } = await loadState(SHOP);
    const view = stateForActor(state, { role: "cliente", shopId: SHOP, clientId: "c-demo" });
    expect(view.clients.map((c) => c.id)).toEqual(["c-demo"]);
    const own = view.appointments.filter((a) => a.clientId === "c-demo");
    const others = view.appointments.filter((a) => a.clientId !== "c-demo");
    expect(own.length).toBeGreaterThan(0);
    expect(others.length).toBeGreaterThan(0);
    for (const a of others) {
      expect(a.clientName).toBe("");
      expect(a.clientPhone).toBe("");
      expect(a.notes).toBeUndefined();
      expect(a.servicePrice).toBe(0);
    }
    expect(view.blocks.every((b) => b.reason === "")).toBe(true);
  });

  it("staff: ve todo", async () => {
    const { loadState } = await loadServer();
    const { stateForActor } = await import("@/server/visibility");
    const { state } = await loadState(SHOP);
    expect(stateForActor(state, { role: "admin", shopId: SHOP })).toBe(state);
  });

  it("barbero: su agenda completa y la de los otros sillones anonimizada", async () => {
    const { loadState } = await loadServer();
    const { stateForActor } = await import("@/server/visibility");
    const { state } = await loadState(SHOP);
    const view = stateForActor(state, { role: "barbero", shopId: SHOP, barberId: "b-nico" });

    const own = view.appointments.filter((a) => a.barberId === "b-nico");
    const others = view.appointments.filter((a) => a.barberId !== "b-nico");
    expect(own.length).toBeGreaterThan(0);
    expect(others.length).toBeGreaterThan(0);
    expect(own.some((a) => a.clientName !== "")).toBe(true);
    for (const a of others) {
      expect(a.clientName).toBe("");
      expect(a.clientPhone).toBe("");
      expect(a.servicePrice).toBe(0);
    }
    // La plata del local es del dueño.
    expect(view.cashClosures).toEqual([]);
  });

  it("el usuario de acceso del staff no sale en la vista pública", async () => {
    const { loadState, mutate } = await loadServer();
    await mutate((db) => {
      db.run(
        `INSERT INTO users (id, shop_id, role, identifier, name, client_id, barber_id, pin_hash, created_at)
         VALUES ('u-b-nico', 's-default', 'barbero', 'tel:1122334455', 'Nico', NULL, 'b-nico', 'x:y', '2026-01-01')`,
      );
    }, { touchesState: SHOP });

    const { stateForActor } = await import("@/server/visibility");
    const { state } = await loadState(SHOP);
    expect(state.barbers.find((b) => b.id === "b-nico")?.accountIdentifier).toBe("tel:1122334455");

    for (const actor of [null, { role: "cliente" as const, shopId: SHOP, clientId: "c-demo" }]) {
      const view = stateForActor(state, actor);
      for (const b of view.barbers) {
        expect(b.accountIdentifier).toBeUndefined();
        expect(b.phone).toBeUndefined();
      }
    }
  });
});

describe("regresiones de seguridad", () => {
  it("un cliente no puede restablecer la base (demo.reset)", async () => {
    const { executeCommand, loadState } = await loadServer();
    const before = await loadState(SHOP);
    await expect(executeCommand({ role: "cliente", shopId: SHOP, clientId: "c-demo" }, { type: "demo.reset" })).rejects.toThrow(/reservada al staff/);
    expect((await loadState(SHOP)).version).toBe(before.version);
  });

  it("un cliente no puede acreditarse la seña de su propio turno", async () => {
    const { executeCommand, loadState } = await loadServer();
    const { state } = await loadState(SHOP);
    const own = state.appointments.find((a) => a.clientId === "c-demo" && a.status === "confirmado");
    expect(own).toBeDefined();

    await expect(
      executeCommand({ role: "cliente", shopId: SHOP, clientId: "c-demo" }, { type: "appointment.deposit", id: own!.id, method: "mercadopago" }),
    ).rejects.toThrow(/reservada al staff/);
  });

  it("un barbero no puede operar el turno de otro sillón ni tocar la caja", async () => {
    const { executeCommand, loadState } = await loadServer();
    const { state } = await loadState(SHOP);
    const otherChair = state.appointments.find((a) => a.barberId !== "b-nico" && a.status === "confirmado");
    expect(otherChair).toBeDefined();

    await expect(
      executeCommand({ role: "barbero", shopId: SHOP, barberId: "b-nico" }, { type: "appointment.charge", id: otherChair!.id, method: "efectivo" }),
    ).rejects.toThrow(/otro barbero/);
    await expect(executeCommand({ role: "barbero", shopId: SHOP, barberId: "b-nico" }, { type: "cash.close", closure: { id: "cc-x", date: "2026-09-14", expectedCash: 0, countedCash: 0, digital: 0, total: 0 } })).rejects.toThrow(/reservada al dueño/);
  });

  it("el actor sistema solo puede acreditar señas", async () => {
    const { executeCommand, loadState } = await loadServer();
    const { state } = await loadState(SHOP);
    const any = state.appointments.find((a) => a.status === "confirmado")!;
    await expect(executeCommand({ role: "sistema", shopId: SHOP }, { type: "appointment.cancel", id: any.id })).rejects.toThrow(/no permitida/);
  });
});

describe("aislamiento entre barberías", () => {
  /** Crea una barbería nueva con su dueño y devuelve sus datos. */
  async function newShop(name: string, identifier: string) {
    const { createShop } = await loadServer();
    return createShop({
      name,
      ownerName: "Dueño",
      ownerIdentifier: identifier,
      ownerPin: "9876",
      address: "Calle Falsa 123",
      whatsapp: "+54 9 11 9999 0000",
    });
  }

  it("una barbería nueva arranca con su propio catálogo y sin datos de la demo", async () => {
    const { shop } = await newShop("Barbería Norte", "norte@test.com");
    const { loadState } = await loadServer();

    const nueva = (await loadState(shop.id)).state;
    const demo = (await loadState(SHOP)).state;

    expect(nueva.businessInfo.name).toBe("Barbería Norte");
    expect(nueva.appointments).toEqual([]);
    expect(nueva.clients).toEqual([]);
    expect(nueva.cashClosures).toEqual([]);
    expect(nueva.services.length).toBeGreaterThan(0);
    // Y nada de la demo se filtró.
    expect(demo.appointments.length).toBeGreaterThan(0);
    expect(nueva.services.map((s) => s.id)).not.toEqual(expect.arrayContaining(demo.services.map((s) => s.id)));
  });

  it("los ids sembrados pueden repetirse entre barberías sin pisarse", async () => {
    const a = await newShop("Barbería Uno", "uno@test.com");
    const b = await newShop("Barbería Dos", "dos@test.com");
    const { executeCommand, loadState } = await loadServer();

    // Las dos tienen el servicio "s-corte": cambiarlo en una no toca a la otra.
    const service = (await loadState(a.shop.id)).state.services.find((s) => s.id === "s-corte")!;
    expect(service).toBeDefined();
    await executeCommand(
      { role: "admin", shopId: a.shop.id },
      { type: "service.upsert", service: { ...service, price: 33000 } },
    );

    expect((await loadState(a.shop.id)).state.services.find((s) => s.id === "s-corte")?.price).toBe(33000);
    expect((await loadState(b.shop.id)).state.services.find((s) => s.id === "s-corte")?.price).toBe(service.price);
  });

  it("cada barbería lleva su propia versión de estado", async () => {
    const { shop } = await newShop("Barbería Versiones", "ver@test.com");
    const { executeCommand, loadState } = await loadServer();

    const demoBefore = (await loadState(SHOP)).version;
    await executeCommand({ role: "admin", shopId: shop.id }, { type: "cash.open" });

    expect((await loadState(SHOP)).version).toBe(demoBefore);
    expect((await loadState(shop.id)).version).toBeGreaterThan(0);
  });

  it("el mismo celular puede tener cuenta en dos barberías distintas", async () => {
    const a = await newShop("Barbería A", "+54 9 11 7777 0001");
    const b = await newShop("Barbería B", "+54 9 11 7777 0001");
    expect(a.shop.id).not.toBe(b.shop.id);
    expect(a.userId).not.toBe(b.userId);

    const { getDb, queryAll } = await loadServer();
    const rows = queryAll<{ shop_id: string }>(await getDb(), "SELECT shop_id FROM users WHERE identifier = ?", [
      "tel:1177770001",
    ]);
    expect(rows.map((r) => r.shop_id).sort()).toEqual([a.shop.id, b.shop.id].sort());
  });

  it("el slug se numera cuando el nombre ya está tomado", async () => {
    const a = await newShop("Barbería Repetida", "rep1@test.com");
    const b = await newShop("Barbería Repetida", "rep2@test.com");
    expect(a.shop.slug).toBe("barberia-repetida");
    expect(b.shop.slug).toBe("barberia-repetida-2");
  });

  it("un dueño no puede operar sobre los turnos de otra barbería", async () => {
    const { shop } = await newShop("Barbería Ajena", "ajena@test.com");
    const { executeCommand, loadState } = await loadServer();

    // Un turno que existe, pero en la barbería de la demo.
    const foreign = (await loadState(SHOP)).state.appointments.find((a) => a.status === "confirmado")!;
    expect(foreign).toBeDefined();

    // El dueño de la otra barbería ni siquiera lo ve: para él, ese turno no existe.
    await expect(
      executeCommand({ role: "admin", shopId: shop.id }, { type: "appointment.cancel", id: foreign.id }),
    ).rejects.toThrow(/no existe/);
    expect((await loadState(SHOP)).state.appointments.find((a) => a.id === foreign.id)?.status).toBe("confirmado");
  });

  it("las credenciales de la pasarela son de cada barbería", async () => {
    const { shop } = await newShop("Barbería Pagos", "pagos@test.com");
    const { getSecret, setSecret } = await import("@/server/secrets");
    const { loadState } = await loadServer();

    await setSecret("mp_access_token", "TOKEN-DE-LA-NUEVA", shop.id);

    expect(await getSecret("mp_access_token", shop.id)).toBe("TOKEN-DE-LA-NUEVA");
    expect(await getSecret("mp_access_token", SHOP)).toBeUndefined();
    expect((await loadState(shop.id)).state.integrations.mercadopagoReady).toBe(true);
    expect((await loadState(SHOP)).state.integrations.mercadopagoReady).toBe(false);
  });

  it("demo.reset no alcanza a las barberías reales", async () => {
    const { shop } = await newShop("Barbería Intacta", "intacta@test.com");
    const { executeCommand, loadState } = await loadServer();

    await expect(executeCommand({ role: "admin", shopId: shop.id }, { type: "demo.reset" })).rejects.toThrow(
      /No disponible/,
    );
    expect((await loadState(shop.id)).state.businessInfo.name).toBe("Barbería Intacta");
  });
});

describe("una barbería nueva", () => {
  async function newShop(name: string, identifier: string) {
    const { createShop } = await loadServer();
    return createShop({
      name,
      ownerName: "Marcos Duarte",
      ownerIdentifier: identifier,
      ownerPin: "9876",
      address: "San Martín 1234",
      whatsapp: "+54 9 11 6000 7000",
    });
  }

  it("publica SUS datos de contacto, no los de la demo", async () => {
    const { shop } = await newShop("Barbería Propia", "propia@test.com");
    const { loadState } = await loadServer();
    const info = (await loadState(shop.id)).state.businessInfo;

    expect(info).toMatchObject({
      name: "Barbería Propia",
      address: "San Martín 1234",
      whatsapp: "+54 9 11 6000 7000",
    });
    // Nada heredado del local de demostración: mandaría a los clientes a otra dirección.
    const demo = (await loadState(SHOP)).state.businessInfo;
    expect(info.address).not.toBe(demo.address);
    expect(info.whatsapp).not.toBe(demo.whatsapp);
    expect(info.instagram).toBe("");
    expect(info.transferAlias).toBe("");
  });

  it("no inventa reputación: su barbero arranca sin reseñas", async () => {
    const { shop } = await newShop("Barbería Sin Reseñas", "sinresenas@test.com");
    const { loadState } = await loadServer();
    const [barber] = (await loadState(shop.id)).state.barbers;
    expect(barber.reviews).toBe(0);
    expect(barber.rating).toBeUndefined();
  });

  it("arranca con la seña por defecto y el dueño puede cambiarla", async () => {
    const { shop } = await newShop("Barbería Señas", "senias@test.com");
    const { executeCommand, loadState } = await loadServer();
    expect((await loadState(shop.id)).state.depositSettings.rate).toBe(0.5);

    await executeCommand({ role: "admin", shopId: shop.id }, { type: "settings.deposit", rate: 0 });
    expect((await loadState(shop.id)).state.depositSettings.rate).toBe(0);
    // Y no se contagia a la otra barbería.
    expect((await loadState(SHOP)).state.depositSettings.rate).toBe(0.5);
  });
});

describe("reputación de los barberos", () => {
  it("el rating sale de las reseñas reales y no se guarda inventado", async () => {
    const { executeCommand, loadState, getDb, queryOne } = await loadServer();
    const { state } = await loadState(SHOP);
    const barberId = "b-nico";

    // Antes de cualquier reseña no hay número que mostrar.
    expect(state.barbers.find((b) => b.id === barberId)?.reviews).toBe(0);

    // Dos turnos de Nico, cobrados y calificados por sus clientes.
    const suyos = state.appointments.filter((a) => a.barberId === barberId && a.status === "confirmado" && a.clientId).slice(0, 2);
    expect(suyos.length).toBe(2);
    const notas = [5, 4];
    for (const [i, a] of suyos.entries()) {
      await executeCommand({ role: "admin", shopId: SHOP }, { type: "appointment.charge", id: a.id, method: "efectivo" });
      await executeCommand(
        { role: "cliente", shopId: SHOP, clientId: a.clientId! },
        { type: "appointment.rate", id: a.id, rating: notas[i] },
      );
    }

    const after = (await loadState(SHOP)).state.barbers.find((b) => b.id === barberId)!;
    expect(after.reviews).toBe(2);
    expect(after.rating).toBe(4.5);

    // El JSON guardado del barbero no tiene rating: es derivado.
    const row = queryOne<{ data: string }>(await getDb(), "SELECT data FROM barbers WHERE shop_id = ? AND id = ?", [SHOP, barberId]);
    expect(JSON.parse(row!.data)).not.toHaveProperty("rating");
    expect(JSON.parse(row!.data)).not.toHaveProperty("reviews");
  });
});

describe("arranque en producción", () => {
  it("sin SEED_DEMO la base no inventa una barbería", async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "ds-studio-vacia-"));
    const previous = { db: process.env.DATABASE_PATH, seed: process.env.SEED_DEMO };
    process.env.DATABASE_PATH = path.join(emptyDir, "vacia.db");
    delete process.env.SEED_DEMO;
    delete (globalThis as { __dsDb?: unknown }).__dsDb;
    vi.resetModules();

    try {
      const { listShops } = await import("@/server/repository");
      expect(await listShops()).toEqual([]);
    } finally {
      process.env.DATABASE_PATH = previous.db;
      if (previous.seed) process.env.SEED_DEMO = previous.seed;
      delete (globalThis as { __dsDb?: unknown }).__dsDb;
      vi.resetModules();
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});
