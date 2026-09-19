import "server-only";
import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database, type SqlValue } from "sql.js";

/**
 * SQLite (sql.js / WebAssembly) persistido en disco.
 * - Un único proceso Node escribe; si otro proceso modificó el archivo, se recarga antes de operar.
 * - Las escrituras son atómicas: archivo temporal + rename.
 */
const DB_PATH = path.resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "ds-studio.db"));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS barbers (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS services (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS blocks (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cash_closures (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  date TEXT NOT NULL,
  client_id TEXT,
  barber_id TEXT NOT NULL,
  status TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS appointments_date ON appointments (date, barber_id);
CREATE INDEX IF NOT EXISTS appointments_client ON appointments (client_id);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('cliente', 'admin')),
  identifier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  client_id TEXT,
  pin_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
`;

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
      holder.db.run(SCHEMA);
      holder.mtimeMs = mtimeMs;
    }
  }
  return holder.db;
}

export async function persist(): Promise<void> {
  const holder = await globalForDb.__dsDb!;
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(/*turbopackIgnore: true*/ tmp, Buffer.from(holder.db.export()));
  fs.renameSync(/*turbopackIgnore: true*/ tmp, /*turbopackIgnore: true*/ DB_PATH);
  holder.mtimeMs = fs.statSync(/*turbopackIgnore: true*/ DB_PATH).mtimeMs;
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
