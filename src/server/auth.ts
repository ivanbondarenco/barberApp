import "server-only";
import { cookies, headers } from "next/headers";
import type { Actor } from "@/lib/commands";
import type { Session } from "@/lib/types";
import { newToken, sha256 } from "./crypto";
import { queryOne } from "./db";
import { ensureSeeded, mutate } from "./repository";

export const SESSION_COOKIE = "ds_session";
const SESSION_DAYS = 30;

export interface UserRow {
  id: string;
  role: "cliente" | "admin";
  identifier: string;
  name: string;
  client_id: string | null;
  pin_hash: string;
}

export interface CurrentUser {
  user: UserRow;
  actor: Actor;
  session: Session;
}

export function toSession(user: UserRow, client?: { name: string; phone: string }): Session {
  return {
    role: user.role,
    name: client?.name ?? user.name,
    identifier: client?.phone ?? user.identifier,
    clientId: user.client_id ?? undefined,
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

  const client = row.client_id
    ? queryOne<{ data: string }>(db, "SELECT data FROM clients WHERE id = ?", [row.client_id])
    : undefined;
  if (row.role === "cliente" && !client) return null;
  const profile = client ? (JSON.parse(client.data) as { name: string; phone: string }) : undefined;

  const actor: Actor = row.role === "admin" ? { role: "admin" } : { role: "cliente", clientId: row.client_id! };
  return { user: row, actor, session: toSession(row, profile) };
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

/** Límite simple de intentos fallidos por identificador (en memoria). */
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
