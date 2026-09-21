import { z } from "zod";
import { clearFailures, isLocked, registerFailure, startSession, visitorShop, type UserRow } from "@/server/auth";
import { normalizeIdentifier, verifyPin } from "@/server/crypto";
import { queryOne } from "@/server/db";
import { errorResponse, json, pinSchema, readBody } from "@/server/http";
import { ensureSeeded } from "@/server/repository";

const schema = z.object({
  // "admin" es la solapa "Barbería" del ingreso: acepta al dueño y a los barberos con cuenta.
  role: z.enum(["cliente", "admin"]),
  identifier: z.string().trim().min(3, "Ingresá tu celular o email"),
  pin: pinSchema,
});

export async function POST(request: Request) {
  try {
    const { role, identifier, pin } = await readBody(request, schema);
    // Cada barbería tiene sus propias cuentas: el mismo celular puede ser cliente de varias.
    const shop = await visitorShop();
    if (!shop) return json({ error: "Abrí el link de tu barbería para ingresar." }, 400);

    const key = `${shop.id}:${normalizeIdentifier(identifier)}`;
    if (isLocked(key)) return json({ error: "Demasiados intentos. Esperá 10 minutos o recuperá tu PIN." }, 429);

    const db = await ensureSeeded();
    const user = queryOne<UserRow>(db, "SELECT * FROM users WHERE shop_id = ? AND identifier = ?", [
      shop.id,
      normalizeIdentifier(identifier),
    ]);
    const roleMatches = role === "cliente" ? user?.role === "cliente" : user?.role === "admin" || user?.role === "barbero";
    if (!user || !roleMatches || !verifyPin(pin, user.pin_hash)) {
      registerFailure(key);
      return json({ error: "Datos incorrectos. Revisá el celular o email, el PIN y el tipo de cuenta." }, 401);
    }
    clearFailures(key);
    await startSession(user.id);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
