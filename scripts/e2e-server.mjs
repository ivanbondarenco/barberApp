// Levanta la app de producción con una base de datos descartable para los tests E2E.
import { spawn, spawnSync } from "node:child_process";
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
  // Los tests parten de la barbería de demostración sembrada.
  SEED_DEMO: "1",
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
