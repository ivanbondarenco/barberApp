import { MIN_KEY_LENGTH } from "./secret-box";

/**
 * Qué tiene que estar bien configurado para correr en producción.
 *
 * Los `errors` frenan el arranque: con ellos la app sería insegura (códigos de verificación a la
 * vista, credenciales sin cifrar, una barbería inventada publicada). Los `warnings` se loguean:
 * la app funciona, pero le falta algo que en producción conviene tener.
 *
 * Función pura sobre las variables de entorno, para poder probarla sin levantar el servidor.
 */
export interface ConfigReport {
  errors: string[];
  warnings: string[];
}

type Env = Record<string, string | undefined>;

const isLocalUrl = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url);

/**
 * Los tests E2E corren la app compilada (NODE_ENV=production) con códigos a la vista y datos de
 * demostración: es la única forma de probar el registro sin una cuenta de WhatsApp. E2E_TEST_MODE
 * los habilita, y solo contra una dirección local para que nadie lo prenda en un servidor público.
 */
export function testModeAllowed(env: Env = process.env): boolean {
  if (env.NODE_ENV !== "production") return true;
  if (env.E2E_TEST_MODE !== "1") return false;
  const appUrl = env.APP_URL?.trim();
  return !appUrl || isLocalUrl(appUrl);
}

export function productionConfig(env: Env = process.env): ConfigReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (env.NODE_ENV !== "production") return { errors, warnings };

  const key = env.SECRETS_KEY?.trim() ?? "";
  if (!key) {
    errors.push("Falta SECRETS_KEY: es la clave que cifra las credenciales de Mercado Pago y WhatsApp. Generala con `openssl rand -base64 32`.");
  } else if (key.length < MIN_KEY_LENGTH) {
    errors.push(`SECRETS_KEY es demasiado corta (mínimo ${MIN_KEY_LENGTH} caracteres).`);
  }

  const appUrl = env.APP_URL?.trim() ?? "";
  if (env.E2E_TEST_MODE === "1" && appUrl && !isLocalUrl(appUrl)) {
    errors.push("E2E_TEST_MODE=1 solo se permite contra una dirección local: sacala del servidor público.");
  }
  if (!testModeAllowed(env)) {
    if (env.OTP_DEBUG === "1") {
      errors.push("OTP_DEBUG=1 devuelve los códigos de verificación en la respuesta: cualquiera podría leer el de otro. Sacala.");
    }
    if (env.SEED_DEMO === "1") {
      errors.push("SEED_DEMO=1 publicaría una barbería de demostración con datos inventados. Sacala.");
    }
  }

  if (!appUrl) {
    warnings.push("Falta APP_URL: los links de los mails no van a apuntar a tu dominio.");
  } else if (!appUrl.startsWith("https://") && !isLocalUrl(appUrl)) {
    warnings.push("APP_URL no usa https: las cookies de sesión viajarían sin cifrar.");
  }
  if (!env.SMTP_HOST?.trim()) {
    warnings.push("Sin SMTP_HOST no se manda ningún mail (bienvenida, confirmar email, avisos de turnos).");
  }
  if (!env.ALERT_WEBHOOK_URL?.trim()) {
    warnings.push("Sin ALERT_WEBHOOK_URL los errores solo quedan en el log: un webhook de pago que falle no avisa a nadie.");
  }
  if (!env.DATABASE_PATH?.trim()) {
    warnings.push("Sin DATABASE_PATH la base queda en ./data: asegurate de que sea un disco persistente.");
  }

  return { errors, warnings };
}
