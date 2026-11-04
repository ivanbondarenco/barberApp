import { getCurrentUser } from "@/server/auth";
import { errorResponse, json } from "@/server/http";
import { connectionInfo, disconnectAccount, oauthApp } from "@/server/mercadopago";

export const dynamic = "force-dynamic";

/** Estado de la conexión con Mercado Pago. Nunca devuelve tokens. */
export async function GET() {
  try {
    const current = await getCurrentUser();
    if (current?.actor.role !== "admin") return json({ error: "Acción reservada al dueño del local" }, 403);
    const info = await connectionInfo(current.actor.shopId);
    return json({
      ...info,
      // Si la instalación no tiene la aplicación de Mercado Pago, no hay botón para conectar.
      available: !!oauthApp(),
      // Sin la firma del webhook no se acredita ninguna seña sola.
      canReceiveWebhooks: !!process.env.MP_WEBHOOK_SECRET?.trim(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Desconecta la cuenta de Mercado Pago del local. */
export async function DELETE() {
  try {
    const current = await getCurrentUser();
    if (current?.actor.role !== "admin") return json({ error: "Acción reservada al dueño del local" }, 403);
    await disconnectAccount(current.actor.shopId);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
