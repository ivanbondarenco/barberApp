import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { errorResponse, json, readBody } from "@/server/http";
import { getSecret, setSecret } from "@/server/secrets";

export const dynamic = "force-dynamic";

const schema = z.object({
  accessToken: z.string().trim().optional(),
  publicKey: z.string().trim().optional(),
  webhookSecret: z.string().trim().optional(),
});

/** Últimos 4 caracteres: alcanza para reconocer la credencial sin volver a mostrarla. */
const mask = (value?: string) => (value ? `••••${value.slice(-4)}` : "");

/** Estado de la integración. Nunca devuelve las credenciales completas. */
export async function GET() {
  try {
    const current = await getCurrentUser();
    if (current?.actor.role !== "admin") return json({ error: "Acción reservada al dueño del local" }, 403);
    const shopId = current.actor.shopId;
    const [accessToken, publicKey, webhookSecret] = await Promise.all([
      getSecret("mp_access_token", shopId),
      getSecret("mp_public_key", shopId),
      getSecret("mp_webhook_secret", shopId),
    ]);
    return json({
      accessToken: mask(accessToken),
      publicKey: mask(publicKey),
      webhookSecret: mask(webhookSecret),
      ready: !!accessToken,
      // Sin este secreto el webhook no puede validar firmas y rechaza todo por seguridad.
      canReceiveWebhooks: !!webhookSecret,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Guarda las credenciales de Mercado Pago del local. Un campo vacío borra esa credencial. */
export async function POST(request: Request) {
  try {
    const current = await getCurrentUser();
    if (current?.actor.role !== "admin") return json({ error: "Acción reservada al dueño del local" }, 403);
    const shopId = current.actor.shopId;
    const body = await readBody(request, schema);
    if (body.accessToken !== undefined) await setSecret("mp_access_token", body.accessToken, shopId);
    if (body.publicKey !== undefined) await setSecret("mp_public_key", body.publicKey, shopId);
    if (body.webhookSecret !== undefined) await setSecret("mp_webhook_secret", body.webhookSecret, shopId);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
