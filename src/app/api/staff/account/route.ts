import { z } from "zod";
import { passwordSchema } from "@/lib/password";
import { getCurrentUser, type UserRow } from "@/server/auth";
import { hashPassword, normalizeIdentifier } from "@/server/crypto";
import { queryOne } from "@/server/db";
import { errorResponse, json, readBody } from "@/server/http";
import { ensureSeeded, mutate, staffByIdentifier } from "@/server/repository";

export const dynamic = "force-dynamic";

const schema = z.object({
  barberId: z.string().min(1),
  /** Email o celular con el que entra el barbero. Vacío elimina su acceso. */
  identifier: z.string().trim().default(""),
  password: passwordSchema.optional(),
});

/**
 * Alta, cambio de contraseña o baja del acceso de un barbero. Solo el dueño.
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
    const { barberId, identifier, password } = await readBody(request, schema);
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
    // Un barbero trabaja en una sola barbería: el dato no puede estar en uso en ninguna otra.
    if (staffByIdentifier(db, key).some((u) => u.id !== existing?.id)) {
      return json({ error: "Ese email o celular ya está en uso por otra cuenta de barbería" }, 409);
    }
    if (!existing && !password) return json({ error: "Elegí una contraseña inicial" }, 422);

    const name = queryOne<{ data: string }>(db, "SELECT data FROM barbers WHERE shop_id = ? AND id = ?", [shopId, barberId]);
    const barberName = name ? (JSON.parse(name.data) as { name: string }).name : "Barbero";
    const stamp = new Date().toISOString();

    await mutate((d) => {
      if (existing) {
        d.run("UPDATE users SET identifier = ?, name = ? WHERE id = ?", [key, barberName, existing.id]);
        if (password) {
          d.run("UPDATE users SET password_hash = ? WHERE id = ?", [hashPassword(password), existing.id]);
          // Cambiar la contraseña cierra las sesiones abiertas de esa cuenta.
          d.run("DELETE FROM sessions WHERE user_id = ?", [existing.id]);
        }
        return;
      }
      d.run(
        `INSERT INTO users (id, shop_id, role, identifier, name, barber_id, password_hash, created_at)
         VALUES (?, ?, 'barbero', ?, ?, ?, ?, ?)`,
        [`u-${shopId}-${barberId}`, shopId, key, barberName, barberId, hashPassword(password!), stamp],
      );
    }, { touchesState: shopId });

    return json({ ok: true, hasAccount: true });
  } catch (error) {
    return errorResponse(error);
  }
}
