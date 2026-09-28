import "server-only";
import type { Database } from "sql.js";
import { applyCommand, DomainError, type Actor, type Command, type DomainState } from "@/lib/commands";
import {
  barbers as seedBarbers,
  buildSeedAppointments,
  buildSeedBlocks,
  buildSeedClients,
  DEMO_ADMIN,
  DEMO_CLIENT,
  DEMO_PASSWORD,
  seedBusinessInfo,
  seedProducts,
  seedServices,
} from "@/lib/mock-data";
import { initials, phoneKey, uid } from "@/lib/format";
import { DEFAULT_DEPOSIT_RATE } from "@/lib/pricing";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/schedule";
import type { ClientProfile, Shop } from "@/lib/types";
import { hashPassword, normalizeIdentifier } from "./crypto";
import { getDb, LEGACY_SHOP_ID, persist, queryAll, queryOne, transaction } from "./db";
import { notifyAppointment } from "./notify";

type Collection = "clients" | "barbers" | "services" | "products" | "appointments" | "blocks";
const TABLES: Record<Collection, string> = {
  clients: "clients",
  barbers: "barbers",
  services: "services",
  products: "products",
  appointments: "appointments",
  blocks: "blocks",
};
const SETTINGS = ["depositSettings", "businessHours", "businessInfo"] as const;

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
    queryAll<{ client_id: string }>(db, "SELECT client_id FROM memberships WHERE shop_id = ?", [shopId]).map(
      (r) => r.client_id,
    ),
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
    depositSettings: setting("depositSettings") ?? { allowCash: true, rate: DEFAULT_DEPOSIT_RATE },
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
    depositSettings: { allowCash: true, rate: DEFAULT_DEPOSIT_RATE },
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
    depositSettings: { allowCash: true, rate: DEFAULT_DEPOSIT_RATE },
    businessHours: DEFAULT_BUSINESS_HOURS,
    businessInfo: seedBusinessInfo,
    integrations: { mercadopagoReady: false, whatsappReady: false },
  };
}

function seedUsers(db: Database, stamp: string) {
  const users = [
    { id: "u-admin", shopId: LEGACY_SHOP_ID, role: "admin", identifier: normalizeIdentifier(DEMO_ADMIN.identifier), name: DEMO_ADMIN.name, phone: null },
    { id: "u-demo", shopId: null, role: "cliente", identifier: normalizeIdentifier(DEMO_CLIENT.email), name: DEMO_CLIENT.name, phone: DEMO_CLIENT.phone },
  ];
  for (const u of users) {
    db.run(
      `INSERT INTO users (id, shop_id, role, identifier, name, barber_id, phone, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, identifier = excluded.identifier`,
      [u.id, u.shopId, u.role, u.identifier, u.name, u.phone, hashPassword(DEMO_PASSWORD), stamp],
    );
  }
  db.run(
    `INSERT INTO memberships (user_id, shop_id, client_id, created_at) VALUES ('u-demo', ?, ?, ?)
     ON CONFLICT(user_id, shop_id) DO UPDATE SET client_id = excluded.client_id`,
    [LEGACY_SHOP_ID, DEMO_CLIENT.id, stamp],
  );
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

/**
 * Con qué arranca una barbería nueva: su dueño en el primer sillón y nada más.
 *
 * El catálogo lo carga cada local. Los servicios y los precios son de la barbería, así que
 * inventarle un "Corte de pelo a $10.000" solo lo obliga a corregir precios que nunca puso.
 */
function starterState(shopName: string, ownerName: string, contact: ShopContact): DomainState {
  return {
    ...emptyState(),
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
    businessHours: DEFAULT_BUSINESS_HOURS,
    depositSettings: { allowCash: true, rate: DEFAULT_DEPOSIT_RATE },
    integrations: { mercadopagoReady: false, whatsappReady: false },
    clients: [],
    products: [],
    appointments: [],
    blocks: [],
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
  ownerPassword: string;
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
  // Un barbero (y el dueño) trabaja en una sola barbería.
  if (staffByIdentifier(db, identifier).length) {
    throw new DomainError("Ya hay una cuenta de barbería con ese celular o email. Iniciá sesión.", 409);
  }

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
      `INSERT INTO users (id, shop_id, role, identifier, name, barber_id, password_hash, created_at)
       VALUES (?, ?, 'admin', ?, ?, NULL, ?, ?)`,
      [userId, shopId, identifier, ownerName, hashPassword(input.ownerPassword), stamp],
    );
    bumpVersion(db, shopId);
  });

  cache.delete(shopId);
  await persist();
  return { shop: { id: shopId, slug, name }, userId };
}

// ───────── Cuentas ─────────

/**
 * Cuentas de staff con ese identificador. Las altas nuevas garantizan que haya a lo sumo una;
 * una base anterior a la v4 puede traer el mismo dato en dos barberías.
 */
export function staffByIdentifier<T = { id: string; password_hash: string }>(db: Database, identifier: string): T[] {
  return queryAll<T>(db, "SELECT * FROM users WHERE role <> 'cliente' AND identifier = ? ORDER BY created_at", [identifier]);
}

/** Datos con los que un cliente aparece en la ficha de cada barbería a la que se suma. */
export interface ClientContact {
  name: string;
  phone: string;
  email: string;
}

/**
 * Suma un cliente a una barbería. Si el local ya lo tenía cargado por el celular (por ejemplo,
 * un turno tomado por teléfono), se vincula esa ficha en vez de duplicarla.
 * Va dentro de la transacción de quien la llama.
 */
export function joinShopTx(db: Database, userId: string, shopId: string, contact: ClientContact, stamp: string): string {
  const current = queryOne<{ client_id: string }>(db, "SELECT client_id FROM memberships WHERE user_id = ? AND shop_id = ?", [
    userId,
    shopId,
  ]);
  if (current) return current.client_id;

  const linked = new Set(
    queryAll<{ client_id: string }>(db, "SELECT client_id FROM memberships WHERE shop_id = ?", [shopId]).map((r) => r.client_id),
  );
  const existing = queryAll<{ id: string; data: string }>(db, "SELECT id, data FROM clients WHERE shop_id = ?", [shopId]).find(
    (row) => !linked.has(row.id) && phoneKey((JSON.parse(row.data) as ClientProfile).phone) === phoneKey(contact.phone),
  );
  const clientId = existing?.id ?? uid("c");
  const profile: ClientProfile = existing
    ? { ...(JSON.parse(existing.data) as ClientProfile), name: contact.name, email: contact.email || undefined }
    : {
        id: clientId,
        name: contact.name,
        phone: contact.phone,
        email: contact.email || undefined,
        notifications: { reminder24h: true, whatsapp: true },
        credit: 0,
        createdAt: stamp,
      };
  db.run(
    `INSERT INTO clients (shop_id, id, data, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(shop_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    [shopId, clientId, JSON.stringify(profile), stamp],
  );
  db.run("INSERT INTO memberships (user_id, shop_id, client_id, created_at) VALUES (?, ?, ?, ?)", [userId, shopId, clientId, stamp]);
  bumpVersion(db, shopId);
  cache.delete(shopId);
  return clientId;
}

/** Contacto de la cuenta de un cliente: con esto se arma su ficha en cada barbería a la que se suma. */
export function clientContact(db: Database, userId: string): ClientContact | undefined {
  const user = queryOne<{ name: string; identifier: string; phone: string | null }>(
    db,
    "SELECT name, identifier, phone FROM users WHERE id = ? AND role = 'cliente'",
    [userId],
  );
  if (!user) return undefined;
  return { name: user.name, phone: user.phone ?? "", email: user.identifier.includes("@") ? user.identifier : "" };
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
    let next: DomainState;
    if (command.type === "demo.reset") {
      // Solo tiene sentido en la barbería de demostración: es la única con datos sembrados.
      if (shopId !== LEGACY_SHOP_ID) throw new DomainError("No disponible para esta barbería", 403);
      next = seedData();
      writeState(db, shopId, prev, next, stamp);
      seedUsers(db, stamp);
    } else {
      next = applyCommand(prev, command, actor);
      writeState(db, shopId, prev, next, stamp);
      // Borrar la ficha saca al cliente de esta barbería; su cuenta sigue sirviendo en las demás.
      if (command.type === "client.delete") {
        db.run("DELETE FROM memberships WHERE shop_id = ? AND client_id = ?", [shopId, command.id]);
      }
    }
    // El nombre del local vive en dos lados: en sus datos y en la tabla de barberías, que es la
    // que ven los clientes al elegir. El slug NO cambia: es el link que el local ya repartió.
    if (next.businessInfo.name !== prev.businessInfo.name) {
      db.run("UPDATE shops SET name = ? WHERE id = ?", [next.businessInfo.name, shopId]);
    }
    return bumpVersion(db, shopId);
  });

  cache.delete(shopId);
  await persist();
  const state = readState(db, shopId);
  mailAboutAppointment(db, shopId, command, prev, state);
  return { state, version };
}

/**
 * Avisos por mail de los turnos: reserva, cancelación y recordatorio.
 *
 * Va acá porque es el único lugar por donde pasan todos los comandos, y después de persistir:
 * el mail nunca puede voltear la operación. El mail sale a la casilla de la cuenta del cliente;
 * si el turno lo cargó el local a mano y esa persona no tiene cuenta, no hay a dónde mandarlo.
 */
function mailAboutAppointment(db: Database, shopId: string, command: Command, prev: DomainState, next: DomainState): void {
  const kind =
    command.type === "appointment.book"
      ? "reservado"
      : command.type === "appointment.cancel"
        ? "cancelado"
        : command.type === "appointment.reminderSent"
          ? "recordatorio"
          : undefined;
  if (!kind) return;

  const before = new Set(prev.appointments.map((a) => a.id));
  const appointment =
    command.type === "appointment.book"
      ? next.appointments.find((a) => !before.has(a.id))
      : next.appointments.find((a) => a.id === (command as { id: string }).id);
  if (!appointment?.clientId) return;

  const to = queryOne<{ identifier: string }>(
    db,
    `SELECT u.identifier FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.shop_id = ? AND m.client_id = ?`,
    [shopId, appointment.clientId],
  )?.identifier;
  notifyAppointment(kind, appointment, next.businessInfo, to?.includes("@") ? to : undefined);
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
