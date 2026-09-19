import { z } from "zod";
import { DEMO_OTP } from "@/lib/mock-data";
import { startSession, type UserRow } from "@/server/auth";
import { normalizeIdentifier } from "@/server/crypto";
import { queryOne } from "@/server/db";
import { errorResponse, json, phoneSchema, readBody } from "@/server/http";
import { ensureSeeded } from "@/server/repository";

const schema = z.object({ phone: phoneSchema, code: z.string().optional() });

/**
 * Acceso rápido por código. Sin `code` "envía" el código; con `code` lo valida.
 * MVP: el código es fijo (DEMO_OTP) hasta integrar WhatsApp Cloud API / Twilio.
 */
export async function POST(request: Request) {
  try {
    const { phone, code } = await readBody(request, schema);
    const db = await ensureSeeded();
    const user = queryOne<UserRow>(db, "SELECT * FROM users WHERE identifier = ? AND role = ?", [
      normalizeIdentifier(phone),
      "cliente",
    ]);
    if (!user) return json({ error: "No hay una cuenta con ese celular. Registrate primero." }, 404);
    if (!code) return json({ sent: true });
    if (code !== DEMO_OTP) return json({ error: "Código incorrecto" }, 401);
    await startSession(user.id);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
