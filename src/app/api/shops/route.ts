import { z } from "zod";
import { addressSchema, emailSchema, personNameSchema, shopNameSchema } from "@/lib/validation";
import { rememberShop, startSession } from "@/server/auth";
import { passwordSchema } from "@/lib/password";
import { arPhoneSchema } from "@/lib/phone";
import { errorResponse, json, readBody } from "@/server/http";
import { notifyShopCreated } from "@/server/notify";
import { createShop, listShops } from "@/server/repository";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: shopNameSchema,
  ownerName: personNameSchema,
  identifier: emailSchema,
  password: passwordSchema,
  address: addressSchema,
  whatsapp: arPhoneSchema,
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
      ownerPassword: input.password,
      address: input.address,
      whatsapp: input.whatsapp,
      neighborhood: input.neighborhood,
      email: input.email,
    });
    await rememberShop(shop.slug);
    await startSession(userId);
    notifyShopCreated({ name: input.ownerName, identifier: input.identifier }, shop.name, shop.slug);
    return json({ ok: true, shop });
  } catch (error) {
    return errorResponse(error);
  }
}
