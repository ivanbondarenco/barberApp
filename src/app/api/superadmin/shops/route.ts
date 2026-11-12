import { getAccount } from "@/server/auth";
import { isSuperadmin, listShopsForSuperadmin } from "@/server/billing";
import { errorResponse, json } from "@/server/http";

export const dynamic = "force-dynamic";

/** Todas las barberías con su suscripción y su actividad. Solo SUPERADMIN_IDENTIFIERS. */
export async function GET() {
  try {
    const account = await getAccount();
    if (!account) return json({ error: "Tu sesión expiró. Volvé a ingresar." }, 401);
    // 404 y no 403: quien no es superadmin no tiene por qué saber que esto existe.
    if (!isSuperadmin(account.user.identifier)) return json({ error: "No encontrado" }, 404);
    return json({ shops: await listShopsForSuperadmin() });
  } catch (error) {
    return errorResponse(error);
  }
}
