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

async function buildLegacyDb(file: string, { withSecrets = true } = {}) {
  const SQL = await initSqlJs({
    locateFile: (f) => path.join(process.cwd(), "node_modules", "sql.js", "dist", f),
  });
  const db = new SQL.Database();
  db.run(SCHEMA_V1);
  // Las bases más viejas son anteriores a las credenciales cifradas: no tienen `secrets`.
  if (!withSecrets) db.run("DROP TABLE secrets");

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
  // Ajuste de una función que ya no existe: la base vieja lo trae y el loader tiene que ignorarlo.
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
  if (withSecrets) {
    db.run("INSERT INTO secrets (scope, key, value, updated_at) VALUES ('default','mp_access_token','TOKEN-VIEJO',?)", [stamp]);
  }

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

    const users = queryAll<{ id: string; shop_id: string | null; role: string; password_hash: string }>(
      db,
      "SELECT id, shop_id, role, password_hash FROM users ORDER BY id",
    );
    // El dueño sigue en su barbería; el cliente pasa a tener una cuenta propia sumada a ella.
    expect(users).toMatchObject([
      { id: "u-viejo-admin", shop_id: "s-default", role: "admin" },
      { id: "u-viejo-cli", shop_id: null, role: "cliente" },
    ]);
    // El PIN hasheado se conserva: sirve como contraseña hasta que lo cambie.
    expect(users.every((u) => u.password_hash === "sal:hash")).toBe(true);
    expect(queryAll(db, "SELECT user_id, shop_id, client_id FROM memberships")).toEqual([
      { user_id: "u-viejo-cli", shop_id: "s-default", client_id: "c-viejo" },
    ]);

    // El CHECK viejo no admitía 'barbero'; después de migrar, sí.
    expect(() =>
      db.run(
        `INSERT INTO users (id, shop_id, role, identifier, name, barber_id, password_hash, created_at)
         VALUES ('u-nuevo-barbero','s-default','barbero','tel:1133333333','Nuevo','b-viejo','sal:hash','2026-09-19')`,
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

  it("migra también una base sin la tabla de credenciales", async () => {
    const file = path.join(dir, "legacy-sin-secrets.db");
    await buildLegacyDb(file, { withSecrets: false });
    process.env.DATABASE_PATH = file;
    delete (globalThis as { __dsDb?: unknown }).__dsDb;
    vi.resetModules();

    const { LEGACY_SHOP_ID } = await import("@/server/db");
    const { loadState, listShops } = await import("@/server/repository");

    expect((await listShops()).map((s) => s.id)).toEqual([LEGACY_SHOP_ID]);
    const { state } = await loadState(LEGACY_SHOP_ID);
    expect(state.appointments).toHaveLength(1);
    expect(state.integrations.mercadopagoReady).toBe(false);
  });

  it("une en una sola cuenta al cliente que estaba registrado en dos barberías", async () => {
    const SQL = await initSqlJs({
      locateFile: (f) => path.join(process.cwd(), "node_modules", "sql.js", "dist", f),
    });
    const db = new SQL.Database();
    // Una base v3: cada barbería con sus propias cuentas.
    db.run(`
      CREATE TABLE shops (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE clients (shop_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (shop_id, id));
      CREATE TABLE users (
        id TEXT PRIMARY KEY, shop_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('cliente', 'barbero', 'admin')),
        identifier TEXT NOT NULL, name TEXT NOT NULL, client_id TEXT, barber_id TEXT,
        pin_hash TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);
      INSERT INTO shops VALUES ('s-a','a','A','2026-01-01'), ('s-b','b','B','2026-01-01');
      INSERT INTO clients VALUES
        ('s-a','c-1','{"id":"c-1","name":"Ana","phone":"+54 9 11 3000 0001","email":"Ana@Test.com"}','2026-01-01'),
        ('s-b','c-9','{"id":"c-9","name":"Ana","phone":"+54 9 11 3000 0001"}','2026-01-01');
      INSERT INTO users VALUES
        ('u-a','s-a','cliente','tel:1130000001','Ana','c-1',NULL,'sal:a','2026-01-01'),
        ('u-b','s-b','cliente','tel:1130000001','Ana','c-9',NULL,'sal:b','2026-02-01'),
        ('u-dueno','s-a','admin','duenio@a.com','Dueño',NULL,NULL,'sal:d','2026-01-01');
      INSERT INTO sessions VALUES ('tok-b','u-b','2099-01-01');
    `);
    const file = path.join(dir, "v3-dos-barberias.db");
    fs.writeFileSync(file, Buffer.from(db.export()));
    db.close();

    process.env.DATABASE_PATH = file;
    delete (globalThis as { __dsDb?: unknown }).__dsDb;
    vi.resetModules();
    const { getDb, queryAll } = await import("@/server/db");
    const migrated = await getDb();

    // Una sola cuenta (la más vieja), que ahora entra con el email de su ficha.
    expect(queryAll(migrated, "SELECT id, identifier, phone, password_hash FROM users WHERE role = 'cliente'")).toEqual([
      { id: "u-a", identifier: "ana@test.com", phone: "+54 9 11 3000 0001", password_hash: "sal:a" },
    ]);
    expect(queryAll(migrated, "SELECT shop_id, client_id FROM memberships WHERE user_id = 'u-a' ORDER BY shop_id")).toEqual([
      { shop_id: "s-a", client_id: "c-1" },
      { shop_id: "s-b", client_id: "c-9" },
    ]);
    // La sesión abierta de la cuenta que se unió sigue viva, en su barbería.
    expect(queryAll(migrated, "SELECT user_id, shop_id FROM sessions")).toEqual([{ user_id: "u-a", shop_id: "s-b" }]);
    expect(queryAll(migrated, "SELECT id, shop_id FROM users WHERE role = 'admin'")).toEqual([{ id: "u-dueno", shop_id: "s-a" }]);
  });

  it("saca los servicios de ejemplo que el alta dejaba, y respeta los que el local hizo propios", async () => {
    const SQL = await initSqlJs({
      locateFile: (f) => path.join(process.cwd(), "node_modules", "sql.js", "dist", f),
    });
    const db = new SQL.Database();
    const service = (id: string, name: string, price: number, durationMin: number) =>
      JSON.stringify({ id, name, description: "", price, durationMin, category: "corte", active: true });

    db.run(`
      CREATE TABLE shops (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE meta (shop_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (shop_id, key));
      CREATE TABLE services (shop_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (shop_id, id));
      CREATE TABLE appointments (
        shop_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL,
        date TEXT NOT NULL, client_id TEXT, barber_id TEXT NOT NULL, status TEXT NOT NULL,
        PRIMARY KEY (shop_id, id)
      );
      CREATE TABLE users (
        id TEXT PRIMARY KEY, shop_id TEXT, email_verified_at TEXT,
        role TEXT NOT NULL CHECK (role IN ('cliente', 'barbero', 'admin')),
        identifier TEXT NOT NULL, name TEXT NOT NULL, barber_id TEXT, phone TEXT,
        password_hash TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, shop_id TEXT, expires_at TEXT NOT NULL);
      INSERT INTO shops VALUES ('s-x','x','X','2026-01-01'), ('s-y','y','Y','2026-01-01');
      INSERT INTO meta VALUES ('s-x','version','4'), ('s-y','version','9');
      INSERT INTO users VALUES ('u-x','s-x',NULL,'admin','duenio@x.com','Dueño',NULL,NULL,'sal:hash','2026-01-01');
    `);
    // s-x: los tres de ejemplo, uno de ellos ya usado en un turno.
    db.run("INSERT INTO services VALUES ('s-x','s-corte',?,'2026-01-01')", [service("s-corte", "Corte de pelo", 10000, 45)]);
    db.run("INSERT INTO services VALUES ('s-x','s-barba',?,'2026-01-01')", [service("s-barba", "Barba", 6000, 30)]);
    db.run("INSERT INTO services VALUES ('s-x','s-combo',?,'2026-01-01')", [service("s-combo", "Corte + Barba", 15000, 60)]);
    db.run(
      "INSERT INTO appointments VALUES ('s-x','a-1',?,'2026-01-01','2026-01-05',NULL,'b-1','completado')",
      [JSON.stringify({ id: "a-1", serviceId: "s-combo", barberId: "b-1", date: "2026-01-05" })],
    );
    // s-y: los hizo propios (otro precio y otro nombre), así que no se tocan.
    db.run("INSERT INTO services VALUES ('s-y','s-corte',?,'2026-01-01')", [service("s-corte", "Corte de pelo", 18000, 45)]);
    db.run("INSERT INTO services VALUES ('s-y','s-barba',?,'2026-01-01')", [service("s-barba", "Perfilado de barba", 6000, 30)]);

    const file = path.join(dir, "servicios-de-ejemplo.db");
    fs.writeFileSync(file, Buffer.from(db.export()));
    db.close();

    process.env.DATABASE_PATH = file;
    delete (globalThis as { __dsDb?: unknown }).__dsDb;
    vi.resetModules();
    const { getDb, queryAll } = await import("@/server/db");
    const migrated = await getDb();

    // En s-x quedan solo los que un turno ya usó; en s-y, los dos que el local hizo suyos.
    expect(queryAll(migrated, "SELECT shop_id, id FROM services ORDER BY shop_id, id")).toEqual([
      { shop_id: "s-x", id: "s-combo" },
      { shop_id: "s-y", id: "s-barba" },
      { shop_id: "s-y", id: "s-corte" },
    ]);
    // La barbería tocada avanza su versión (los navegadores abiertos se enteran); la otra, no.
    expect(queryAll(migrated, "SELECT shop_id, value FROM meta WHERE key = 'version' ORDER BY shop_id")).toEqual([
      { shop_id: "s-x", value: "5" },
      { shop_id: "s-y", value: "9" },
    ]);

    // Y abrirla otra vez no borra nada más.
    delete (globalThis as { __dsDb?: unknown }).__dsDb;
    vi.resetModules();
    const again = await (await import("@/server/db")).getDb();
    expect((await import("@/server/db")).queryAll(again, "SELECT shop_id, id FROM services")).toHaveLength(3);
  });
});
