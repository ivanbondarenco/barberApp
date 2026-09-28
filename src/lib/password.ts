import { z } from "zod";

/** Largo mínimo de una contraseña. Sin reglas de mayúsculas ni símbolos: solo el largo. */
export const PASSWORD_MIN = 8;

/** Contraseña nueva (alta, cambio, recuperación). La usan el servidor y los formularios. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Usá al menos ${PASSWORD_MIN} caracteres`)
  .max(100, "La contraseña es demasiado larga");

/**
 * Contraseña para ingresar: solo que no esté vacía. Las cuentas anteriores entraban con un
 * PIN de 4 dígitos y lo siguen usando hasta que lo cambien.
 */
export const loginPasswordSchema = z.string().min(1, "Ingresá tu contraseña").max(100);
