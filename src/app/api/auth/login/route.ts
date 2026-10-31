import { z } from "zod";
import { loginPasswordSchema } from "@/lib/password";
import { clientShops, startSession, visitorShop, type UserRow } from "@/server/auth";
import { normalizeIdentifier, verifyPassword } from "@/server/crypto";
import { queryOne } from "@/server/db";
import { errorResponse, json, readBody } from "@/server/http";
import { ensureSeeded, staffByIdentifier } from "@/server/repository";

const schema = z.object({
  /** "staff" es la solapa "Soy barbero": acepta al dueño y a los barberos. */
  role: z.enum(["cliente", "staff"]),
  identifier: z.string().trim().min(3, "Ingresá tu email"),
  password: loginPasswordSchema,
});

/**
 * Ingreso con email (o celular, para el staff) y contraseña. No depende de ninguna barbería:
 * el staff entra a la suya y el cliente a la que eligió por última vez.
 */
export async function POST(request: Request) {
  try {
    const { role, identifier, password } = await readBody(request, schema);
    const key = normalizeIdentifier(identifier);

    const db = await ensureSeeded();
    const user =
      role === "cliente"
        ? queryOne<UserRow>(db, "SELECT * FROM users WHERE role = 'cliente' AND identifier = ?", [key])
        : // Si una base vieja trae el mismo dato en dos barberías, entra a la que corresponde la contraseña.
          staffByIdentifier<UserRow>(db, key).find((u) => verifyPassword(password, u.password_hash));
    if (!user || !verifyPassword(password, user.password_hash)) {
      return json({ error: "Email o contraseña incorrectos." }, 401);
    }

    // El cliente arranca en la barbería del link por el que llegó, si es una de las suyas.
    let shopId: string | null = null;
    if (user.role === "cliente") {
      const mine = clientShops(db, user.id);
      const visiting = await visitorShop();
      shopId = mine.find((s) => s.id === visiting?.id)?.id ?? mine[0]?.id ?? null;
    }
    await startSession(user.id, shopId);
    return json({ ok: true, role: user.role, hasShop: user.role !== "cliente" || !!shopId });
  } catch (error) {
    return errorResponse(error);
  }
}
