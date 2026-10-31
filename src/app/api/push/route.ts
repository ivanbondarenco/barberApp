import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { errorResponse, json, readBody } from "@/server/http";
import { pushPublicKey, removeSubscription, saveSubscription } from "@/server/push";

export const dynamic = "force-dynamic";

const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Avisos push del staff: solo el dueño y los barberos reciben turnos nuevos en el celular. */
async function staff() {
  const current = await getCurrentUser();
  if (current?.actor.role !== "admin" && current?.actor.role !== "barbero") return null;
  return current;
}

/** Clave pública para suscribirse. `publicKey: null` si el servidor no tiene push configurado. */
export async function GET() {
  try {
    if (!(await staff())) return json({ error: "Acción reservada al staff" }, 403);
    return json({ publicKey: pushPublicKey() });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Registra este navegador para recibir avisos. */
export async function POST(request: Request) {
  try {
    const current = await staff();
    if (!current) return json({ error: "Acción reservada al staff" }, 403);
    if (!pushPublicKey()) return json({ error: "Los avisos no están disponibles" }, 503);
    const subscription = await readBody(request, subscriptionSchema);
    await saveSubscription(current.user.id, current.actor.shopId, {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Deja de mandar avisos a este navegador. */
export async function DELETE(request: Request) {
  try {
    const current = await staff();
    if (!current) return json({ error: "Acción reservada al staff" }, 403);
    const { endpoint } = await readBody(request, z.object({ endpoint: z.url().max(1000) }));
    await removeSubscription(current.user.id, endpoint);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
