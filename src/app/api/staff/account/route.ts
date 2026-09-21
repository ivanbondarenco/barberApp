import { z } from "zod";
import { getCurrentUser, type UserRow } from "@/server/auth";
import { hashPin, normalizeIdentifier } from "@/server/crypto";
import { queryOne } from "@/server/db";
import { errorResponse, json, pinSchema, readBody } from "@/server/http";
import { ensureSeeded, mutate } from "@/server/repository";

export const dynamic = "force-dynamic";

const schema = z.object({
  barberId: z.string().min(1),
  /** Email o celular con el que entra el barbero. Vacío elimina su acceso. */
  identifier: z.string().trim().default(""),
  pin: pinSchema.optional(),
});

/**
 * Alta, cambio de PIN o baja del acceso de un barbero. Solo el dueño.
 *
 * El acceso vive en `users`, no en el estado de dominio: un barbero es una persona que entra
 * a la app, distinto del sillón que aparece en la agenda.
 */
export async function POST(request: Request) {
  try {
    const current = await getCurrentUser();
    if (!current) return json({ error: "Tu sesión expiró. Volvé a ingresar." }, 401);
    if (current.actor.role !== "admin") return json({ error: "Acción reservada al dueño del local" }, 403);

    const shopId = current.actor.shopId;
    const { barberId, identifier, pin } = await readBody(request, schema);
    const db = await ensureSeeded();
    if (!queryOne(db, "SELECT id FROM barbers WHERE shop_id = ? AND id = ?", [shopId, barberId])) {
      return json({ error: "El barbero no existe" }, 404);
    }
    const existing = queryOne<UserRow>(db, "SELECT * FROM users WHERE shop_id = ? AND barber_id = ?", [shopId, barberId]);

    // Sin identificador: se le quita el acceso (el sillón y sus turnos quedan intactos).
    if (!identifier) {
      if (existing) {
        await mutate((d) => {
          d.run("DELETE FROM sessions WHERE user_id = ?", [existing.id]);
          d.run("DELETE FROM users WHERE id = ?", [existing.id]);
        }, { touchesState: shopId });
      }
      return json({ ok: true, hasAccount: false });
    }

    const key = normalizeIdentifier(identifier);
    const taken = queryOne<UserRow>(db, "SELECT * FROM users WHERE shop_id = ? AND identifier = ?", [shopId, key]);
    if (taken && taken.barber_id !== barberId) {
      return json({ error: "Ese email o celular ya está en uso por otra cuenta" }, 409);
    }
    if (!existing && !pin) return json({ error: "Elegí un PIN inicial de 4 dígitos" }, 422);

    const name = queryOne<{ data: string }>(db, "SELECT data FROM barbers WHERE shop_id = ? AND id = ?", [shopId, barberId]);
    const barberName = name ? (JSON.parse(name.data) as { name: string }).name : "Barbero";
    const stamp = new Date().toISOString();

    await mutate((d) => {
      if (existing) {
        d.run("UPDATE users SET identifier = ?, name = ? WHERE id = ?", [key, barberName, existing.id]);
        if (pin) {
          d.run("UPDATE users SET pin_hash = ? WHERE id = ?", [hashPin(pin), existing.id]);
          // Cambiar el PIN cierra las sesiones abiertas de esa cuenta.
          d.run("DELETE FROM sessions WHERE user_id = ?", [existing.id]);
        }
        return;
      }
      d.run(
        `INSERT INTO users (id, shop_id, role, identifier, name, client_id, barber_id, pin_hash, created_at)
         VALUES (?, ?, 'barbero', ?, ?, NULL, ?, ?, ?)`,
        [`u-${shopId}-${barberId}`, shopId, key, barberName, barberId, hashPin(pin!), stamp],
      );
    }, { touchesState: shopId });

    return json({ ok: true, hasAccount: true });
  } catch (error) {
    return errorResponse(error);
  }
}
