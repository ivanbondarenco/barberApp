import { z } from "zod";
import { rememberShop, startSession } from "@/server/auth";
import { errorResponse, json, pinSchema, readBody } from "@/server/http";
import { createShop, listShops } from "@/server/repository";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(3, "Ingresá el nombre de la barbería"),
  ownerName: z.string().trim().min(3, "Ingresá tu nombre"),
  identifier: z.string().trim().min(3, "Ingresá tu celular o email"),
  pin: pinSchema,
  address: z.string().trim().min(3, "Ingresá la dirección del local"),
  whatsapp: z.string().trim().refine((v) => v.replace(/\D/g, "").length >= 10, "Celular inválido"),
  neighborhood: z.string().trim().optional(),
  email: z.union([z.literal(""), z.email("Email inválido")]).optional(),
});

/** Barberías publicadas: alcanza para elegir una, no expone nada de adentro. */
export async function GET() {
  try {
    return json({ shops: await listShops() });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Alta de una barbería. Crea el local con un catálogo mínimo y la cuenta de su dueño,
 * y deja la sesión abierta para que entre directo a su agenda.
 */
export async function POST(request: Request) {
  try {
    const input = await readBody(request, schema);
    const { shop, userId } = await createShop({
      name: input.name,
      ownerName: input.ownerName,
      ownerIdentifier: input.identifier,
      ownerPin: input.pin,
      address: input.address,
      whatsapp: input.whatsapp,
      neighborhood: input.neighborhood,
      email: input.email,
    });
    await rememberShop(shop.slug);
    await startSession(userId);
    return json({ ok: true, shop });
  } catch (error) {
    return errorResponse(error);
  }
}
