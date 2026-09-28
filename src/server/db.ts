import "server-only";
import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database, type SqlValue } from "sql.js";

/**
 * SQLite (sql.js / WebAssembly) persistido en disco.
 * - Un único proceso Node escribe; si otro proceso modificó el archivo, se recarga antes de operar.
 * - Las escrituras son atómicas: archivo temporal + rename.
 *
 * Multi-barbería: cada fila de dominio lleva shop_id y la clave primaria es (shop_id, id), así
 * dos barberías pueden tener los mismos ids sembrados sin pisarse. Toda consulta filtra por
 * shop_id, y ese id sale siempre de la sesión: nunca de la URL ni del cuerpo del pedido.
 */
const DB_PATH = path.resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "ds-studio.db"));

/** Barbería a la que pertenecen los datos creados antes de la multi-barbería. */
export const LEGACY_SHOP_ID = "s-default";

/** Tablas de dominio: mismo formato (JSON por fila) y mismo alcance por barbería. */
export const SHOP_TABLES = [
  "clients",
  "barbers",
  "services",
  "products",
  "blocks",
  "appointments",
] as const;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (shop_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (shop_id, key));
CREATE TABLE IF NOT EXISTS settings (shop_id TEXT NOT NULL, key TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (shop_id, key));
CREATE TABLE IF NOT EXISTS clients (shop_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (shop_id, id));
CREATE TABLE IF NOT EXISTS barbers (shop_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (shop_id, id));
CREATE TABLE IF NOT EXISTS services (shop_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (shop_id, id));
CREATE TABLE IF NOT EXISTS products (shop_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (shop_id, id));
CREATE TABLE IF NOT EXISTS blocks (shop_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (shop_id, id));
CREATE TABLE IF NOT EXISTS appointments (
  shop_id TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  date TEXT NOT NULL,
  client_id TEXT,
  barber_id TEXT NOT NULL,
  status TEXT NOT NULL,
  PRIMARY KEY (shop_id, id)
);
CREATE INDEX IF NOT EXISTS appointments_date ON appointments (shop_id, date, barber_id);
CREATE INDEX IF NOT EXISTS appointments_client ON appointments (shop_id, client_id);
-- Cuentas. El staff (dueño y barberos) trabaja en una sola barbería: la de shop_id.
-- El cliente tiene una única cuenta (shop_id NULL) y se suma a las barberías por memberships.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('cliente', 'barbero', 'admin')),
  identifier TEXT NOT NULL,
  name TEXT NOT NULL,
  barber_id TEXT,
  -- Solo clientes: celular de contacto, para crear su ficha en cada barbería a la que se suma.
  phone TEXT,
  password_hash TEXT NOT NULL,
  -- Cuándo confirmó su email desde el link que le mandamos. NULL: todavía no lo hizo.
  email_verified_at TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_client_identifier ON users (identifier) WHERE role = 'cliente';
-- Sin UNIQUE a propósito: bases anteriores pueden traer el mismo dato en dos barberías.
-- Las altas nuevas lo impiden en el código (un barbero trabaja en una sola barbería).
CREATE INDEX IF NOT EXISTS users_staff_identifier ON users (identifier) WHERE role <> 'cliente';
-- Barberías en las que se atiende cada cliente, con su ficha (clients.id) en cada una.
CREATE TABLE IF NOT EXISTS memberships (
  user_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, shop_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_client ON memberships (shop_id, client_id);
-- shop_id: barbería activa de la sesión de un cliente (el staff siempre opera en la suya).
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  shop_id TEXT
);
CREATE TABLE IF NOT EXISTS secrets (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (scope, key)
);
CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  appointment_id TEXT NOT NULL,
  status TEXT NOT NULL,
  received_at TEXT NOT NULL
);
-- Links de un solo uso que se mandan por mail (hoy: confirmar el email).
-- Se guarda el hash del token, nunca el token.
CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
-- Códigos de verificación por WhatsApp. Se guarda el hash, nunca el código.
-- Hay a lo sumo uno vigente por (barbería, identificador, trámite): pedir otro reemplaza el anterior.
CREATE TABLE IF NOT EXISTS otp_codes (
  shop_id TEXT NOT NULL,
  identifier TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (shop_id, identifier, purpose)
);
`;

const tableSql = (db: Database, name: string): string | undefined =>
  queryOne<{ sql: string }>(db, "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", [name])?.sql;

/**
 * Migraciones de bases ya creadas. CREATE TABLE IF NOT EXISTS no toca una tabla existente,
 * así que los cambios de forma se aplican acá, en orden y de manera idempotente.
 *
 * SQLite no permite cambiar claves primarias ni restricciones: el patrón es crear la tabla
 * nueva, copiar las filas y renombrar.
 */
function migrate(db: Database): void {
  if (!tableSql(db, "users")) return; // Base nueva: la crea SCHEMA con la forma final.
  migrateToV3(db);
  migrateToV4(db);
  // v5: marca de email confirmado.
  if (!tableSql(db, "users")!.includes("email_verified_at")) {
    db.run("ALTER TABLE users ADD COLUMN email_verified_at TEXT");
  }
  dropStarterServices(db);
}

/** Servicios de ejemplo que el alta de barbería creaba, con su precio inventado. */
const STARTER_SERVICES: Record<string, { name: string; price: number; durationMin: number }> = {
  "s-corte": { name: "Corte de pelo", price: 10000, durationMin: 45 },
  "s-barba": { name: "Barba", price: 6000, durationMin: 30 },
  "s-combo": { name: "Corte + Barba", price: 15000, durationMin: 60 },
};

/**
 * v6: saca los servicios de ejemplo que el alta le dejaba a cada barbería nueva.
 *
 * El catálogo y los precios son de cada local, así que estos no son de nadie. Solo se borran los
 * que siguen tal cual se crearon (mismo nombre, precio y duración) y que ningún turno usó: si el
 * dueño los hizo propios cambiándoles algo, o ya trabajó con ellos, quedan donde están.
 */
function dropStarterServices(db: Database): void {
  if (!tableSql(db, "services") || !tableSql(db, "meta")) return;
  const ids = Object.keys(STARTER_SERVICES);
  const rows = queryAll<{ shop_id: string; id: string; data: string }>(
    db,
    `SELECT shop_id, id, data FROM services WHERE id IN (${ids.map(() => "?").join(", ")})`,
    ids,
  );

  const touched = new Set<string>();
  for (const row of rows) {
    const starter = STARTER_SERVICES[row.id];
    const service = JSON.parse(row.data) as { name: string; price: number; durationMin: number };
    if (service.name !== starter.name || service.price !== starter.price || service.durationMin !== starter.durationMin) continue;
    const used = queryOne<{ n: number }>(
      db,
      "SELECT COUNT(*) AS n FROM appointments WHERE shop_id = ? AND data LIKE ?",
      [row.shop_id, `%"serviceId":"${row.id}"%`],
    );
    if ((used?.n ?? 0) > 0) continue;
    db.run("DELETE FROM services WHERE shop_id = ? AND id = ?", [row.shop_id, row.id]);
    touched.add(row.shop_id);
  }

  // Cada barbería tocada avanza su versión: así los navegadores abiertos se enteran.
  for (const shopId of touched) {
    const current = Number(
      queryOne<{ value: string }>(db, "SELECT value FROM meta WHERE shop_id = ? AND key = 'version'", [shopId])?.value ?? 0,
    );
    db.run(
      `INSERT INTO meta (shop_id, key, value) VALUES (?, 'version', ?)
       ON CONFLICT(shop_id, key) DO UPDATE SET value = excluded.value`,
      [shopId, String(current + 1)],
    );
  }
}

function migrateToV3(db: Database): void {
  const usersSql = tableSql(db, "users")!;

  // v2: rol `barbero` y vínculo con el sillón.
  if (!usersSql.includes("'barbero'")) {
    db.run(`
      CREATE TABLE users_v2 (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL CHECK (role IN ('cliente', 'barbero', 'admin')),
        identifier TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        client_id TEXT,
        barber_id TEXT,
        pin_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO users_v2 (id, role, identifier, name, client_id, barber_id, pin_hash, created_at)
        SELECT id, role, identifier, name, client_id, NULL, pin_hash, created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_v2 RENAME TO users;
    `);
  } else if (!usersSql.includes("barber_id")) {
    db.run("ALTER TABLE users ADD COLUMN barber_id TEXT");
  }

  // v3: multi-barbería. Todo lo que había pasa a ser la barbería LEGACY_SHOP_ID.
  if (tableSql(db, "users")?.includes("shop_id")) return;

  const legacy = LEGACY_SHOP_ID;
  const hadUsers = (queryOne<{ n: number }>(db, "SELECT COUNT(*) AS n FROM users")?.n ?? 0) > 0;

  for (const table of SHOP_TABLES) {
    if (tableSql(db, table)?.includes("shop_id")) continue;
    const isAppointments = table === "appointments";
    const extra = isAppointments ? ", date, client_id, barber_id, status" : "";
    const declared = isAppointments
      ? `shop_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL,
         date TEXT NOT NULL, client_id TEXT, barber_id TEXT NOT NULL, status TEXT NOT NULL,
         PRIMARY KEY (shop_id, id)`
      : `shop_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL,
         PRIMARY KEY (shop_id, id)`;
    db.run(`
      CREATE TABLE ${table}_v3 (${declared});
      INSERT INTO ${table}_v3 (shop_id, id, data, updated_at${extra})
        SELECT '${legacy}', id, data, updated_at${extra} FROM ${table};
      DROP TABLE ${table};
      ALTER TABLE ${table}_v3 RENAME TO ${table};
    `);
  }

  db.run(`
    CREATE TABLE meta_v3 (shop_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (shop_id, key));
    INSERT INTO meta_v3 (shop_id, key, value) SELECT '${legacy}', key, value FROM meta;
    DROP TABLE meta;
    ALTER TABLE meta_v3 RENAME TO meta;

    CREATE TABLE settings_v3 (shop_id TEXT NOT NULL, key TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (shop_id, key));
    INSERT INTO settings_v3 (shop_id, key, data) SELECT '${legacy}', key, data FROM settings;
    DROP TABLE settings;
    ALTER TABLE settings_v3 RENAME TO settings;

    CREATE TABLE users_v3 (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('cliente', 'barbero', 'admin')),
      identifier TEXT NOT NULL,
      name TEXT NOT NULL,
      client_id TEXT,
      barber_id TEXT,
      pin_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    INSERT INTO users_v3 (id, shop_id, role, identifier, name, client_id, barber_id, pin_hash, created_at)
      SELECT id, '${legacy}', role, identifier, name, client_id, barber_id, pin_hash, created_at FROM users;
    DROP TABLE users;
    ALTER TABLE users_v3 RENAME TO users;
    CREATE UNIQUE INDEX users_shop_identifier ON users (shop_id, identifier);
  `);

  // Las credenciales guardadas bajo el scope viejo pasan a la barbería. Las bases anteriores
  // a las credenciales cifradas no tienen la tabla: la crea SCHEMA después.
  if (tableSql(db, "secrets")) {
    db.run("UPDATE secrets SET scope = ? WHERE scope = 'default'", [legacy]);
  }

  if (tableSql(db, "payment_events") && !tableSql(db, "payment_events")!.includes("shop_id")) {
    db.run(`
      CREATE TABLE payment_events_v3 (
        id TEXT PRIMARY KEY, shop_id TEXT NOT NULL, appointment_id TEXT NOT NULL,
        status TEXT NOT NULL, received_at TEXT NOT NULL
      );
      INSERT INTO payment_events_v3 (id, shop_id, appointment_id, status, received_at)
        SELECT id, '${legacy}', appointment_id, status, received_at FROM payment_events;
      DROP TABLE payment_events;
      ALTER TABLE payment_events_v3 RENAME TO payment_events;
    `);
  }

  // Y queda registrada la barbería que hasta ahora era implícita.
  if (hadUsers) {
    db.run(`
      CREATE TABLE IF NOT EXISTS shops (
        id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at TEXT NOT NULL
      );
    `);
    db.run("INSERT OR IGNORE INTO shops (id, slug, name, created_at) VALUES (?, ?, ?, ?)", [
      legacy,
      "ds-studio",
      "D.S Studio Barbería",
      new Date().toISOString(),
    ]);
  }
}

interface LegacyUser {
  id: string;
  shop_id: string;
  role: string;
  identifier: string;
  name: string;
  client_id: string | null;
  barber_id: string | null;
  pin_hash: string;
  created_at: string;
}

/**
 * v4: cuentas de cliente únicas y contraseñas.
 *
 * Hasta v3 cada barbería tenía sus propias cuentas: la misma persona era un usuario distinto
 * en cada local. Ahora el cliente tiene una sola cuenta y se suma a varias barberías.
 * - Los clientes con el mismo identificador en varias barberías se unen en una cuenta (la más
 *   vieja) y cada barbería queda como una membership con su ficha.
 * - Se entra con email: si la cuenta era por celular y la ficha tiene email libre, pasa a ser ese.
 * - El PIN hasheado sigue sirviendo como contraseña hasta que la persona la cambie.
 */
function migrateToV4(db: Database): void {
  if (tableSql(db, "users")!.includes("password_hash")) return;

  const users = queryAll<LegacyUser>(db, "SELECT * FROM users ORDER BY created_at, id");
  const profile = (shopId: string, clientId: string): { email?: string; phone?: string } => {
    const row = queryOne<{ data: string }>(db, "SELECT data FROM clients WHERE shop_id = ? AND id = ?", [shopId, clientId]);
    const data = row ? (JSON.parse(row.data) as { email?: string; phone?: string }) : {};
    const email = data.email?.trim().toLowerCase();
    return { email: email?.includes("@") ? email : undefined, phone: data.phone };
  };

  db.run(`
    CREATE TABLE users_v4 (
      id TEXT PRIMARY KEY,
      shop_id TEXT,
      role TEXT NOT NULL CHECK (role IN ('cliente', 'barbero', 'admin')),
      identifier TEXT NOT NULL,
      name TEXT NOT NULL,
      barber_id TEXT,
      phone TEXT,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS memberships (
      user_id TEXT NOT NULL, shop_id TEXT NOT NULL, client_id TEXT NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, shop_id)
    );
  `);
  if (tableSql(db, "sessions") && !tableSql(db, "sessions")!.includes("shop_id")) {
    db.run("ALTER TABLE sessions ADD COLUMN shop_id TEXT");
  }

  // Staff: se copia tal cual.
  for (const u of users.filter((x) => x.role !== "cliente")) {
    db.run(
      `INSERT INTO users_v4 (id, shop_id, role, identifier, name, barber_id, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.id, u.shop_id, u.role, u.identifier, u.name, u.barber_id, u.pin_hash, u.created_at],
    );
  }

  // Clientes: una cuenta por identificador, con una membership por barbería.
  const groups = new Map<string, LegacyUser[]>();
  for (const u of users.filter((x) => x.role === "cliente" && x.client_id)) {
    groups.set(u.identifier, [...(groups.get(u.identifier) ?? []), u]);
  }
  const taken = new Set([...groups.keys()].filter((k) => !k.startsWith("tel:")));
  for (const [identifier, rows] of groups) {
    const account = rows[0];
    let final = identifier;
    if (identifier.startsWith("tel:")) {
      const email = rows.map((r) => profile(r.shop_id, r.client_id!).email).find((e) => e && !taken.has(e));
      if (email) final = email;
    }
    taken.add(final);
    const phone = rows.map((r) => profile(r.shop_id, r.client_id!).phone).find(Boolean) ?? null;
    db.run(
      `INSERT INTO users_v4 (id, shop_id, role, identifier, name, barber_id, phone, password_hash, created_at)
       VALUES (?, NULL, 'cliente', ?, ?, NULL, ?, ?, ?)`,
      [account.id, final, account.name, phone, account.pin_hash, account.created_at],
    );
    for (const r of rows) {
      db.run("INSERT OR IGNORE INTO memberships (user_id, shop_id, client_id, created_at) VALUES (?, ?, ?, ?)", [
        account.id,
        r.shop_id,
        r.client_id,
        r.created_at,
      ]);
      // Las sesiones abiertas siguen valiendo, ahora sobre la cuenta unificada y en su barbería.
      db.run("UPDATE sessions SET user_id = ?, shop_id = ? WHERE user_id = ?", [account.id, r.shop_id, r.id]);
    }
  }

  db.run(`
    DROP TABLE users;
    ALTER TABLE users_v4 RENAME TO users;
  `);
}

interface DbHolder {
  db: Database;
  mtimeMs: number;
}

const globalForDb = globalThis as unknown as { __dsDb?: Promise<DbHolder> };

async function open(): Promise<DbHolder> {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(/*turbopackIgnore: true*/ process.cwd(), "node_modules", "sql.js", "dist", file),
  });
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(DB_PATH), { recursive: true });
  const exists = fs.existsSync(/*turbopackIgnore: true*/ DB_PATH);
  const db = exists ? new SQL.Database(fs.readFileSync(/*turbopackIgnore: true*/ DB_PATH)) : new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  // Primero se migra lo viejo y después se completa lo que falte: al revés, SCHEMA crearía
  // tablas con la forma nueva junto a las viejas y la migración no encontraría qué copiar.
  migrate(db);
  db.run(SCHEMA);
  const holder = { db, mtimeMs: exists ? fs.statSync(/*turbopackIgnore: true*/ DB_PATH).mtimeMs : 0 };
  (holder as DbHolder & { SQL: typeof SQL }).SQL = SQL;
  return holder;
}

export async function getDb(): Promise<Database> {
  // Si abrir falla no se guarda la promesa rechazada: el próximo pedido vuelve a intentar.
  globalForDb.__dsDb ??= open().catch((error) => {
    globalForDb.__dsDb = undefined;
    throw error;
  });
  const holder = await globalForDb.__dsDb;

  // Otro proceso escribió el archivo: recargar para no pisar cambios.
  if (fs.existsSync(/*turbopackIgnore: true*/ DB_PATH)) {
    const { mtimeMs } = fs.statSync(/*turbopackIgnore: true*/ DB_PATH);
    if (holder.mtimeMs && mtimeMs > holder.mtimeMs) {
      const SQL = (holder as DbHolder & { SQL: Awaited<ReturnType<typeof initSqlJs>> }).SQL;
      holder.db.close();
      holder.db = new SQL.Database(fs.readFileSync(/*turbopackIgnore: true*/ DB_PATH));
      migrate(holder.db);
      holder.db.run(SCHEMA);
      holder.mtimeMs = mtimeMs;
    }
  }
  return holder.db;
}

/**
 * Métricas de la última escritura. Las expone /api/health para ver venir el techo:
 * con sql.js cada guardado reescribe el archivo entero, así que el costo crece con los datos.
 */
export const storageStats = { lastWriteMs: 0, bytes: 0, writes: 0, coalesced: 0 };

async function writeToDisk(): Promise<void> {
  const holder = await globalForDb.__dsDb!;
  const started = Date.now();
  const tmp = `${DB_PATH}.tmp`;
  const data = Buffer.from(holder.db.export());
  // Asíncrono y atómico: temporal + rename, sin bloquear el event loop mientras escribe.
  await fs.promises.writeFile(/*turbopackIgnore: true*/ tmp, data);
  await fs.promises.rename(/*turbopackIgnore: true*/ tmp, /*turbopackIgnore: true*/ DB_PATH);
  holder.mtimeMs = fs.statSync(/*turbopackIgnore: true*/ DB_PATH).mtimeMs;
  storageStats.lastWriteMs = Date.now() - started;
  storageStats.bytes = data.byteLength;
  storageStats.writes += 1;
}

let inFlight: Promise<void> | null = null;
let followUp: Promise<void> | null = null;

/**
 * Guarda la base en disco, juntando las escrituras que caen juntas.
 *
 * Cada guardado serializa el estado ACTUAL, así que una sola escritura posterior cubre a todos
 * los que estaban esperando: en una ráfaga de N comandos se escribe dos veces, no N. Quien
 * llama sigue recibiendo una promesa que recién resuelve cuando su cambio ya está en disco.
 */
export function persist(): Promise<void> {
  if (!inFlight) {
    inFlight = writeToDisk().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }
  if (!followUp) {
    storageStats.coalesced += 1;
    followUp = inFlight
      .catch(() => undefined)
      .then(() => {
        followUp = null;
        return persist();
      });
  }
  return followUp;
}

export function queryAll<T = Record<string, SqlValue>>(db: Database, sql: string, params: SqlValue[] = []): T[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.free();
  }
}

export function queryOne<T = Record<string, SqlValue>>(db: Database, sql: string, params: SqlValue[] = []): T | undefined {
  return queryAll<T>(db, sql, params)[0];
}

export function transaction<T>(db: Database, fn: () => T): T {
  db.run("BEGIN");
  try {
    const result = fn();
    db.run("COMMIT");
    return result;
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}
