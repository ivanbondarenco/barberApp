import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { createSubscription } from "@/server/billing";
import { errorResponse, json, publicBaseUrl, readBody } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  /** Solo si el dueño entró con el celular: Mercado Pago pide el email del que paga. */
  email: z.email("Ingresá un email válido").optional(),
});

/**
 * Inicia la suscripción automática con Mercado Pago y devuelve el link donde el dueño la
 * autoriza. Anda también con la barbería suspendida: es justamente lo que necesita para volver.
 */
export async function POST(request: Request) {
  try {
    const current = await getCurrentUser();
    if (!current) return json({ error: "Tu sesión expiró. Volvé a ingresar." }, 401);
    if (current.actor.role !== "admin") return json({ error: "Acción reservada al dueño del local" }, 403);
    const { email } = await readBody(request, schema);
    const { initPoint } = await createSubscription(current.actor.shopId, { baseUrl: publicBaseUrl(request), email });
    return json({ initPoint });
  } catch (error) {
    return errorResponse(error);
  }
}
