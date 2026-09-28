import { getPayment, parseExternalReference, verifyWebhookSignature } from "@/server/mercadopago";
import { executeCommand } from "@/server/repository";
import { claimPaymentEvent } from "@/server/secrets";
import { reportError } from "@/server/monitor";

export const dynamic = "force-dynamic";

/**
 * Notificación de Mercado Pago. Es la ÚNICA vía por la que una seña online pasa a "abonada".
 *
 * Nada de lo que llega en el cuerpo se cree: del webhook solo se toma el id del pago, y los
 * datos reales (estado, monto, turno) se consultan contra la API con el access token del local.
 *
 * La barbería llega en la query porque la puso `notification_url` al crear la preferencia, y
 * después se verifica contra el `external_reference` del pago: una notificación que apunte a
 * una barbería y traiga un pago de otra se descarta.
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
      data?: { id?: string };
    };

    const topic = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
    const paymentId = body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");
    const shopId = url.searchParams.get("shop");
    if (topic !== "payment" || !paymentId || !shopId) return Response.json({ ok: true });

    // Firma HMAC: sin esto, cualquiera podría acreditar señas con un POST.
    if (!(await verifyWebhookSignature(request.headers, String(paymentId), shopId))) {
      console.warn("Webhook de Mercado Pago con firma inválida", paymentId);
      return Response.json({ ok: true });
    }

    const payment = await getPayment(shopId, String(paymentId));
    const reference = parseExternalReference(payment.externalReference);
    if (!reference || payment.status !== "approved") return Response.json({ ok: true });

    // El pago tiene que pertenecer a la barbería que firmó la notificación.
    if (reference.shopId !== shopId) {
      console.warn("Webhook con pago de otra barbería", { shopId, reference: reference.shopId });
      return Response.json({ ok: true });
    }

    // Mercado Pago reintenta la misma notificación: se aplica una sola vez.
    if (!(await claimPaymentEvent(payment.id, shopId, reference.appointmentId, payment.status))) {
      return Response.json({ ok: true });
    }

    await executeCommand(
      { role: "sistema", shopId },
      { type: "appointment.deposit", id: reference.appointmentId, method: "mercadopago", reference: payment.id },
    );
    return Response.json({ ok: true });
  } catch (error) {
    // Se responde 200 igual (si no, Mercado Pago reintenta en loop), pero se avisa: es una seña
    // cobrada que puede no haberse acreditado.
    await reportError("mercadopago.webhook", error);
    return Response.json({ ok: true });
  }
}
