import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { phoneKey } from "@/lib/format";

/** scrypt con sal. Sirve igual para las contraseñas y para los PIN de cuentas anteriores. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Email en minúsculas o `tel:` + últimos 10 dígitos del celular. */
export function normalizeIdentifier(value: string): string {
  const v = value.trim().toLowerCase();
  return v.includes("@") ? v : `tel:${phoneKey(v)}`;
}
