import { z } from "zod";

/**
 * Reglas de los datos que la gente escribe en los formularios. Las usan el navegador (para
 * avisar y para no dejar escribir lo que no va) y el servidor (que es el que decide).
 */

/** Celular: solo dígitos y lo que se usa para separarlos. Hasta 13 dígitos (con +54 9). */
export function sanitizePhone(value: string): string {
  let digits = 0;
  let out = "";
  for (const ch of value) {
    if (/\d/.test(ch)) {
      if (digits >= 13) continue;
      digits += 1;
      out += ch;
    } else if (/[\s()+-]/.test(ch)) {
      out += ch;
    }
  }
  return out;
}

/** Nombre de una persona: letras (con tildes y ñ), espacios, apóstrofo, punto y guion. */
export function sanitizePersonName(value: string): string {
  return value.replace(/[^\p{L}\s'.-]/gu, "");
}

const hasLetter = (v: string) => /\p{L}/u.test(v);

export const personNameSchema = z
  .string()
  .trim()
  .min(3, "Ingresá tu nombre")
  .max(60, "El nombre es demasiado largo")
  .regex(/^[\p{L}\s'.-]+$/u, "El nombre solo puede tener letras");

export const shopNameSchema = z
  .string()
  .trim()
  .min(3, "Ingresá el nombre de la barbería")
  .max(60, "El nombre es demasiado largo")
  .refine(hasLetter, "El nombre tiene que tener letras");

export const addressSchema = z
  .string()
  .trim()
  .min(5, "Ingresá la dirección del local")
  .max(120, "La dirección es demasiado larga")
  .refine(hasLetter, "Ingresá la calle")
  .refine((v) => /\d/.test(v), "Incluí la altura (el número de la calle)");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(120, "El email es demasiado largo")
  .pipe(z.email("Ingresá un email válido"));
