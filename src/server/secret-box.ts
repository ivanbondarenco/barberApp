import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cifrado de las credenciales que cada barbería guarda en la base (Mercado Pago, WhatsApp).
 *
 * Un access token de Mercado Pago de producción mueve plata. Guardado en claro, cualquier copia
 * del archivo de la base (un backup, una descarga del servidor) daba acceso a la cuenta de todos
 * los locales. Cifradas, la copia sola no alcanza: hace falta además SECRETS_KEY, que vive en el
 * entorno del servidor y nunca en la base.
 *
 * AES-256-GCM, con la barbería y el nombre de la credencial como dato asociado: un valor cifrado
 * no se puede copiar a otra barbería ni a otra credencial, porque no descifra fuera de su lugar.
 */

const PREFIX = "enc:v1:";

/** Largo mínimo de SECRETS_KEY. Se genera con `openssl rand -base64 32`. */
export const MIN_KEY_LENGTH = 32;

/**
 * Solo para desarrollo y tests, cuando no hay SECRETS_KEY. Está en el código, así que no protege
 * nada: sirve para que la app funcione igual en la máquina de un desarrollador. En producción la
 * app no arranca sin la clave de verdad (ver `productionConfig`).
 */
const DEV_ONLY_KEY = "barberapp-dev-only-key-nunca-en-produccion";

let warned = false;

function keyMaterial(): Buffer {
  const configured = process.env.SECRETS_KEY?.trim();
  if (configured) {
    if (configured.length < MIN_KEY_LENGTH) {
      throw new Error(`SECRETS_KEY es demasiado corta: mínimo ${MIN_KEY_LENGTH} caracteres.`);
    }
    return createHash("sha256").update(configured).digest();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Falta SECRETS_KEY: sin ella no se pueden guardar ni leer las credenciales de las barberías.");
  }
  if (!warned) {
    warned = true;
    console.warn("[secrets] Sin SECRETS_KEY: se usa una clave de desarrollo. No sirve para producción.");
  }
  return createHash("sha256").update(DEV_ONLY_KEY).digest();
}

/** Lugar de la credencial: barbería + nombre. Liga el valor cifrado a ese lugar y a ningún otro. */
const place = (scope: string, key: string) => Buffer.from(`${scope}:${key}`, "utf8");

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptSecret(value: string, scope: string, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(), iv);
  cipher.setAAD(place(scope, key));
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

/**
 * Devuelve la credencial en claro. Un valor guardado antes del cifrado se devuelve tal cual (la
 * migración lo cifra la próxima vez que se abre la base).
 *
 * Lanza si el valor no descifra: la clave cambió, o el valor se copió desde otra barbería.
 */
export function decryptSecret(stored: string, scope: string, key: string): string {
  if (!isEncrypted(stored)) return stored;
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || dataB64 === undefined) throw new Error("Credencial cifrada con formato inválido");
  const decipher = createDecipheriv("aes-256-gcm", keyMaterial(), Buffer.from(ivB64, "base64"));
  decipher.setAAD(place(scope, key));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
