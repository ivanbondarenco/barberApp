import { getCurrentUser } from "@/server/auth";
import { cancelSubscription, getBillingInfo } from "@/server/billing";
import { errorResponse, json } from "@/server/http";

export const dynamic = "force-dynamic";

/** Cancela el débito automático. Lo ya pagado sigue valiendo hasta su fecha. */
export async function POST() {
  try {
    const current = await getCurrentUser();
    if (!current) return json({ error: "Tu sesión expiró. Volvé a ingresar." }, 401);
    if (current.actor.role !== "admin") return json({ error: "Acción reservada al dueño del local" }, 403);
    await cancelSubscription(current.actor.shopId);
    return json(await getBillingInfo(current.actor.shopId));
  } catch (error) {
    return errorResponse(error);
  }
}
