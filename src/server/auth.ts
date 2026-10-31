import "server-only";
import { cookies, headers } from "next/headers";
import type { Database } from "sql.js";
import type { Actor } from "@/lib/commands";
import type { Role, Session, Shop } from "@/lib/types";
import { newToken, sha256 } from "./crypto";
import { queryAll, queryOne } from "./db";
import { ensureSeeded, listShops, mutate, shopRow } from "./repository";

export const SESSION_COOKIE = "ds_session";
/** Barbería elegida por un visitante sin sesión (la fija /b/<slug>). */
export const SHOP_COOKIE = "ds_shop";
const SESSION_DAYS = 30;
const SHOP_DAYS = 180;

export interface UserRow {
  id: string;
  /** Solo staff: la barbería donde trabaja. `null` en los clientes. */
  shop_id: string | null;
  role: Role;
  identifier: string;
  name: string;
  barber_id: string | null;
  /** Solo clientes: celular de contacto. */
  phone: string | null;
  password_hash: string;
  /** Cuándo confirmó su email. `null`: todavía no lo hizo. */
  email_verified_at: string | null;
}

/** Sesión válida, con o sin barbería activa (un cliente recién registrado todavía no tiene). */
export interface Account {
  user: UserRow;
  session: Session;
  /** `null` mientras un cliente no tenga barbería activa: no puede operar sobre ninguna. */
  actor: Actor | null;
}

/** Sesión que opera sobre una barbería: la que necesitan los comandos, pagos y ajustes. */
export interface CurrentUser extends Account {
  actor: Actor;
  session: Session & { shop: Shop };
}

/** Barberías en las que se atiende un cliente, en el orden en que se sumó. */
export function clientShops(db: Database, userId: string): (Shop & { clientId: string })[] {
  return queryAll<Shop & { clientId: string }>(
    db,
    `SELECT s.id, s.slug, s.name, m.client_id AS clientId
       FROM memberships m JOIN shops s ON s.id = m.shop_id
      WHERE m.user_id = ? ORDER BY m.created_at, s.name`,
    [userId],
  );
}

async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function getAccount(): Promise<Account | null> {
  const token = await sessionToken();
  if (!token) return null;
  const db = await ensureSeeded();
  const row = queryOne<UserRow & { expires_at: string; session_shop: string | null }>(
    db,
    `SELECT u.*, s.expires_at, s.shop_id AS session_shop
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    [sha256(token)],
  );
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return null;
  const { expires_at: _expires, session_shop: sessionShop, ...user } = row;

  if (user.role === "cliente") {
    const shops = clientShops(db, user.id);
    // La barbería activa sale de la sesión y tiene que ser una de las suyas. Si dejó de serlo,
    // o todavía no eligió, se usa la primera.
    const active = shops.find((s) => s.id === sessionShop) ?? shops[0];
    return {
      user,
      actor: active ? { role: "cliente", shopId: active.id, clientId: active.clientId } : null,
      session: {
        role: "cliente",
        name: user.name,
        identifier: user.identifier,
        clientId: active?.clientId,
        emailVerified: !!user.email_verified_at,
        shop: active ? { id: active.id, slug: active.slug, name: active.name } : null,
        shops: shops.map(({ id, slug, name }) => ({ id, slug, name })),
      },
    };
  }

  // Staff: la barbería sale del usuario, nunca del pedido. Es lo que acota todo lo que ve y hace.
  const shop = user.shop_id ? shopRow(db, user.shop_id) : undefined;
  if (!shop) return null;
  // El barbero sin sillón asignado no puede operar: se lo trata como sesión inválida.
  if (user.role === "barbero" && !user.barber_id) return null;
  const actor: Actor =
    user.role === "admin"
      ? { role: "admin", shopId: shop.id }
      : { role: "barbero", shopId: shop.id, barberId: user.barber_id! };
  return {
    user,
    actor,
    session: {
      role: user.role,
      name: user.name,
      identifier: user.identifier,
      barberId: user.barber_id ?? undefined,
      shop,
    },
  };
}

/** Sesión con barbería activa. `null` sin sesión o para un cliente que todavía no eligió ninguna. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const account = await getAccount();
  return account?.actor && account.session.shop ? (account as CurrentUser) : null;
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

export async function rememberShop(slug: string): Promise<void> {
  (await cookies()).set(SHOP_COOKIE, slug, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + SHOP_DAYS * 86_400_000),
  });
}

/** Abre una sesión. `shopId` es la barbería activa de un cliente (el staff siempre usa la suya). */
export async function startSession(userId: string, shopId: string | null = null): Promise<void> {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await mutate((db) => {
    db.run("DELETE FROM sessions WHERE expires_at < ?", [new Date().toISOString()]);
    db.run("INSERT INTO sessions (token_hash, user_id, expires_at, shop_id) VALUES (?, ?, ?, ?)", [
      sha256(token),
      userId,
      expires.toISOString(),
      shopId,
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

/** Cambia la barbería activa de la sesión actual (el cliente ya validó que es una de las suyas). */
export async function setSessionShop(shop: Shop): Promise<void> {
  const token = await sessionToken();
  if (!token) return;
  await mutate((db) => db.run("UPDATE sessions SET shop_id = ? WHERE token_hash = ?", [shop.id, sha256(token)]));
  // La próxima vez que entre, arranca en la misma barbería.
  await rememberShop(shop.slug);
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await mutate((db) => db.run("DELETE FROM sessions WHERE token_hash = ?", [sha256(token)]));
  store.delete(SESSION_COOKIE);
}

