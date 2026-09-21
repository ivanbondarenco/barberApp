import "server-only";
import { cookies, headers } from "next/headers";
import type { Actor } from "@/lib/commands";
import type { Role, Session, Shop } from "@/lib/types";
import { newToken, sha256 } from "./crypto";
import { queryOne } from "./db";
import { ensureSeeded, listShops, mutate, shopRow } from "./repository";

export const SESSION_COOKIE = "ds_session";
/** Barbería elegida por un visitante sin sesión (la fija /b/<slug>). */
export const SHOP_COOKIE = "ds_shop";
const SESSION_DAYS = 30;
const SHOP_DAYS = 180;

export interface UserRow {
  id: string;
  shop_id: string;
  role: Role;
  identifier: string;
  name: string;
  client_id: string | null;
  barber_id: string | null;
  pin_hash: string;
}

export interface CurrentUser {
  user: UserRow;
  actor: Actor;
  session: Session;
}

export function toSession(user: UserRow, shop: Shop, client?: { name: string; phone: string }): Session {
  return {
    role: user.role,
    name: client?.name ?? user.name,
    identifier: client?.phone ?? user.identifier,
    clientId: user.client_id ?? undefined,
    barberId: user.barber_id ?? undefined,
    shop,
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await ensureSeeded();
  const row = queryOne<UserRow & { expires_at: string }>(
    db,
    `SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    [sha256(token)],
  );
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return null;

  // La barbería sale del usuario, nunca del pedido: es lo que acota todo lo que ve y hace.
  const shop = shopRow(db, row.shop_id);
  if (!shop) return null;

  const client = row.client_id
    ? queryOne<{ data: string }>(db, "SELECT data FROM clients WHERE shop_id = ? AND id = ?", [row.shop_id, row.client_id])
    : undefined;
  if (row.role === "cliente" && !client) return null;
  const profile = client ? (JSON.parse(client.data) as { name: string; phone: string }) : undefined;

  // El barbero sin sillón asignado no puede operar: se lo trata como sesión inválida.
  if (row.role === "barbero" && !row.barber_id) return null;
  const actor: Actor =
    row.role === "admin"
      ? { role: "admin", shopId: shop.id }
      : row.role === "barbero"
        ? { role: "barbero", shopId: shop.id, barberId: row.barber_id! }
        : { role: "cliente", shopId: shop.id, clientId: row.client_id! };
  return { user: row, actor, session: toSession(row, shop, profile) };
}

/**
 * Barbería de un visitante sin sesión: la que eligió en /b/<slug>.
 * Si la instalación tiene una sola barbería, se usa esa — así un local único no necesita link.
 */
export async function visitorShop(): Promise<Shop | null> {
  const slug = (await cookies()).get(SHOP_COOKIE)?.value;
  const shops = await listShops();
  if (slug) {
    const chosen = shops.find((s) => s.slug === slug);
    if (chosen) return chosen;
  }
  return shops.length === 1 ? shops[0] : null;
}

/** Barbería sobre la que opera este pedido: la de la sesión, o la que eligió el visitante. */
export async function currentShop(): Promise<Shop | null> {
  const current = await getCurrentUser();
  return current?.session.shop ?? (await visitorShop());
}

export async function rememberShop(slug: string): Promise<void> {
  (await cookies()).set(SHOP_COOKIE, slug, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + SHOP_DAYS * 86_400_000),
  });
}

export async function startSession(userId: string): Promise<void> {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await mutate((db) => {
    db.run("DELETE FROM sessions WHERE expires_at < ?", [new Date().toISOString()]);
    db.run("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [
      sha256(token),
      userId,
      expires.toISOString(),
    ]);
  });
  // Secure solo detrás de HTTPS (proxy/hosting); en la red local por http la cookie igual funciona.
  const forwardedProto = (await headers()).get("x-forwarded-proto");
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: forwardedProto === "https",
    path: "/",
    expires,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await mutate((db) => db.run("DELETE FROM sessions WHERE token_hash = ?", [sha256(token)]));
  store.delete(SESSION_COOKIE);
}

/**
 * Límite simple de intentos fallidos por identificador (en memoria).
 * La clave incluye la barbería: un ataque a un local no bloquea al mismo celular en otro.
 */
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60_000;

export function isLocked(key: string): boolean {
  const entry = attempts.get(key);
  return !!entry && entry.count >= MAX_ATTEMPTS && entry.until > Date.now();
}

export function registerFailure(key: string): void {
  const entry = attempts.get(key);
  if (!entry || entry.until < Date.now()) attempts.set(key, { count: 1, until: Date.now() + WINDOW_MS });
  else entry.count += 1;
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}
