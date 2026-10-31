import "server-only";
import webpush, { type PushSubscription } from "web-push";
import type { Actor, Command, DomainState } from "@/lib/commands";
import { shortDate } from "@/lib/dates";
import { CONTACT_EMAIL } from "@/lib/plan";
import type { Appointment } from "@/lib/types";
import type { Database } from "sql.js";
import { getDb, persist, queryAll } from "./db";
import { reportError } from "./monitor";

/**
 * Notificaciones push al staff: un turno nuevo, cancelado o reprogramado por el cliente le llega
 * al celular del dueño y del barbero de ese turno, con la app cerrada.
 *
 * Usa Web Push con claves VAPID (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY). Sin ellas no se ofrece
 * activar avisos y nada falla. Como los mails, es "mejor esfuerzo": un aviso que no sale nunca
 * voltea la reserva que lo disparó.
 */

let configured: boolean | undefined;

function ensureConfigured(): boolean {
  if (configured !== undefined) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || `mailto:${CONTACT_EMAIL}`, publicKey, privateKey);
  return (configured = true);
}

/** Clave pública para que el navegador se suscriba. `null`: push no está configurado. */
export function pushPublicKey(): string | null {
  return ensureConfigured() ? process.env.VAPID_PUBLIC_KEY!.trim() : null;
}

export async function saveSubscription(userId: string, shopId: string, subscription: PushSubscription): Promise<void> {
  const db = await getDb();
  db.run(
    `INSERT INTO push_subscriptions (endpoint, user_id, shop_id, data, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, shop_id = excluded.shop_id, data = excluded.data`,
    [subscription.endpoint, userId, shopId, JSON.stringify(subscription), new Date().toISOString()],
  );
  await persist();
}

export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?", [endpoint, userId]);
  await persist();
}

interface PushMessage {
  title: string;
  body: string;
  url: string;
  /** Agrupa: un aviso nuevo del mismo turno reemplaza al anterior en vez de apilarse. */
  tag: string;
}

/** Dueño del local y barbero del turno: los que tienen que enterarse. */
function staffSubscriptions(db: Database, shopId: string, barberId: string) {
  return queryAll<{ endpoint: string; data: string }>(
    db,
    `SELECT p.endpoint, p.data FROM push_subscriptions p JOIN users u ON u.id = p.user_id
      WHERE p.shop_id = ? AND u.shop_id = ? AND (u.role = 'admin' OR u.barber_id = ?)`,
    [shopId, shopId, barberId],
  );
}

async function send(db: Database, shopId: string, barberId: string, message: PushMessage): Promise<void> {
  const targets = staffSubscriptions(db, shopId, barberId);
  if (!targets.length) return;
  let dropped = false;
  await Promise.all(
    targets.map(async ({ endpoint, data }) => {
      try {
        await webpush.sendNotification(JSON.parse(data) as PushSubscription, JSON.stringify(message), { TTL: 3600 });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410: el celular dio de baja la suscripción (desinstaló, borró datos). Se olvida.
        if (status === 404 || status === 410) {
          db.run("DELETE FROM push_subscriptions WHERE endpoint = ?", [endpoint]);
          dropped = true;
        } else {
          await reportError("push", error, { shopId });
        }
      }
    }),
  );
  if (dropped) await persist();
}

const when = (a: Appointment) => `${shortDate(a.date)} ${a.time}`;

/** Qué avisar de un comando, si corresponde. Solo lo que hizo el cliente: el staff ya lo sabe. */
export function pushMessageFor(command: Command, actor: Actor, prev: DomainState, next: DomainState): { barberId: string; message: PushMessage } | null {
  if (actor.role !== "cliente") return null;
  const before = new Map(prev.appointments.map((a) => [a.id, a]));

  if (command.type === "appointment.book") {
    const a = next.appointments.find((x) => !before.has(x.id));
    if (!a) return null;
    return {
      barberId: a.barberId,
      message: { title: "Nuevo turno", body: `${a.clientName} · ${a.serviceName} · ${when(a)}`, url: `/admin/turno/${a.id}`, tag: a.id },
    };
  }
  if (command.type === "appointment.cancel") {
    const a = next.appointments.find((x) => x.id === command.id);
    if (!a) return null;
    return {
      barberId: a.barberId,
      message: { title: "Turno cancelado", body: `${a.clientName} canceló ${when(a)}`, url: "/admin/agenda", tag: a.id },
    };
  }
  if (command.type === "appointment.update") {
    const a = next.appointments.find((x) => x.id === command.id);
    const old = before.get(command.id);
    if (!a || !old || (old.date === a.date && old.time === a.time)) return null;
    return {
      barberId: a.barberId,
      message: { title: "Turno reprogramado", body: `${a.clientName}: ${when(old)} → ${when(a)}`, url: `/admin/turno/${a.id}`, tag: a.id },
    };
  }
  return null;
}

/** Avisa al staff, sin hacer esperar a quien disparó el comando. */
export function pushAboutCommand(shopId: string, command: Command, actor: Actor, prev: DomainState, next: DomainState): void {
  if (!ensureConfigured()) return;
  const notice = pushMessageFor(command, actor, prev, next);
  if (!notice) return;
  void getDb()
    .then((db) => send(db, shopId, notice.barberId, notice.message))
    .catch((error) => reportError("push", error, { shopId }));
}
