import { z } from "zod";
import { passwordSchema } from "@/lib/password";
import { clientShops, type UserRow } from "@/server/auth";
import { hashPassword, normalizeIdentifier } from "@/server/crypto";
import { queryOne } from "@/server/db";
import { errorResponse, json, readBody } from "@/server/http";
import { mailReady } from "@/server/mail";
import { emailOf, notifyPasswordCode } from "@/server/notify";
import { consumeOtp, issueOtp, issueOtpWith } from "@/server/otp";
import { ensureSeeded, mutate, staffByIdentifier } from "@/server/repository";
import { whatsappReady } from "@/server/whatsapp";

const schema = z.object({
  role: z.enum(["cliente", "staff"]),
  identifier: z.string().trim().min(3, "Ingresá tu email"),
  code: z.string().optional(),
  password: passwordSchema.optional(),
});

/** Códigos que se mandan por mail: no son de ninguna barbería, como la cuenta del cliente. */
const ACCOUNT_SCOPE = "cuenta";

/**
 * `{role, identifier}` envía el código · `+code` lo valida · `+code, password` guarda la nueva.
 *
 * El código va por mail a la casilla de la cuenta. Si la cuenta entra con celular, o no hay
 * SMTP configurado, sale por el WhatsApp de una barbería: la del staff, o para un cliente la
 * primera de las suyas que lo tenga configurado. Siempre al dato de la cuenta, nunca a uno
 * escrito en el formulario: así no se puede desviar el código a otro lado.
 */
export async function POST(request: Request) {
  try {
    const { role, identifier, code, password } = await readBody(request, schema);
    const db = await ensureSeeded();
    const key = normalizeIdentifier(identifier);
    const user =
      role === "cliente"
        ? queryOne<UserRow>(db, "SELECT * FROM users WHERE role = 'cliente' AND identifier = ?", [key])
        : staffByIdentifier<UserRow>(db, key)[0];
    if (!user) return json({ error: "No encontramos una cuenta con ese dato" }, 404);

    // El código se ata a la cuenta (no al email): cliente y barbero pueden compartir casilla.
    const byMail = emailOf(user.identifier);
    const useMail = !!byMail && mailReady();

    // Por WhatsApp hace falta una barbería que lo tenga configurado, y el celular de la cuenta.
    let scope = ACCOUNT_SCOPE;
    let phone = "";
    if (!useMail) {
      if (user.role !== "cliente") {
        scope = user.shop_id!;
        phone = user.identifier;
      } else {
        const shops = clientShops(db, user.id);
        const ready = await Promise.all(shops.map((s) => whatsappReady(s.id)));
        const via = shops[ready.indexOf(true)] ?? shops[0];
        if (!via) return json({ error: "Tu cuenta no está en ninguna barbería. Escribile a tu barbería para recuperarla." }, 422);
        const profile = queryOne<{ data: string }>(db, "SELECT data FROM clients WHERE shop_id = ? AND id = ?", [via.id, via.clientId]);
        scope = via.id;
        phone = profile ? (JSON.parse(profile.data) as { phone: string }).phone : user.phone ?? "";
      }
    }

    if (!code) {
      const issued = useMail
        ? await issueOtpWith(scope, user.id, "recuperacion", (c) => notifyPasswordCode(byMail!, user.name, c))
        : await issueOtp(scope, user.id, "recuperacion", phone);
      return json({ sent: true, via: useMail ? "email" : "whatsapp", ...issued });
    }

    // Sin contraseña es solo la validación del paso intermedio: el código sigue vivo para el último.
    if (!password) {
      await consumeOtp(scope, user.id, "recuperacion", code, { consume: false });
      return json({ verified: true });
    }

    await consumeOtp(scope, user.id, "recuperacion", code);
    await mutate((d) => {
      d.run("UPDATE users SET password_hash = ? WHERE id = ?", [hashPassword(password), user.id]);
      d.run("DELETE FROM sessions WHERE user_id = ?", [user.id]);
    });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
