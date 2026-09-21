import { z } from "zod";
import { visitorShop, type UserRow } from "@/server/auth";
import { hashPin, normalizeIdentifier } from "@/server/crypto";
import { queryOne } from "@/server/db";
import { errorResponse, json, pinSchema, readBody } from "@/server/http";
import { consumeOtp, issueOtp } from "@/server/otp";
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
    const shop = await visitorShop();
    if (!shop) return json({ error: "Abrí el link de tu barbería para continuar." }, 400);

    const db = await ensureSeeded();
    const key = normalizeIdentifier(identifier);
    const user = queryOne<UserRow>(db, "SELECT * FROM users WHERE shop_id = ? AND identifier = ?", [shop.id, key]);
    if (!user) return json({ error: "No encontramos una cuenta con ese dato" }, 404);

    if (!code) {
      // El código va al celular de la cuenta, no al dato que se escribió en el formulario:
      // así, con un email no se puede desviar el código a otro número.
      const client = user.client_id
        ? queryOne<{ data: string }>(db, "SELECT data FROM clients WHERE shop_id = ? AND id = ?", [shop.id, user.client_id])
        : undefined;
      const phone = client ? (JSON.parse(client.data) as { phone: string }).phone : user.identifier;
      const issued = await issueOtp(shop.id, key, "recuperacion", phone);
      return json({ sent: true, ...issued });
    }

    // Sin PIN es solo la validación del paso intermedio: el código sigue vivo para el último paso.
    if (!pin) {
      await consumeOtp(shop.id, key, "recuperacion", code, { consume: false });
      return json({ verified: true });
    }

    if (/^(\d)\1{3}$/.test(pin) || pin === "1234" || pin === "0123") {
      return json({ error: "Elegí un PIN menos predecible" }, 422);
    }
    await consumeOtp(shop.id, key, "recuperacion", code);
    await mutate((d) => {
      d.run("UPDATE users SET pin_hash = ? WHERE id = ?", [hashPin(pin), user.id]);
      d.run("DELETE FROM sessions WHERE user_id = ?", [user.id]);
    });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
