import "server-only";
import type { Appointment, BusinessInfo } from "@/lib/types";
import { newToken, sha256 } from "./crypto";
import { getDb, persist, queryOne } from "./db";
import {
  appointmentBookedEmail,
  appointmentCancelledEmail,
  appointmentReminderEmail,
  passwordResetEmail,
  verifyEmailEmail,
  welcomeClientEmail,
  welcomeShopEmail,
  type Email,
} from "./emails";
import { appUrl, mailReady, sendMail } from "./mail";

/**
 * Avisos por mail. Todo acá adentro es "mejor esfuerzo": si el SMTP no está configurado o
 * falla, la operación que lo disparó (registrarse, reservar) ya terminó bien igual.
 *
 * Los mails de cuenta salen a nombre de la app; los de turnos, a nombre del local, con su
 * casilla como "responder a", así el cliente le contesta a la barbería.
 */
const VERIFY_PURPOSE = "verificar-email";
const VERIFY_HOURS = 48;

/** Solo las cuentas que entran con email reciben mails; el staff puede entrar con celular. */
export function emailOf(identifier: string): string | undefined {
  return identifier.includes("@") ? identifier : undefined;
}

/** Manda el mail sin hacer esperar a quien disparó la acción. */
function fireAndForget(to: string, email: Email, options: { fromName?: string; replyTo?: string } = {}): void {
  void sendMail({ to, subject: email.subject, html: email.html, ...options });
}

/** Link de un solo uso para confirmar el email. Se guarda hasheado y vence a las 48 h. */
export async function issueEmailVerification(userId: string): Promise<string> {
  const token = newToken();
  const now = Date.now();
  const db = await getDb();
  db.run("DELETE FROM email_tokens WHERE user_id = ? AND purpose = ?", [userId, VERIFY_PURPOSE]);
  db.run("INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at, created_at) VALUES (?, ?, ?, ?, ?)", [
    sha256(token),
    userId,
    VERIFY_PURPOSE,
    new Date(now + VERIFY_HOURS * 3_600_000).toISOString(),
    new Date(now).toISOString(),
  ]);
  await persist();
  return `${appUrl()}/api/auth/verificar?token=${token}`;
}

/** Consume el link: marca el email como confirmado. Devuelve si el token servía. */
export async function consumeEmailVerification(token: string): Promise<boolean> {
  const db = await getDb();
  const row = queryOne<{ user_id: string; expires_at: string }>(
    db,
    "SELECT user_id, expires_at FROM email_tokens WHERE token_hash = ? AND purpose = ?",
    [sha256(token), VERIFY_PURPOSE],
  );
  if (!row) return false;
  const expired = new Date(row.expires_at).getTime() < Date.now();
  db.run("DELETE FROM email_tokens WHERE token_hash = ?", [sha256(token)]);
  if (!expired) db.run("UPDATE users SET email_verified_at = ? WHERE id = ?", [new Date().toISOString(), row.user_id]);
  await persist();
  return !expired;
}

/** Alta de un cliente: bienvenida y, en el mismo envío, el link para confirmar su email. */
export async function notifyClientRegistered(user: { id: string; name: string; email: string }, shopName?: string): Promise<void> {
  if (!mailReady()) return;
  fireAndForget(user.email, welcomeClientEmail(user.name, shopName));
  fireAndForget(user.email, verifyEmailEmail(user.name, await issueEmailVerification(user.id)));
}

/** Alta de una barbería: al dueño, si entró con un email. */
export function notifyShopCreated(owner: { name: string; identifier: string }, shopName: string, shopSlug: string): void {
  const to = emailOf(owner.identifier);
  if (!to || !mailReady()) return;
  fireAndForget(to, welcomeShopEmail(owner.name, shopName, shopSlug));
}

/** Código para recuperar la contraseña. Devuelve si pudo salir por mail. */
export function notifyPasswordCode(to: string, name: string, code: string): boolean {
  if (!mailReady()) return false;
  fireAndForget(to, passwordResetEmail(name, code));
  return true;
}

type ShopInfo = Pick<BusinessInfo, "name" | "address" | "email">;

/** Turno reservado, cancelado o recordado. Sale a nombre del local. */
export function notifyAppointment(
  kind: "reservado" | "cancelado" | "recordatorio",
  appointment: Appointment,
  info: ShopInfo,
  to: string | undefined,
): void {
  if (!to || !mailReady()) return;
  const email =
    kind === "reservado"
      ? appointmentBookedEmail(appointment, info)
      : kind === "cancelado"
        ? appointmentCancelledEmail(appointment, info)
        : appointmentReminderEmail(appointment, info);
  fireAndForget(to, email, { fromName: info.name, replyTo: info.email || undefined });
}
