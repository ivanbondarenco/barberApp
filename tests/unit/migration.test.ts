import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import initSqlJs from "sql.js";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * Migración de una base real creada antes de la multi-barbería.
 *
 * Es lo que corre contra los datos de un local que ya está funcionando: si esto se rompe,
 * se pierde la agenda de alguien. Se arma una base con el esquema viejo, se la abre con el
 * código actual y se verifica que todo quedó adentro de la barbería heredada.
 */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ds-studio-migracion-"));

afterAll(() => {
  delete (globalThis as { __dsDb?: unknown }).__dsDb;
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Esquema tal como era antes: sin `shop_id`, sin rol `barbero`, con identifier único global. */
const SCHEMA_V1 = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE settings (key TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE clients (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE barbers (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE services (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE products (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE blocks (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE cash_closures (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE appointments (
  id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL,
  date TEXT NOT NULL, client_id TEXT, barber_id TEXT NOT NULL, status TEXT NOT NULL
);
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('cliente', 'admin')),
  identifier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  client_id TEXT,
  pin_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE secrets (scope TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (scope, key));
`;

async function buildLegacyDb(file: string) {
  const SQL = await initSqlJs({
    locateFile: (f) => path.join(process.cwd(), "node_modules", "sql.js", "dist", f),
  });
  const db = new SQL.Database();
  db.run(SCHEMA_V1);

  const stamp = "2026-09-01T10:00:00.000Z";
  db.run("INSERT INTO meta (key, value) VALUES ('version', '7')");
  db.run("INSERT INTO settings (key, data) VALUES ('businessInfo', ?)", [
    JSON.stringify({
      name: "Barbería Vieja",
      address: "Calle 1",
      neighborhood: "Centro",
      whatsapp: "+54 9 11 1111 1111",
      email: "hola@vieja.com",
      instagram: "@vieja",
      transferAlias: "VIEJA.ALIAS",
      transferCbu: "0".repeat(22),
    }),
  ]);
  db.run("INSERT INTO settings (key, data) VALUES ('cashRegister', ?)", [JSON.stringify({ open: true, openedAt: "09:00" })]);
  db.run("INSERT INTO barbers (id, data, updated_at) VALUES ('b-viejo', ?, ?)", [
    JSON.stringify({ id: "b-viejo", name: "Barbero Viejo", initials: "BV", title: "Barber", chair: 1, rating: 5, reviews: 3, active: true }),
    stamp,
  ]);
  db.run("INSERT INTO services (id, data, updated_at) VALUES ('s-viejo', ?, ?)", [
    JSON.stringify({ id: "s-viejo", name: "Corte de antes", description: "", price: 8000, durationMin: 30, category: "corte", active: true }),
    stamp,
  ]);
  db.run("INSERT INTO clients (id, data, updated_at) VALUES ('c-viejo', ?, ?)", [
    JSON.stringify({
      id: "c-viejo",
      name: "Cliente Viejo",
      phone: "+54 9 11 2222 2222",
      notifications: { reminder24h: true, whatsapp: true, promos: false },
      credit: 4500,
      createdAt: stamp,
    }),
    stamp,
  ]);
  db.run(
    "INSERT INTO appointments (id, data, updated_at, date, client_id, barber_id, status) VALUES ('a-viejo', ?, ?, '2026-09-30', 'c-viejo', 'b-viejo', 'confirmado')",
    [
      JSON.stringify({
        id: "a-viejo",
        clientId: "c-viejo",
        clientName: "Cliente Viejo",
        clientPhone: "+54 9 11 2222 2222",
        verified: true,
        barberId: "b-viejo",
        serviceId: "s-viejo",
        serviceName: "Corte de antes",
        servicePrice: 8000,
        durationMin: 30,
        date: "2026-09-30",
        time: "11:00",
        deposit: { amount: 4000, status: "abonada", method: "transferencia", paidAt: stamp },
        products: [],
        status: "confirmado",
        source: "app",
        createdAt: stamp,
      }),
      stamp,
    ],
  );
  db.run(
    "INSERT INTO users (id, role, identifier, name, client_id, pin_hash, created_at) VALUES ('u-viejo-admin','admin','duenio@vieja.com','Dueño Viejo',NULL,'sal:hash',?)",
    [stamp],
  );
  db.run(
    "INSERT INTO users (id, role, identifier, name, client_id, pin_hash, created_at) VALUES ('u-viejo-cli','cliente','tel:1122222222','Cliente Viejo','c-viejo','sal:hash',?)",
    [stamp],
  );
  db.run("INSERT INTO secrets (scope, key, value, updated_at) VALUES ('default','mp_access_token','TOKEN-VIEJO',?)", [stamp]);

  fs.writeFileSync(file, Buffer.from(db.export()));
  db.close();
}

describe("migración de una base anterior a la multi-barbería", () => {
  it("conserva los datos y los deja en la barbería heredada", async () => {
    const file = path.join(dir, "legacy.db");
    await buildLegacyDb(file);
    process.env.DATABASE_PATH = file;
    delete (globalThis as { __dsDb?: unknown }).__dsDb;
    vi.resetModules();

    const { LEGACY_SHOP_ID } = await import("@/server/db");
    const { loadState, listShops } = await import("@/server/repository");

    // La barbería implícita quedó registrada, y es la única.
    const shops = await listShops();
    expect(shops).toHaveLength(1);
    expect(shops[0].id).toBe(LEGACY_SHOP_ID);
    expect(shops[0].slug).toBe("ds-studio");

    const { state, version } = await loadState(LEGACY_SHOP_ID);
    expect(version).toBe(7); // la versión de antes se respeta
    expect(state.businessInfo.name).toBe("Barbería Vieja");
    expect(state.cashRegister).toMatchObject({ open: true, openedAt: "09:00" });
    expect(state.barbers.map((b) => b.id)).toEqual(["b-viejo"]);
    expect(state.services.map((s) => s.id)).toEqual(["s-viejo"]);
    expect(state.clients[0]).toMatchObject({ id: "c-viejo", credit: 4500 });
    expect(state.appointments[0]).toMatchObject({ id: "a-viejo", status: "confirmado" });
    // Las credenciales del scope viejo siguen funcionando.
    expect(state.integrations.mercadopagoReady).toBe(true);

    const { getSecret } = await import("@/server/secrets");
    expect(await getSecret("mp_access_token", LEGACY_SHOP_ID)).toBe("TOKEN-VIEJO");
  });

  it("las cuentas siguen sirviendo y ahora admite el rol barbero", async () => {
    const { getDb, queryAll, queryOne } = await import("@/server/db");
    const db = await getDb();

    const users = queryAll<{ id: string; shop_id: string; role: string }>(db, "SELECT id, shop_id, role FROM users");
    expect(users).toHaveLength(2);
    expect(users.every((u) => u.shop_id === "s-default")).toBe(true);
    expect(queryOne(db, "SELECT id FROM users WHERE id = 'u-viejo-admin' AND role = 'admin'")).toBeDefined();

    // El CHECK viejo no admitía 'barbero'; después de migrar, sí.
    expect(() =>
      db.run(
        `INSERT INTO users (id, shop_id, role, identifier, name, client_id, barber_id, pin_hash, created_at)
         VALUES ('u-nuevo-barbero','s-default','barbero','tel:1133333333','Nuevo',NULL,'b-viejo','sal:hash','2026-09-19')`,
      ),
    ).not.toThrow();
  });

  it("abrir la base de nuevo no vuelve a migrar ni duplica nada", async () => {
    delete (globalThis as { __dsDb?: unknown }).__dsDb;
    vi.resetModules();
    const { loadState, listShops } = await import("@/server/repository");

    expect(await listShops()).toHaveLength(1);
    const { state } = await loadState("s-default");
    expect(state.appointments).toHaveLength(1);
    expect(state.clients).toHaveLength(1);
  });
});
