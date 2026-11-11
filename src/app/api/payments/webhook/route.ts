import { disconnectAccount, shopsForUser, verifyWebhookSignature } from "@/server/mercadopago";
import { settleOrder } from "@/server/mp-orders";
import { reportError } from "@/server/monitor";

export const dynamic = "force-dynamic";

/**
 * Notificación de Mercado Pago: la vía principal por la que una seña online pasa a "abonada"
 * (el respaldo es el repaso periódico de `src/server/mp-orders.ts`).
 *
 * Una sola URL y una sola firma para todas las barberías: es la de la aplicación BarberPagos.
 * Nada de lo que llega en el cuerpo se cree salvo el id: la orden se busca en `mp_orders` (la
 * creó la app, así se sabe de qué barbería y turno es) y su estado real se consulta contra la
 * API con el token de esa barbería.
 *
 * Eventos:
 * - `order`: una orden cambió. Si quedó cobrada, se acredita la seña.
 * - `mp-connect`: una cuenta desvinculó la app desde Mercado Pago. Se borra su conexión.
 * - El resto (por ejemplo `payment`, que llega junto con la orden) se ignora.
 *
 * Siempre responde 200: un error devuelto haría que Mercado Pago reintente en loop. Lo que no
 * se pudo procesar queda en el log y el turno sigue pendiente hasta que venza.
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as {
      type?: string;
      action?: string;
      user_id?: number | string;
      data?: { id?: string | number };
    };

    const topic = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
    // La firma se calcula sobre el data.id de la URL; el del cuerpo queda de respaldo.
    const dataId = url.searchParams.get("data.id") ?? (body.data?.id !== undefined ? String(body.data.id) : undefined);

    // Firma HMAC: sin esto, cualquiera podría acreditar señas con un POST.
    if (!verifyWebhookSignature(request.headers, dataId)) {
      console.warn("Webhook de Mercado Pago con firma inválida", {
        topic,
        dataId,
      });
      return Response.json({ ok: true });
    }

    if (topic === "order" && dataId) await settleOrder(dataId);
    else if (topic === "mp-connect" && body.action?.includes("deauthorized") && body.user_id) {
      for (const shopId of await shopsForUser(String(body.user_id))) await disconnectAccount(shopId);
    }
    return Response.json({ ok: true });
  } catch (error) {
    // Se responde 200 igual (si no, Mercado Pago reintenta en loop), pero se avisa: es una seña
    // cobrada que puede no haberse acreditado.
    await reportError("mercadopago.webhook", error);
    return Response.json({ ok: true });
  }
}
