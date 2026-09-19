import "server-only";
import type { Database } from "sql.js";
import { applyCommand, DomainError, type Actor, type Command, type DomainState } from "@/lib/commands";
import {
  barbers as seedBarbers,
  buildSeedAppointments,
  buildSeedBlocks,
  buildSeedClients,
  buildSeedClosures,
  DEMO_ADMIN,
  DEMO_CLIENT,
  DEMO_PIN,
  seedBusinessInfo,
  seedProducts,
  seedServices,
} from "@/lib/mock-data";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/schedule";
import { hashPin, normalizeIdentifier } from "./crypto";
import { getDb, persist, queryAll, queryOne, transaction } from "./db";

type Collection = "clients" | "barbers" | "services" | "products" | "appointments" | "blocks" | "cashClosures";
const TABLES: Record<Collection, string> = {
  clients: "clients",
  barbers: "barbers",
  services: "services",
  products: "products",
  appointments: "appointments",
  blocks: "blocks",
  cashClosures: "cash_closures",
};
const SETTINGS = ["depositSettings", "cashRegister", "businessHours", "businessInfo"] as const;

let cache: { version: number; state: DomainState } | null = null;

function getVersion(db: Database): number {
  return Number(queryOne<{ value: string }>(db, "SELECT value FROM meta WHERE key = 'version'")?.value ?? 0);
}

function readState(db: Database): DomainState {
  const version = getVersion(db);
  if (cache?.version === version) return cache.state;

  const rows = <T,>(table: string) =>
    queryAll<{ data: string }>(db, `SELECT data FROM ${table}`).map((r) => JSON.parse(r.data) as T);
  const setting = <T,>(key: string) => {
    const row = queryOne<{ data: string }>(db, "SELECT data FROM settings WHERE key = ?", [key]);
    return row ? (JSON.parse(row.data) as T) : undefined;
  };

  const withIds = new Set(queryAll<{ client_id: string }>(db, "SELECT client_id FROM users WHERE client_id IS NOT NULL").map((r) => r.client_id));

  const state: DomainState = {
    clients: rows<DomainState["clients"][number]>(TABLES.clients).map((c) => ({ ...c, hasAccount: withIds.has(c.id) })),
    barbers: rows(TABLES.barbers),
    services: rows(TABLES.services),
    products: rows(TABLES.products),
    appointments: rows(TABLES.appointments),
    blocks: rows(TABLES.blocks),
    cashClosures: rows<DomainState["cashClosures"][number] & { id?: string }>(TABLES.cashClosures).sort((a, b) =>
      b.closedAt.localeCompare(a.closedAt),
    ),
    depositSettings: setting("depositSettings") ?? { allowCash: true },
    cashRegister: setting("cashRegister") ?? { open: false },
    businessHours: setting("businessHours") ?? DEFAULT_BUSINESS_HOURS,
    businessInfo: setting("businessInfo") ?? seedBusinessInfo,
  };
  cache = { version, state };
  return state;
}

function writeState(db: Database, prev: DomainState, next: DomainState, stamp: string) {
  for (const key of Object.keys(TABLES) as Collection[]) {
    const table = TABLES[key];
    const before = new Map((prev[key] as { id: string }[]).map((x) => [x.id, JSON.stringify(x)]));
    const after = next[key] as { id: string }[];
    const keep = new Set<string>();

    for (const item of after) {
      const { hasAccount: _derived, ...clean } = item as { id: string; hasAccount?: boolean };
      const json = JSON.stringify(key === "clients" ? clean : item);
      keep.add(item.id);
      if (before.get(item.id) === JSON.stringify(item)) continue;
      if (key === "appointments") {
        const a = item as DomainState["appointments"][number];
        db.run(
          `INSERT INTO appointments (id, data, updated_at, date, client_id, barber_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, date = excluded.date,
             client_id = excluded.client_id, barber_id = excluded.barber_id, status = excluded.status`,
          [a.id, json, stamp, a.date, a.clientId ?? null, a.barberId, a.status],
        );
      } else {
        db.run(
          `INSERT INTO ${table} (id, data, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
          [item.id, json, stamp],
        );
      }
    }
    for (const id of before.keys()) if (!keep.has(id)) db.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
  }

  for (const key of SETTINGS) {
    if (JSON.stringify(prev[key]) === JSON.stringify(next[key])) continue;
    db.run("INSERT INTO settings (key, data) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data", [
      key,
      JSON.stringify(next[key]),
    ]);
  }
}

function bumpVersion(db: Database): number {
  const version = getVersion(db) + 1;
  db.run("INSERT INTO meta (key, value) VALUES ('version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [
    String(version),
  ]);
  return version;
}

function emptyState(): DomainState {
  return {
    clients: [],
    barbers: [],
    services: [],
    products: [],
    appointments: [],
    blocks: [],
    cashClosures: [],
    depositSettings: { allowCash: true },
    cashRegister: { open: false },
    businessHours: DEFAULT_BUSINESS_HOURS,
    businessInfo: seedBusinessInfo,
  };
}

function seedData(): DomainState {
  return {
    clients: buildSeedClients(),
    barbers: seedBarbers,
    services: seedServices,
    products: seedProducts,
    appointments: buildSeedAppointments(),
    blocks: buildSeedBlocks(),
    cashClosures: buildSeedClosures().map((c) => ({ ...c })),
    depositSettings: { allowCash: true },
    cashRegister: { open: true, openedAt: "08:30" },
    businessHours: DEFAULT_BUSINESS_HOURS,
    businessInfo: seedBusinessInfo,
  };
}

function seedUsers(db: Database, stamp: string) {
  const users = [
    { id: "u-admin", role: "admin", identifier: normalizeIdentifier(DEMO_ADMIN.identifier), name: DEMO_ADMIN.name, clientId: null },
    { id: "u-demo", role: "cliente", identifier: normalizeIdentifier(DEMO_CLIENT.phone), name: DEMO_CLIENT.name, clientId: DEMO_CLIENT.id },
  ];
  for (const u of users) {
    db.run(
      `INSERT INTO users (id, role, identifier, name, client_id, pin_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET pin_hash = excluded.pin_hash, identifier = excluded.identifier, client_id = excluded.client_id`,
      [u.id, u.role, u.identifier, u.name, u.clientId, hashPin(DEMO_PIN), stamp],
    );
  }
}

/** Crea y siembra la base si está vacía. */
export async function ensureSeeded(): Promise<Database> {
  const db = await getDb();
  if (getVersion(db) === 0) {
    const stamp = new Date().toISOString();
    transaction(db, () => {
      writeState(db, emptyState(), seedData(), stamp);
      seedUsers(db, stamp);
      bumpVersion(db);
    });
    cache = null;
    await persist();
  }
  return db;
}

export async function loadState(): Promise<{ state: DomainState; version: number }> {
  const db = await ensureSeeded();
  return { state: readState(db), version: getVersion(db) };
}

export async function executeCommand(actor: Actor, command: Command): Promise<{ state: DomainState; version: number }> {
  const db = await ensureSeeded();
  const prev = readState(db);
  const stamp = new Date().toISOString();
  // El reset se resuelve acá (no pasa por applyCommand), así que valida el permiso explícitamente.
  if (command.type === "demo.reset" && actor.role !== "admin") throw new DomainError("Acción reservada al staff", 403);

  const version = transaction(db, () => {
    if (command.type === "demo.reset") {
      writeState(db, prev, seedData(), stamp);
      seedUsers(db, stamp);
    } else {
      const next = applyCommand(prev, command, actor);
      writeState(db, prev, next, stamp);
      if (command.type === "client.delete") {
        const users = queryAll<{ id: string }>(db, "SELECT id FROM users WHERE client_id = ?", [command.id]);
        for (const u of users) {
          db.run("DELETE FROM sessions WHERE user_id = ?", [u.id]);
          db.run("DELETE FROM users WHERE id = ?", [u.id]);
        }
      }
    }
    return bumpVersion(db);
  });

  cache = null;
  await persist();
  return { state: readState(db), version };
}

/** Escritura directa usada por el módulo de autenticación (usuarios y sesiones). */
export async function mutate<T>(fn: (db: Database) => T, { touchesState = false } = {}): Promise<T> {
  const db = await ensureSeeded();
  const result = transaction(db, () => {
    const value = fn(db);
    if (touchesState) bumpVersion(db);
    return value;
  });
  if (touchesState) cache = null;
  await persist();
  return result;
}

export { readState, writeState, getVersion };
