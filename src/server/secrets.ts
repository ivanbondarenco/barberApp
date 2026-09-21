import "server-only";
import { getDb, persist, queryOne } from "./db";
import { mutate } from "./repository";

/**
 * Credenciales de la pasarela, guardadas por barbería y nunca expuestas al navegador.
 * El `scope` es el id de la barbería: cada local cobra con su propia cuenta de Mercado Pago.
 */
export type SecretKey =
  | "mp_access_token"
  | "mp_public_key"
  | "mp_webhook_secret"
  | "wa_access_token"
  | "wa_phone_number_id"
  | "wa_template"
  | "wa_language";

/**
 * Variable de entorno equivalente, como atajo para un deploy de un solo local.
 * Si la barbería tiene su credencial cargada, gana la suya.
 */
const ENV_FALLBACK: Record<SecretKey, string> = {
  mp_access_token: "MP_ACCESS_TOKEN",
  mp_public_key: "MP_PUBLIC_KEY",
  mp_webhook_secret: "MP_WEBHOOK_SECRET",
  wa_access_token: "WA_ACCESS_TOKEN",
  wa_phone_number_id: "WA_PHONE_NUMBER_ID",
  wa_template: "WA_TEMPLATE",
  wa_language: "WA_LANGUAGE",
};

export async function getSecret(key: SecretKey, shopId: string): Promise<string | undefined> {
  const db = await getDb();
  const row = queryOne<{ value: string }>(db, "SELECT value FROM secrets WHERE scope = ? AND key = ?", [shopId, key]);
  const stored = row?.value.trim();
  if (stored) return stored;
  return process.env[ENV_FALLBACK[key]]?.trim() || undefined;
}

/** Guarda (o borra, con cadena vacía) una credencial de la barbería. */
export async function setSecret(key: SecretKey, value: string, shopId: string): Promise<void> {
  const clean = value.trim();
  await mutate(
    (db) => {
      if (!clean) {
        db.run("DELETE FROM secrets WHERE scope = ? AND key = ?", [shopId, key]);
        return;
      }
      db.run(
        `INSERT INTO secrets (scope, key, value, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [shopId, key, clean, new Date().toISOString()],
      );
    },
    // Sube la versión de la barbería: `paymentSettings.mercadopagoReady` viaja en su estado.
    { touchesState: shopId },
  );
}

/** Marca un pago como procesado. Devuelve false si ya se había aplicado (webhook repetido). */
export async function claimPaymentEvent(
  paymentId: string,
  shopId: string,
  appointmentId: string,
  status: string,
): Promise<boolean> {
  const db = await getDb();
  const seen = queryOne<{ id: string }>(db, "SELECT id FROM payment_events WHERE id = ?", [paymentId]);
  if (seen) return false;
  db.run("INSERT INTO payment_events (id, shop_id, appointment_id, status, received_at) VALUES (?, ?, ?, ?, ?)", [
    paymentId,
    shopId,
    appointmentId,
    status,
    new Date().toISOString(),
  ]);
  await persist();
  return true;
}
