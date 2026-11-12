import { getCurrentUser } from "@/server/auth";
import { getBillingInfo } from "@/server/billing";
import { errorResponse, json } from "@/server/http";

export const dynamic = "force-dynamic";

/** Suscripción de la barbería: estado, precio, fechas y pagos. Solo el dueño, que es quien paga. */
export async function GET() {
  try {
    const current = await getCurrentUser();
    if (!current) return json({ error: "Tu sesión expiró. Volvé a ingresar." }, 401);
    if (current.actor.role !== "admin") return json({ error: "Acción reservada al dueño del local" }, 403);
    return json(await getBillingInfo(current.actor.shopId));
  } catch (error) {
    return errorResponse(error);
  }
}
