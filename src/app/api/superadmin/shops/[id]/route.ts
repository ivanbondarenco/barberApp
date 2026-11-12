import { z } from "zod";
import { getAccount } from "@/server/auth";
import { currentPrice, extendTrial, isSuperadmin, listShopsForSuperadmin, recordPayment } from "@/server/billing";
import { errorResponse, json, readBody } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  // Pago a mano (transferencia o efectivo). Sin monto, se toma el precio actual por los meses.
  z.object({
    action: z.literal("payment"),
    months: z.number().int().min(1, "Mínimo 1 mes").max(24, "Máximo 24 meses"),
    method: z.enum(["transferencia", "efectivo"]),
    amount: z.number().int().min(0).max(100_000_000).optional(),
    note: z.string().trim().max(200).optional(),
  }),
  z.object({
    action: z.literal("trial"),
    days: z.number().int().min(1, "Mínimo 1 día").max(365, "Máximo 365 días"),
  }),
]);

/** Acciones del superadmin sobre una barbería: registrar un pago a mano o prorrogar la prueba. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await getAccount();
    if (!account) return json({ error: "Tu sesión expiró. Volvé a ingresar." }, 401);
    if (!isSuperadmin(account.user.identifier)) return json({ error: "No encontrado" }, 404);
    const { id } = await params;
    const input = await readBody(request, schema);

    if (input.action === "payment") {
      await recordPayment(id, {
        months: input.months,
        method: input.method,
        amount: input.amount ?? (await currentPrice(id)) * input.months,
        note: input.note,
        createdBy: account.user.identifier,
      });
    } else {
      await extendTrial(id, input.days);
    }
    return json({ shops: await listShopsForSuperadmin() });
  } catch (error) {
    return errorResponse(error);
  }
}
