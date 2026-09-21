import fs from "node:fs";
import path from "node:path";
import { listShops } from "@/server/repository";
import { storageStats } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * Estado del servicio, para el monitoreo del hosting y para ver venir el techo de storage.
 *
 * No expone datos de ninguna barbería: solo cuántas hay y cuánto cuesta guardar. Con sql.js
 * cada escritura reescribe el archivo entero, así que `storage.lastWriteMs` es el número a
 * mirar: cuando empiece a subir, llegó el momento de migrar a Postgres.
 */
export async function GET() {
  const started = Date.now();
  try {
    const shops = await listShops();
    // Tamaño real en disco: `storageStats.bytes` recién se llena tras la primera escritura.
    const dbPath = path.resolve(process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "ds-studio.db"));
    const bytes = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
    return Response.json(
      {
        status: "ok",
        uptimeSeconds: Math.round(process.uptime()),
        shops: shops.length,
        storage: {
          bytes,
          megabytes: Math.round((bytes / 1024 / 1024) * 100) / 100,
          lastWriteMs: storageStats.lastWriteMs,
          writes: storageStats.writes,
          /** Escrituras que se evitaron juntando ráfagas. */
          coalesced: storageStats.coalesced,
        },
        readMs: Date.now() - started,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Health check falló", error);
    return Response.json({ status: "error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
