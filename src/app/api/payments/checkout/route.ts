import { z } from "zod";
import { DomainError } from "@/lib/commands";
import { getCurrentUser } from "@/server/auth";
import { errorResponse, json, publicBaseUrl, readBody } from "@/server/http";
import { createDepositOrder } from "@/server/mercadopago";
import { loadState } from "@/server/repository";

export const dynamic = "force-dynamic";

const schema = z.object({ appointmentId: z.string().min(1) });

/**
 * Abre el checkout de la seña y devuelve la URL de Mercado Pago a la que se manda al cliente.
 *
 * El monto y el turno salen del estado del servidor: el navegador solo dice QUÉ turno paga,
 * nunca cuánto ni si ya pagó. La acreditación llega después, por el webhook.
 */
export async function POST(request: Request) {
  try {
    const current = await getCurrentUser();
    if (!current) return json({ error: "Tu sesión expiró. Volvé a ingresar." }, 401);

    const shopId = current.actor.shopId;
    const { appointmentId } = await readBody(request, schema);
    const { state } = await loadState(shopId);
    const appointment = state.appointments.find((a) => a.id === appointmentId);
    if (!appointment) throw new DomainError("El turno no existe", 404);

    // Solo el dueño del turno (o el staff) puede iniciar su pago.
    if (current.actor.role === "cliente" && appointment.clientId !== current.actor.clientId)
      throw new DomainError("No tenés permiso sobre este turno", 403);
    if (appointment.status !== "confirmado") throw new DomainError("El turno no está activo");
    if (appointment.deposit.status === "abonada") throw new DomainError("La seña ya está abonada");

    // Datos del comprador para Mercado Pago (email obligatorio, el resto mejora la aprobación).
    const client = state.clients.find((c) => c.id === appointment.clientId);
    const paid = state.appointments
      .filter((a) => a.id !== appointment.id && a.clientId && a.clientId === appointment.clientId && a.deposit.status === "abonada")
      .sort((a, b) => (b.deposit.paidAt ?? b.date).localeCompare(a.deposit.paidAt ?? a.date));
    const order = await createDepositOrder(shopId, appointment, state.businessInfo, publicBaseUrl(request), undefined, {
      name: client?.name ?? appointment.clientName,
      email: client?.email,
      phone: client?.phone ?? appointment.clientPhone,
      registeredAt: client?.createdAt,
      lastPurchaseAt: paid[0] ? (paid[0].deposit.paidAt ?? paid[0].date) : undefined,
      firstPurchaseOnline: !paid.some((a) => a.deposit.method === "mercadopago"),
      authenticated: current.actor.role === "cliente",
    });
    return json({ initPoint: order.initPoint, orderId: order.id });
  } catch (error) {
    return errorResponse(error);
  }
}
