import { z } from "zod";
import { onlyDigits } from "./format";

/**
 * Celulares argentinos. En la app todos los números son de Argentina, así que el usuario
 * escribe solo el código de área y el número (10 dígitos) y acá se les pone el `+54 9`.
 */
export const AR_PREFIX = "+54 9";

/** Cuántos dígitos tiene el número local, sin `+54`, sin el `9` y sin el `0` ni el `15`. */
export const AR_LOCAL_DIGITS = 10;

/** Códigos de área de tres dígitos; el AMBA usa dos (11) y el resto del país, cuatro. */
const AREA_3 =
  /^(220|221|223|230|236|237|249|260|261|263|264|266|280|291|297|299|341|342|343|345|348|351|353|358|362|364|370|376|379|380|381|383|385|387|388)/;

/**
 * Deja los 10 dígitos locales de lo que haya escrito el usuario: tolera `+54`, el `9` de
 * celular, el `0` del código de área y el `15`, con o sin espacios, guiones o paréntesis.
 */
export function arLocalDigits(value: string): string {
  let d = onlyDigits(value);
  if (d.startsWith("54")) d = d.slice(2);
  if (d.length > AR_LOCAL_DIGITS && d.startsWith("9")) d = d.slice(1);
  if (d.length > AR_LOCAL_DIGITS && d.startsWith("0")) d = d.slice(1);
  if (d.length > AR_LOCAL_DIGITS) d = d.replace(/^(\d{2,4})15/, "$1");
  return d;
}

export function isArPhone(value: string): boolean {
  return arLocalDigits(value).length === AR_LOCAL_DIGITS;
}

/** Guarda siempre igual: `+54 9 11 3096-9716`. Así `whatsappLink` arma bien el wa.me. */
export function toArPhone(value: string): string {
  const d = arLocalDigits(value);
  if (d.length !== AR_LOCAL_DIGITS) return value.trim();
  const area = d.startsWith("11") ? 2 : AREA_3.test(d) ? 3 : 4;
  const rest = d.slice(area);
  return `${AR_PREFIX} ${d.slice(0, area)} ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
}

export const AR_PHONE_ERROR = "Ingresá los 10 dígitos con código de área, sin 0 ni 15";

/** Valida un celular argentino y lo normaliza a `+54 9 …`. */
export const arPhoneSchema = z
  .string()
  .trim()
  .refine(isArPhone, AR_PHONE_ERROR)
  .transform(toArPhone);
