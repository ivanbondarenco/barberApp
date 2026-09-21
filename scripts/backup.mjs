// Copia con fecha del archivo de la base. Pensado para correr por cron en el servidor:
//   0 3 * * *  cd /app && node scripts/backup.mjs
//
// La app escribe con temporal + rename, así que copiar el archivo siempre toma una versión
// consistente: o la anterior completa, o la nueva completa, nunca una a medias.
import fs from "node:fs";
import path from "node:path";

const source = path.resolve(process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "ds-studio.db"));
const dir = path.resolve(process.env.BACKUP_DIR ?? path.join(path.dirname(source), "backups"));
const keep = Number(process.env.BACKUP_KEEP ?? 14);

if (!fs.existsSync(source)) {
  console.error(`No existe la base en ${source}`);
  process.exit(1);
}

fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const target = path.join(dir, `ds-studio-${stamp}.db`);
fs.copyFileSync(source, target);
console.log(`Backup: ${target} (${(fs.statSync(target).size / 1024 / 1024).toFixed(2)} MB)`);

// Rotación: se conservan las últimas `keep` copias.
const old = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith("ds-studio-") && f.endsWith(".db"))
  .sort()
  .slice(0, -keep);
for (const file of old) {
  fs.rmSync(path.join(dir, file));
  console.log(`Borrado backup viejo: ${file}`);
}
