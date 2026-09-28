import { z } from "zod";
import { loginPasswordSchema, passwordSchema } from "@/lib/password";
import { getAccount } from "@/server/auth";
import { hashPassword, verifyPassword } from "@/server/crypto";
import { errorResponse, json, readBody } from "@/server/http";
import { mutate } from "@/server/repository";

const schema = z.object({ current: loginPasswordSchema, next: passwordSchema });

/** Cambio de contraseña con la sesión abierta. */
export async function POST(request: Request) {
  try {
    const account = await getAccount();
    if (!account) return json({ error: "Tu sesión expiró" }, 401);
    const { current, next } = await readBody(request, schema);
    if (!verifyPassword(current, account.user.password_hash)) {
      return json({ error: "La contraseña actual no es correcta" }, 401);
    }
    if (current === next) return json({ error: "La nueva contraseña debe ser distinta" }, 422);
    await mutate((db) =>
      db.run("UPDATE users SET password_hash = ? WHERE id = ?", [hashPassword(next), account.user.id]),
    );
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
