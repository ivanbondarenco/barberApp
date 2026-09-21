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
  "cash_closures",
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
CREATE TABLE IF NOT EXISTS cash_closures (shop_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (shop_id, id));
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
CREATE TABLE IF NOT EXISTS users (
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
CREATE UNIQUE INDEX IF NOT EXISTS users_shop_identifier ON users (shop_id, identifier);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL
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
  const usersSql = tableSql(db, "users");
  if (!usersSql) return; // Base nueva: la crea SCHEMA con la forma final.

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

  // Las credenciales guardadas bajo el scope viejo pasan a la barbería.
  db.run("UPDATE secrets SET scope = ? WHERE scope = 'default'", [legacy]);

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
  globalForDb.__dsDb ??= open();
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
