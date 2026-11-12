import { getCurrentUser } from "@/server/auth";
import { getBillingStatus } from "@/server/billing";
import { errorResponse, json } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * Estado de la suscripción para el aviso del panel. Lo pide todo el staff: el barbero también
 * tiene que saber por qué no puede cargar turnos si el local está suspendido. Sin precio ni pagos.
 */
export async function GET() {
  try {
    const current = await getCurrentUser();
    if (!current) return json({ error: "Tu sesión expiró. Volvé a ingresar." }, 401);
    if (current.actor.role !== "admin" && current.actor.role !== "barbero") {
      return json({ error: "Acción reservada al staff" }, 403);
    }
    return json(await getBillingStatus(current.actor.shopId));
  } catch (error) {
    return errorResponse(error);
  }
}
