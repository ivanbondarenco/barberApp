// Da de baja una barbería entera: su agenda, clientes, catálogo, cuentas del staff y credenciales.
//
//   node scripts/remove-shop.mjs <slug>          muestra qué se borraría, sin tocar nada
//   node scripts/remove-shop.mjs <slug> --yes    lo borra (antes deja una copia de la base)
//
// Las cuentas de clientes se borran solo si esta era su única barbería: quien también se atiende
// en otra conserva su cuenta. Conviene correrlo con la app detenida.
import fs from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";

async function main() {
  const [slug, flag] = process.argv.slice(2);
  if (!slug) {
    console.error("Uso: node scripts/remove-shop.mjs <slug> [--yes]");
    process.exitCode = 1;
    return;
  }
  const apply = flag === "--yes";

  const file = path.resolve(process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "ds-studio.db"));
  if (!fs.existsSync(file)) {
    console.error(`No existe la base en ${file}`);
    process.exitCode = 1;
    return;
  }

  const SQL = await initSqlJs({ locateFile: (f) => path.join(process.cwd(), "node_modules", "sql.js", "dist", f) });
  const db = new SQL.Database(fs.readFileSync(file));
  const all = (sql, params = []) => {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  };
  const count = (sql, params) => Number(all(sql, params)[0]?.n ?? 0);
  const has = (table) => all("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", [table]).length > 0;

  const shop = all("SELECT id, slug, name FROM shops WHERE slug = ?", [slug.trim().toLowerCase()])[0];
  if (!shop) {
    console.error(`No hay ninguna barbería con el slug "${slug}".`);
    console.error(`Barberías: ${all("SELECT slug FROM shops").map((r) => r.slug).join(", ") || "(ninguna)"}`);
    process.exitCode = 1;
    return;
  }

  // Todas las tablas con shop_id guardan datos de una sola barbería.
  const tables = all("SELECT name FROM sqlite_master WHERE type = 'table'")
    .map((r) => r.name)
    .filter((name) => all(`PRAGMA table_info(${name})`).some((c) => c.name === "shop_id"));

  // Clientes que se quedan sin barbería: sus cuentas se van con esta. Los que tienen otra, no.
  const orphanClients = all(
    `SELECT m.user_id AS id FROM memberships m
     WHERE m.shop_id = ?
       AND NOT EXISTS (SELECT 1 FROM memberships o WHERE o.user_id = m.user_id AND o.shop_id <> ?)`,
    [shop.id, shop.id],
  ).map((r) => r.id);
  const staff = all("SELECT id FROM users WHERE shop_id = ?", [shop.id]).map((r) => r.id);
  const users = [...staff, ...orphanClients];

  console.log(`Barbería: ${shop.name} (${shop.slug}, id ${shop.id})`);
  for (const table of tables) {
    const n = count(`SELECT COUNT(*) AS n FROM ${table} WHERE shop_id = ?`, [shop.id]);
    if (n) console.log(`  ${table}: ${n}`);
  }
  if (has("secrets")) console.log(`  credenciales: ${count("SELECT COUNT(*) AS n FROM secrets WHERE scope = ?", [shop.id])}`);
  console.log(`  cuentas de staff: ${staff.length} · cuentas de clientes sin otra barbería: ${orphanClients.length}`);

  if (!apply) {
    console.log("\nNo se borró nada. Para borrarla: agregá --yes");
    return;
  }

  const backup = file.replace(/\.db$/, "") + `-antes-de-borrar-${shop.slug}-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.db`;
  fs.copyFileSync(file, backup);

  const placeholders = (list) => list.map(() => "?").join(", ");
  db.run("BEGIN");
  try {
    if (users.length) {
      for (const table of ["sessions", "email_tokens"]) {
        if (has(table)) db.run(`DELETE FROM ${table} WHERE user_id IN (${placeholders(users)})`, users);
      }
      db.run(`DELETE FROM users WHERE id IN (${placeholders(users)})`, users);
    }
    for (const table of tables) db.run(`DELETE FROM ${table} WHERE shop_id = ?`, [shop.id]);
    if (has("secrets")) db.run("DELETE FROM secrets WHERE scope = ?", [shop.id]);
    db.run("DELETE FROM shops WHERE id = ?", [shop.id]);
    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    console.error("No se borró nada:", error.message);
    process.exitCode = 1;
    return;
  }

  // Igual que la app: temporal + rename, para no dejar nunca un archivo a medias.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, Buffer.from(db.export()));
  fs.renameSync(tmp, file);
  console.log(`\nBarbería "${shop.name}" borrada. Copia previa: ${backup}`);
}

await main();
