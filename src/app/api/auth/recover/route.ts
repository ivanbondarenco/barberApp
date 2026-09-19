import { z } from "zod";
import { DEMO_OTP } from "@/lib/mock-data";
import type { UserRow } from "@/server/auth";
import { hashPin, normalizeIdentifier } from "@/server/crypto";
import { queryOne } from "@/server/db";
import { errorResponse, json, pinSchema, readBody } from "@/server/http";
import { ensureSeeded, mutate } from "@/server/repository";

const schema = z.object({
  identifier: z.string().trim().min(3, "Ingresá tu celular o email"),
  code: z.string().optional(),
  pin: pinSchema.optional(),
});

/** `{identifier}` envía el código · `{identifier, code}` lo valida · `{identifier, code, pin}` guarda el PIN. */
export async function POST(request: Request) {
  try {
    const { identifier, code, pin } = await readBody(request, schema);
    const db = await ensureSeeded();
    const user = queryOne<UserRow>(db, "SELECT * FROM users WHERE identifier = ?", [normalizeIdentifier(identifier)]);
    if (!user) return json({ error: "No encontramos una cuenta con ese dato" }, 404);
    if (!code) return json({ sent: true });
    if (code !== DEMO_OTP) return json({ error: "Código incorrecto" }, 401);
    if (!pin) return json({ verified: true });
    if (/^(\d)\1{3}$/.test(pin) || pin === "1234" || pin === "0123") {
      return json({ error: "Elegí un PIN menos predecible" }, 422);
    }
    await mutate((d) => {
      d.run("UPDATE users SET pin_hash = ? WHERE id = ?", [hashPin(pin), user.id]);
      d.run("DELETE FROM sessions WHERE user_id = ?", [user.id]);
    });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
