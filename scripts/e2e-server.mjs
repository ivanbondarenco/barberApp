// Levanta la app de producción con una base de datos descartable para los tests E2E.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const port = process.argv[2] ?? "3210";
const root = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(root, ".test-data");
fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });

// OTP_DEBUG hace que el servidor devuelva el código en la respuesta en vez de mandarlo por
// WhatsApp: es la única forma de probar el registro y la recuperación sin una cuenta de Meta.
const env = {
  ...process.env,
  DATABASE_PATH: path.join(dataDir, "e2e.db"),
  NEXT_TELEMETRY_DISABLED: "1",
  OTP_DEBUG: "1",
  // La app compilada corre con NODE_ENV=production, que no admite OTP_DEBUG ni SEED_DEMO: este
  // modo los habilita, y solo contra una dirección local (ver `testModeAllowed`).
  E2E_TEST_MODE: "1",
  APP_URL: `http://localhost:${port}`,
  // Clave descartable por corrida: las credenciales de prueba se cifran igual que en producción.
  SECRETS_KEY: randomBytes(32).toString("base64"),
  // Los tests parten de la barbería de demostración sembrada.
  SEED_DEMO: "1",
  // Sin SMTP: los tests NO pueden mandar mails de verdad. Next carga .env.local solo,
  // así que no alcanza con no configurarlo acá: hay que apagarlo explícitamente.
  SMTP_HOST: "",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  MAIL_FROM: "",
  // Los errores que los tests provocan a propósito no tienen que llegar al canal de alertas.
  ALERT_WEBHOOK_URL: "",
};
const next = path.join(root, "node_modules", "next", "dist", "bin", "next");

if (process.env.E2E_SKIP_BUILD !== "1") {
  const build = spawnSync(process.execPath, [next, "build"], { cwd: root, env, stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const server = spawn(process.execPath, [next, "start", "-p", port], { cwd: root, env, stdio: "inherit" });
const stop = () => server.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", stop);
server.on("exit", (code) => process.exit(code ?? 0));
