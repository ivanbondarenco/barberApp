/**
 * Plan comercial de BarberApp: lo que dicen la landing y los términos.
 *
 * El sistema lo aplica: cada barbería nueva arranca con la prueba, después paga "el valor de 2
 * cortes" por mes y, si no paga, se suspende (sin borrar nada). Las reglas y el precio viven en
 * `src/lib/billing.ts` (TRIAL_DAYS tiene que coincidir con este texto); el cobro, en
 * `src/server/billing.ts`.
 */
export const TRIAL_LABEL = "1 mes";

/**
 * WhatsApp de soporte de BarberApp. Lo ven solo las barberías registradas (dueño y barberos),
 * desde el menú del panel: la landing lo ofrece pero no publica el número.
 */
export const SUPPORT_WHATSAPP = "+54 9 11 3096-9716";

/** Email de contacto de BarberApp: términos, privacidad y remitente de los avisos push. */
export const CONTACT_EMAIL = "argentinabarberapp@gmail.com";
