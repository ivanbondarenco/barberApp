import { z } from "zod";
import { startSession, visitorShop, type UserRow } from "@/server/auth";
import { normalizeIdentifier } from "@/server/crypto";
import { queryOne } from "@/server/db";
import { errorResponse, json, phoneSchema, readBody } from "@/server/http";
import { consumeOtp, issueOtp } from "@/server/otp";
import { ensureSeeded } from "@/server/repository";

const schema = z.object({ phone: phoneSchema, code: z.string().optional() });

/**
 * Acceso rápido por código. Sin `code` manda el código por WhatsApp; con `code` lo valida.
 * El código es aleatorio, se guarda hasheado y vale una sola vez (ver `server/otp.ts`).
 */
export async function POST(request: Request) {
  try {
    const { phone, code } = await readBody(request, schema);
    const shop = await visitorShop();
    if (!shop) return json({ error: "Abrí el link de tu barbería para ingresar." }, 400);

    const db = await ensureSeeded();
    const identifier = normalizeIdentifier(phone);
    const user = queryOne<UserRow>(db, "SELECT * FROM users WHERE shop_id = ? AND identifier = ? AND role = ?", [
      shop.id,
      identifier,
      "cliente",
    ]);
    if (!user) return json({ error: "No hay una cuenta con ese celular. Registrate primero." }, 404);

    if (!code) {
      const issued = await issueOtp(shop.id, identifier, "acceso", phone);
      return json({ sent: true, ...issued });
    }

    await consumeOtp(shop.id, identifier, "acceso", code);
    await startSession(user.id);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
