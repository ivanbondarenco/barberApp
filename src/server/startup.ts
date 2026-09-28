import "server-only";
import { productionConfig } from "./config";

/**
 * Chequeo de configuración al levantar el servidor (solo runtime Node).
 *
 * Si la configuración de producción es insegura, el proceso termina: un deploy que no levanta se
 * ve enseguida en el hosting, en vez de quedar vivo respondiendo errores. Es preferible eso a
 * publicar los códigos de verificación o guardar credenciales sin cifrar.
 */
export function checkProductionConfig(): void {
  const { errors, warnings } = productionConfig();
  for (const warning of warnings) console.warn(`[config] ${warning}`);
  if (!errors.length) return;
  console.error(`[config] La configuración de producción no es segura:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
