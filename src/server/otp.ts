import "server-only";
import { randomInt, timingSafeEqual } from "node:crypto";
import { DomainError } from "@/lib/commands";
import { sha256 } from "./crypto";
import { getDb, persist, queryOne } from "./db";
import { sendOtp, whatsappReady } from "./whatsapp";

/** Para qué se pidió el código. Cada trámite lleva el suyo por separado. */
export type OtpPurpose = "registro" | "acceso" | "recuperacion";

const CODE_LENGTH = 6;
const TTL_MINUTES = 10;
/** Intentos fallidos antes de invalidar el código y obligar a pedir otro. */
const MAX_ATTEMPTS = 5;
/** Espera mínima entre dos envíos al mismo número, para no permitir usarlo como spam. */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * En desarrollo y en los tests no hay cuenta de WhatsApp, así que el código viaja en la
 * respuesta en vez de enviarse. Se activa SOLO con esta variable, que jamás va a producción:
 * sin ella, una barbería sin WhatsApp configurado no puede emitir códigos.
 */
const debugMode = () => process.env.OTP_DEBUG === "1";

const hash = (shopId: string, identifier: string, purpose: OtpPurpose, code: string) =>
  sha256(`${shopId}:${identifier}:${purpose}:${code}`);

export interface IssuedOtp {
  /** Solo en modo debug: el código, para que lo use el entorno de desarrollo. */
  code?: string;
}

/**
 * Genera un código, lo guarda hasheado y lo manda por WhatsApp.
 * Pedir otro código reemplaza al anterior y reinicia los intentos.
 */
export async function issueOtp(shopId: string, identifier: string, purpose: OtpPurpose, phone: string): Promise<IssuedOtp> {
  const ready = await whatsappReady(shopId);
  if (!ready && !debugMode()) {
    throw new DomainError("Esta barbería todavía no configuró WhatsApp. Escribile al local para que te dé acceso.", 503);
  }
  return issueCode(shopId, identifier, purpose, ready ? (code) => sendOtp(shopId, phone, code) : undefined);
}

/**
 * Igual que `issueOtp`, pero el código lo entrega quien llama (hoy, por mail).
 * `send` devuelve `false` si no pudo mandarlo: sin otra vía, el trámite no puede seguir.
 */
export async function issueOtpWith(
  shopId: string,
  identifier: string,
  purpose: OtpPurpose,
  send: (code: string) => boolean,
): Promise<IssuedOtp> {
  return issueCode(shopId, identifier, purpose, (code) => {
    if (!send(code)) throw new DomainError("No pudimos enviarte el código. Probá de nuevo en un momento.", 502);
  });
}

/** El código en sí: cooldown, generación, guardado hasheado y entrega. */
async function issueCode(
  shopId: string,
  identifier: string,
  purpose: OtpPurpose,
  deliver: ((code: string) => void | Promise<void>) | undefined,
): Promise<IssuedOtp> {
  const db = await getDb();
  const now = Date.now();

  const previous = queryOne<{ sent_at: string }>(
    db,
    "SELECT sent_at FROM otp_codes WHERE shop_id = ? AND identifier = ? AND purpose = ?",
    [shopId, identifier, purpose],
  );
  if (previous) {
    const waited = (now - new Date(previous.sent_at).getTime()) / 1000;
    if (waited < RESEND_COOLDOWN_SECONDS) {
      throw new DomainError(`Esperá ${Math.ceil(RESEND_COOLDOWN_SECONDS - waited)} segundos para pedir otro código`, 429);
    }
  }

  if (!deliver && !debugMode()) {
    throw new DomainError("No hay por dónde enviarte el código. Escribile al local para que te dé acceso.", 503);
  }

  // randomInt del módulo crypto: no alcanza con Math.random para algo que da acceso a una cuenta.
  const code = String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");

  db.run(
    `INSERT INTO otp_codes (shop_id, identifier, purpose, code_hash, expires_at, attempts, sent_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(shop_id, identifier, purpose) DO UPDATE SET code_hash = excluded.code_hash,
       expires_at = excluded.expires_at, attempts = 0, sent_at = excluded.sent_at`,
    [
      shopId,
      identifier,
      purpose,
      hash(shopId, identifier, purpose, code),
      new Date(now + TTL_MINUTES * 60_000).toISOString(),
      new Date(now).toISOString(),
    ],
  );
  await persist();

  if (deliver) {
    await deliver(code);
    return {};
  }
  // Sin forma de entregarlo solo se llega acá en modo debug.
  console.warn(`[OTP_DEBUG] ${purpose} ${identifier} → ${code}`);
  return { code };
}

/**
 * Valida el código. Con `consume` (por defecto) lo invalida: sirve una sola vez.
 *
 * La recuperación de contraseña lo verifica primero sin consumirlo —para habilitar el paso siguiente—
 * y recién lo consume al guardar la contraseña nueva.
 */
export async function consumeOtp(
  shopId: string,
  identifier: string,
  purpose: OtpPurpose,
  code: string,
  { consume = true } = {},
): Promise<void> {
  const db = await getDb();
  const row = queryOne<{ code_hash: string; expires_at: string; attempts: number }>(
    db,
    "SELECT code_hash, expires_at, attempts FROM otp_codes WHERE shop_id = ? AND identifier = ? AND purpose = ?",
    [shopId, identifier, purpose],
  );

  const discard = async () => {
    db.run("DELETE FROM otp_codes WHERE shop_id = ? AND identifier = ? AND purpose = ?", [shopId, identifier, purpose]);
    await persist();
  };

  if (!row) throw new DomainError("Pedí un código nuevo", 401);
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await discard();
    throw new DomainError("El código venció. Pedí uno nuevo.", 401);
  }
  // Agotados los intentos la fila NO se borra: si se borrara, `issueOtp` no vería el envío
  // anterior, no aplicaría el cooldown y se podría pedir código tras código para seguir
  // adivinando. Queda inutilizable hasta que venza o hasta que el cooldown permita otro.
  if (row.attempts >= MAX_ATTEMPTS) {
    throw new DomainError("Demasiados intentos. Pedí un código nuevo en un minuto.", 429);
  }

  const expected = Buffer.from(row.code_hash, "utf8");
  const actual = Buffer.from(hash(shopId, identifier, purpose, code.trim()), "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    db.run(
      "UPDATE otp_codes SET attempts = attempts + 1 WHERE shop_id = ? AND identifier = ? AND purpose = ?",
      [shopId, identifier, purpose],
    );
    await persist();
    throw new DomainError("Código incorrecto", 401);
  }

  // Correcto: se consume para que no se pueda reusar.
  if (consume) await discard();
}

/** Limpia los códigos vencidos. Se llama de paso, sin necesidad de un cron. */
export async function purgeExpiredOtps(): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM otp_codes WHERE expires_at < ?", [new Date().toISOString()]);
}
