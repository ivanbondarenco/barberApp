import { z } from "zod";
import { guestAppointment, guestCheckout } from "@/server/guest";
import { errorResponse, json, publicBaseUrl, readBody } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({ turno: z.string().min(1), t: z.string().min(1) });

/** Reintenta el pago de la seña de una reserva sin cuenta. El monto sale del turno, no del pedido. */
export async function POST(request: Request) {
  try {
    const { turno, t } = await readBody(request, schema);
    const { shopId, appointment, info } = await guestAppointment(turno, t);
    const initPoint = await guestCheckout(shopId, appointment, info, publicBaseUrl(request), t);
    return json({ initPoint });
  } catch (error) {
    return errorResponse(error);
  }
}
