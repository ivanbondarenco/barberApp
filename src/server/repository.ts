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
import { initials, uid } from "@/lib/format";
import { DEFAULT_DEPOSIT_RATE } from "@/lib/pricing";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/schedule";
import type { Shop } from "@/lib/types";
import { hashPin, normalizeIdentifier } from "./crypto";
import { getDb, LEGACY_SHOP_ID, persist, queryAll, queryOne, transaction } from "./db";

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

/** Un estado cacheado por barbería; la versión de cada una avanza por su lado. */
const cache = new Map<string, { version: number; state: DomainState }>();

/** ¿La barbería tiene cargada esta credencial (o está la variable de entorno equivalente)? */
function hasSecret(db: Database, shopId: string, key: string, envVar: string): boolean {
  const row = queryOne<{ value: string }>(db, "SELECT value FROM secrets WHERE scope = ? AND key = ?", [shopId, key]);
  return !!(row?.value?.trim() || process.env[envVar]?.trim());
}

function getVersion(db: Database, shopId: string): number {
  return Number(
    queryOne<{ value: string }>(db, "SELECT value FROM meta WHERE shop_id = ? AND key = 'version'", [shopId])?.value ?? 0,
  );
}

function readState(db: Database, shopId: string): DomainState {
  const version = getVersion(db, shopId);
  const hit = cache.get(shopId);
  if (hit?.version === version) return hit.state;

  const rows = <T,>(table: string) =>
    queryAll<{ data: string }>(db, `SELECT data FROM ${table} WHERE shop_id = ?`, [shopId]).map(
      (r) => JSON.parse(r.data) as T,
    );
  const setting = <T,>(key: string) => {
    const row = queryOne<{ data: string }>(db, "SELECT data FROM settings WHERE shop_id = ? AND key = ?", [shopId, key]);
    return row ? (JSON.parse(row.data) as T) : undefined;
  };

  const withIds = new Set(
    queryAll<{ client_id: string }>(db, "SELECT client_id FROM users WHERE shop_id = ? AND client_id IS NOT NULL", [
      shopId,
    ]).map((r) => r.client_id),
  );
  const staffAccounts = new Map(
    queryAll<{ barber_id: string; identifier: string }>(
      db,
      "SELECT barber_id, identifier FROM users WHERE shop_id = ? AND barber_id IS NOT NULL",
      [shopId],
    ).map((r) => [r.barber_id, r.identifier]),
  );

  // El rating de cada barbero sale de los turnos calificados: no hay número inventado.
  const scores = new Map<string, { sum: number; count: number }>();
  for (const row of queryAll<{ data: string }>(db, "SELECT data FROM appointments WHERE shop_id = ?", [shopId])) {
    const a = JSON.parse(row.data) as { barberId: string; rating?: number };
    if (!a.rating) continue;
    const acc = scores.get(a.barberId) ?? { sum: 0, count: 0 };
    scores.set(a.barberId, { sum: acc.sum + a.rating, count: acc.count + 1 });
  }

  const state: DomainState = {
    clients: rows<DomainState["clients"][number]>(TABLES.clients).map((c) => ({ ...c, hasAccount: withIds.has(c.id) })),
    barbers: rows<DomainState["barbers"][number]>(TABLES.barbers).map((b) => {
      const score = scores.get(b.id);
      return {
        ...b,
        rating: score ? Math.round((score.sum / score.count) * 10) / 10 : undefined,
        reviews: score?.count ?? 0,
        hasAccount: staffAccounts.has(b.id),
        accountIdentifier: staffAccounts.get(b.id),
      };
    }),
    services: rows(TABLES.services),
    products: rows(TABLES.products),
    appointments: rows(TABLES.appointments),
    blocks: rows(TABLES.blocks),
    cashClosures: rows<DomainState["cashClosures"][number] & { id?: string }>(TABLES.cashClosures).sort((a, b) =>
      b.closedAt.localeCompare(a.closedAt),
    ),
    depositSettings: setting("depositSettings") ?? { allowCash: true, rate: DEFAULT_DEPOSIT_RATE },
    cashRegister: setting("cashRegister") ?? { open: false },
    businessHours: setting("businessHours") ?? DEFAULT_BUSINESS_HOURS,
    businessInfo: setting("businessInfo") ?? seedBusinessInfo,
    // Derivado, nunca persistido: solo dice si la barbería tiene credenciales, jamás cuáles.
    integrations: {
      mercadopagoReady: hasSecret(db, shopId, "mp_access_token", "MP_ACCESS_TOKEN"),
      whatsappReady:
        hasSecret(db, shopId, "wa_access_token", "WA_ACCESS_TOKEN") &&
        hasSecret(db, shopId, "wa_phone_number_id", "WA_PHONE_NUMBER_ID"),
    },
  };
  cache.set(shopId, { version, state });
  return state;
}

function writeState(db: Database, shopId: string, prev: DomainState, next: DomainState, stamp: string) {
  for (const key of Object.keys(TABLES) as Collection[]) {
    const table = TABLES[key];
    const before = new Map((prev[key] as { id: string }[]).map((x) => [x.id, JSON.stringify(x)]));
    const after = next[key] as { id: string }[];
    const keep = new Set<string>();

    for (const item of after) {
      // `hasAccount` / `accountIdentifier` se derivan de la tabla `users`: no se guardan en el JSON.
      const { hasAccount: _has, accountIdentifier: _ident, rating: _rating, reviews: _reviews, ...clean } = item as {
        id: string;
        hasAccount?: boolean;
        accountIdentifier?: string;
        rating?: number;
        reviews?: number;
      };
      // Clientes y barberos tienen campos derivados que no se persisten.
      const derived = key === "clients" || key === "barbers";
      const json = JSON.stringify(derived ? clean : item);
      keep.add(item.id);
      if (before.get(item.id) === JSON.stringify(item)) continue;
      if (key === "appointments") {
        const a = item as DomainState["appointments"][number];
        db.run(
          `INSERT INTO appointments (shop_id, id, data, updated_at, date, client_id, barber_id, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(shop_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at,
             date = excluded.date, client_id = excluded.client_id, barber_id = excluded.barber_id,
             status = excluded.status`,
          [shopId, a.id, json, stamp, a.date, a.clientId ?? null, a.barberId, a.status],
        );
      } else {
        db.run(
          `INSERT INTO ${table} (shop_id, id, data, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(shop_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
          [shopId, item.id, json, stamp],
        );
      }
    }
    for (const id of before.keys()) {
      if (!keep.has(id)) db.run(`DELETE FROM ${table} WHERE shop_id = ? AND id = ?`, [shopId, id]);
    }
  }

  for (const key of SETTINGS) {
    if (JSON.stringify(prev[key]) === JSON.stringify(next[key])) continue;
    db.run(
      `INSERT INTO settings (shop_id, key, data) VALUES (?, ?, ?)
       ON CONFLICT(shop_id, key) DO UPDATE SET data = excluded.data`,
      [shopId, key, JSON.stringify(next[key])],
    );
  }
}

function bumpVersion(db: Database, shopId: string): number {
  const version = getVersion(db, shopId) + 1;
  db.run(
    `INSERT INTO meta (shop_id, key, value) VALUES (?, 'version', ?)
     ON CONFLICT(shop_id, key) DO UPDATE SET value = excluded.value`,
    [shopId, String(version)],
  );
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
    depositSettings: { allowCash: true, rate: DEFAULT_DEPOSIT_RATE },
    cashRegister: { open: false },
    businessHours: DEFAULT_BUSINESS_HOURS,
    businessInfo: seedBusinessInfo,
    integrations: { mercadopagoReady: false, whatsappReady: false },
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
    depositSettings: { allowCash: true, rate: DEFAULT_DEPOSIT_RATE },
    cashRegister: { open: true, openedAt: "08:30" },
    businessHours: DEFAULT_BUSINESS_HOURS,
    businessInfo: seedBusinessInfo,
    integrations: { mercadopagoReady: false, whatsappReady: false },
  };
}

function seedUsers(db: Database, stamp: string) {
  const users = [
    { id: "u-admin", role: "admin", identifier: normalizeIdentifier(DEMO_ADMIN.identifier), name: DEMO_ADMIN.name, clientId: null },
    { id: "u-demo", role: "cliente", identifier: normalizeIdentifier(DEMO_CLIENT.phone), name: DEMO_CLIENT.name, clientId: DEMO_CLIENT.id },
  ];
  for (const u of users) {
    db.run(
      `INSERT INTO users (id, shop_id, role, identifier, name, client_id, pin_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET pin_hash = excluded.pin_hash, identifier = excluded.identifier,
         client_id = excluded.client_id`,
      [u.id, LEGACY_SHOP_ID, u.role, u.identifier, u.name, u.clientId, hashPin(DEMO_PIN), stamp],
    );
  }
}

/**
 * Crea la barbería de demostración solo si se pide explícitamente con SEED_DEMO=1.
 *
 * En una instalación real la base arranca vacía y la primera pantalla lleva al alta: nadie
 * quiere que su sistema se estrene con una barbería inventada, clientes falsos y turnos que
 * no existen.
 */
export async function ensureSeeded(): Promise<Database> {
  const db = await getDb();
  if (process.env.SEED_DEMO === "1" && !queryOne(db, "SELECT id FROM shops LIMIT 1")) {
    const stamp = new Date().toISOString();
    transaction(db, () => {
      db.run("INSERT INTO shops (id, slug, name, created_at) VALUES (?, ?, ?, ?)", [
        LEGACY_SHOP_ID,
        "ds-studio",
        seedBusinessInfo.name,
        stamp,
      ]);
      writeState(db, LEGACY_SHOP_ID, emptyState(), seedData(), stamp);
      seedUsers(db, stamp);
      bumpVersion(db, LEGACY_SHOP_ID);
    });
    cache.delete(LEGACY_SHOP_ID);
    await persist();
  }
  return db;
}

// ───────── Barberías ─────────

export function shopRow(db: Database, shopId: string): Shop | undefined {
  return queryOne<Shop>(db, "SELECT id, slug, name FROM shops WHERE id = ?", [shopId]);
}

export async function shopBySlug(slug: string): Promise<Shop | undefined> {
  const db = await ensureSeeded();
  return queryOne<Shop>(db, "SELECT id, slug, name FROM shops WHERE slug = ?", [slug.trim().toLowerCase()]);
}

/** Barberías publicadas, para el listado y para resolver el local cuando hay uno solo. */
export async function listShops(): Promise<Shop[]> {
  const db = await ensureSeeded();
  return queryAll<Shop>(db, "SELECT id, slug, name FROM shops ORDER BY name");
}

/** URL amigable a partir del nombre del local. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Catálogo mínimo con el que arranca una barbería nueva. */
function starterState(shopName: string, ownerName: string, contact: ShopContact): DomainState {
  const services: DomainState["services"] = [
    { id: "s-corte", name: "Corte de pelo", description: "", price: 10000, durationMin: 45, category: "corte", active: true, featured: true },
    { id: "s-barba", name: "Barba", description: "", price: 6000, durationMin: 30, category: "barba", active: true },
    { id: "s-combo", name: "Corte + Barba", description: "", price: 15000, durationMin: 60, category: "combo", active: true },
  ];
  return {
    ...emptyState(),
    services,
    barbers: [
      {
        id: "b-1",
        name: ownerName,
        initials: initials(ownerName),
        title: "Barbero",
        chair: 1,
        active: true,
      },
    ],
    // Nada de la demo: una barbería nueva no puede salir publicando la dirección ni el
    // WhatsApp de otro local. Lo que no se pidió en el alta queda vacío y lo completa el dueño.
    businessInfo: {
      name: shopName,
      address: contact.address,
      neighborhood: contact.neighborhood ?? "",
      whatsapp: contact.whatsapp,
      email: contact.email ?? "",
      instagram: "",
      transferAlias: "",
      transferCbu: "",
    },
    cashRegister: { open: false },
    businessHours: DEFAULT_BUSINESS_HOURS,
    depositSettings: { allowCash: true, rate: DEFAULT_DEPOSIT_RATE },
    integrations: { mercadopagoReady: false, whatsappReady: false },
    clients: [],
    products: [],
    appointments: [],
    blocks: [],
    cashClosures: [],
  };
}

/** Datos de contacto que la barbería publica a sus clientes. */
export interface ShopContact {
  address: string;
  whatsapp: string;
  neighborhood?: string;
  email?: string;
}

export interface NewShopInput extends ShopContact {
  name: string;
  ownerName: string;
  ownerIdentifier: string;
  ownerPin: string;
}

/**
 * Alta de una barbería con su dueño. Devuelve el id del usuario creado para abrir la sesión.
 * Todo ocurre en una transacción: o queda la barbería completa o no queda nada.
 */
export async function createShop(input: NewShopInput): Promise<{ shop: Shop; userId: string }> {
  const db = await ensureSeeded();
  const name = input.name.trim();
  const ownerName = input.ownerName.trim();
  const identifier = normalizeIdentifier(input.ownerIdentifier);
  const stamp = new Date().toISOString();

  const base = slugify(name);
  if (!base) throw new DomainError("Elegí un nombre válido para la barbería");

  // El slug es la URL pública del local: si está tomado, se numera.
  let slug = base;
  for (let n = 2; queryOne(db, "SELECT id FROM shops WHERE slug = ?", [slug]); n++) slug = `${base}-${n}`;

  const shopId = uid("s");
  const userId = uid("u");

  transaction(db, () => {
    db.run("INSERT INTO shops (id, slug, name, created_at) VALUES (?, ?, ?, ?)", [shopId, slug, name, stamp]);
    writeState(
      db,
      shopId,
      emptyState(),
      starterState(name, ownerName, {
        address: input.address.trim(),
        whatsapp: input.whatsapp.trim(),
        neighborhood: input.neighborhood?.trim(),
        email: input.email?.trim(),
      }),
      stamp,
    );
    db.run(
      `INSERT INTO users (id, shop_id, role, identifier, name, client_id, barber_id, pin_hash, created_at)
       VALUES (?, ?, 'admin', ?, ?, NULL, NULL, ?, ?)`,
      [userId, shopId, identifier, ownerName, hashPin(input.ownerPin), stamp],
    );
    bumpVersion(db, shopId);
  });

  cache.delete(shopId);
  await persist();
  return { shop: { id: shopId, slug, name }, userId };
}

// ───────── Estado y comandos ─────────

export async function loadState(shopId: string): Promise<{ state: DomainState; version: number }> {
  const db = await ensureSeeded();
  return { state: readState(db, shopId), version: getVersion(db, shopId) };
}

export async function executeCommand(actor: Actor, command: Command): Promise<{ state: DomainState; version: number }> {
  const db = await ensureSeeded();
  const shopId = actor.shopId;
  const prev = readState(db, shopId);
  const stamp = new Date().toISOString();
  // El reset se resuelve acá (no pasa por applyCommand), así que valida el permiso explícitamente.
  if (command.type === "demo.reset" && actor.role !== "admin") throw new DomainError("Acción reservada al staff", 403);

  const version = transaction(db, () => {
    if (command.type === "demo.reset") {
      // Solo tiene sentido en la barbería de demostración: es la única con datos sembrados.
      if (shopId !== LEGACY_SHOP_ID) throw new DomainError("No disponible para esta barbería", 403);
      writeState(db, shopId, prev, seedData(), stamp);
      seedUsers(db, stamp);
    } else {
      const next = applyCommand(prev, command, actor);
      writeState(db, shopId, prev, next, stamp);
      if (command.type === "client.delete") {
        const users = queryAll<{ id: string }>(db, "SELECT id FROM users WHERE shop_id = ? AND client_id = ?", [
          shopId,
          command.id,
        ]);
        for (const u of users) {
          db.run("DELETE FROM sessions WHERE user_id = ?", [u.id]);
          db.run("DELETE FROM users WHERE id = ?", [u.id]);
        }
      }
    }
    return bumpVersion(db, shopId);
  });

  cache.delete(shopId);
  await persist();
  return { state: readState(db, shopId), version };
}

/** Escritura directa usada por autenticación y credenciales (usuarios, sesiones, secretos). */
export async function mutate<T>(fn: (db: Database) => T, { touchesState = "" } = {}): Promise<T> {
  const db = await ensureSeeded();
  const result = transaction(db, () => {
    const value = fn(db);
    if (touchesState) bumpVersion(db, touchesState);
    return value;
  });
  if (touchesState) cache.delete(touchesState);
  await persist();
  return result;
}

export { readState, writeState, getVersion };
