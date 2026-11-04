import { headers } from "next/headers";
import { z } from "zod";
import { DomainError } from "@/lib/commands";
import { uid } from "@/lib/format";
import { getAccount, visitorShop } from "@/server/auth";
import { assertGuestRate, guestAppointment, guestCheckout, guestResultPath, guestView, issueGuestToken } from "@/server/guest";
import { errorResponse, json, phoneSchema, publicBaseUrl, readBody } from "@/server/http";
import { reportError } from "@/server/monitor";
import { executeCommand, shopRow, ensureSeeded } from "@/server/repository";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre").max(80),
  phone: phoneSchema,
  barberId: z.string().min(1),
  serviceId: z.string().min(1),
  date: z.iso.date(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().max(160).optional(),
  // Sin cuenta: la seña se paga online o en el local. Con seña 0 se manda "efectivo" y no se cobra nada.
  depositMethod: z.enum(["mercadopago", "efectivo"]),
});

/**
 * Reserva sin cuenta desde el link del local (/b/<slug>): solo nombre y celular.
 *
 * Corre como actor `invitado`, que únicamente puede reservar y con las mismas reglas de seña
 * que un cliente. Devuelve el token para ver el turno y, si eligió Mercado Pago, el link al
 * checkout (API de Orders) con la vuelta a la pantalla del invitado.
 */
export async function POST(request: Request) {
  try {
    if (await getAccount()) throw new DomainError("Ya tenés sesión: reservá desde la app.", 409);
    const shop = await visitorShop();
    if (!shop) throw new DomainError("Abrí el link de la barbería para reservar", 400);
    const input = await readBody(request, schema);

    const h = await headers();
    assertGuestRate(h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local");

    const id = uid("a");
    const { state } = await executeCommand(
      { role: "invitado", shopId: shop.id },
      {
        type: "appointment.book",
        payload: {
          id,
          newClientId: uid("c"),
          clientName: input.name,
          clientPhone: input.phone,
          barberId: input.barberId,
          serviceId: input.serviceId,
          date: input.date,
          time: input.time,
          notes: input.notes,
          depositMethod: input.depositMethod,
        },
      },
    );
    const appointment = state.appointments.find((a) => a.id === id)!;
    const token = await issueGuestToken(shop.id, id);

    if (input.depositMethod === "mercadopago" && appointment.deposit.status !== "abonada") {
      try {
        const initPoint = await guestCheckout(shop.id, appointment, state.businessInfo, publicBaseUrl(request), token);
        return json({ id, token, initPoint });
      } catch (error) {
        // El turno ya quedó retenido: desde la pantalla de resultado puede reintentar el pago.
        if (!(error instanceof DomainError)) void reportError("reservas.checkout", error, { shopId: shop.id });
        return json({ id, token, next: guestResultPath("error", id, token) });
      }
    }

    const outcome = appointment.deposit.status === "abonada" ? "exito" : "pendiente";
    return json({ id, token, next: guestResultPath(outcome, id, token) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** El turno del invitado, para la pantalla de resultado. Pide el token que recibió al reservar. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const { shopId, appointment, info } = await guestAppointment(params.get("turno") ?? "", params.get("t") ?? "");
    const shop = shopRow(await ensureSeeded(), shopId) ?? null;
    return json(guestView(appointment, info, shop));
  } catch (error) {
    return errorResponse(error);
  }
}
