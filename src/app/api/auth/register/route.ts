import { z } from "zod";
import { DomainError } from "@/lib/commands";
import { uid } from "@/lib/format";
import { passwordSchema } from "@/lib/password";
import { startSession, visitorShop } from "@/server/auth";
import { hashPassword, normalizeIdentifier } from "@/server/crypto";
import { queryOne } from "@/server/db";
import { errorResponse, json, phoneSchema, readBody } from "@/server/http";
import { notifyClientRegistered } from "@/server/notify";
import { ensureSeeded, joinShopTx, mutate } from "@/server/repository";

const schema = z.object({
  name: z.string().trim().min(3, "Ingresá nombre y apellido"),
  email: z.email("Email inválido"),
  phone: phoneSchema,
  password: passwordSchema,
});

const TAKEN = "Ya existe una cuenta con este email. Iniciá sesión.";

/**
 * Alta de un cliente. La cuenta es una sola para todas las barberías; si llegó por el link de
 * un local, ya queda sumado a ese. Las demás las elige después.
 */
export async function POST(request: Request) {
  try {
    const input = await readBody(request, schema);
    const identifier = normalizeIdentifier(input.email);
    const db = await ensureSeeded();
    if (queryOne(db, "SELECT id FROM users WHERE role = 'cliente' AND identifier = ?", [identifier])) {
      return json({ error: TAKEN }, 409);
    }

    const shop = await visitorShop();
    const now = new Date().toISOString();
    const userId = await mutate((d) => {
      // Se vuelve a controlar dentro de la transacción por si se registró otro con el mismo email.
      if (queryOne(d, "SELECT id FROM users WHERE role = 'cliente' AND identifier = ?", [identifier])) {
        throw new DomainError(TAKEN, 409);
      }
      const id = uid("u");
      d.run(
        `INSERT INTO users (id, shop_id, role, identifier, name, barber_id, phone, password_hash, created_at)
         VALUES (?, NULL, 'cliente', ?, ?, NULL, ?, ?, ?)`,
        [id, identifier, input.name, input.phone, hashPassword(input.password), now],
      );
      if (shop) joinShopTx(d, id, shop.id, { name: input.name, phone: input.phone, email: identifier }, now);
      return id;
    });

    await startSession(userId, shop?.id ?? null);
    // Bienvenida y link para confirmar el email. Si no hay SMTP configurado, no pasa nada.
    await notifyClientRegistered({ id: userId, name: input.name, email: identifier }, shop?.name);
    return json({ ok: true, hasShop: !!shop });
  } catch (error) {
    return errorResponse(error);
  }
}
