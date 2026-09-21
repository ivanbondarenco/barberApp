import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { errorResponse, json, readBody } from "@/server/http";
import { getSecret, setSecret } from "@/server/secrets";
import { DEFAULT_OTP_LANGUAGE, DEFAULT_OTP_TEMPLATE } from "@/server/whatsapp";

export const dynamic = "force-dynamic";

const schema = z.object({
  accessToken: z.string().trim().optional(),
  phoneNumberId: z.string().trim().optional(),
  template: z.string().trim().optional(),
  language: z.string().trim().optional(),
});

/** Últimos 4 caracteres: alcanza para reconocer la credencial sin volver a mostrarla. */
const mask = (value?: string) => (value ? `••••${value.slice(-4)}` : "");

/** Estado de la integración con WhatsApp. Nunca devuelve el token completo. */
export async function GET() {
  try {
    const current = await getCurrentUser();
    if (current?.actor.role !== "admin") return json({ error: "Acción reservada al dueño del local" }, 403);
    const shopId = current.actor.shopId;
    const [accessToken, phoneNumberId, template, language] = await Promise.all([
      getSecret("wa_access_token", shopId),
      getSecret("wa_phone_number_id", shopId),
      getSecret("wa_template", shopId),
      getSecret("wa_language", shopId),
    ]);
    return json({
      accessToken: mask(accessToken),
      // El id del número no es secreto: se muestra entero para poder verificarlo.
      phoneNumberId: phoneNumberId ?? "",
      template: template || DEFAULT_OTP_TEMPLATE,
      language: language || DEFAULT_OTP_LANGUAGE,
      ready: !!(accessToken && phoneNumberId),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Guarda las credenciales de WhatsApp del local. Un campo vacío borra esa credencial. */
export async function POST(request: Request) {
  try {
    const current = await getCurrentUser();
    if (current?.actor.role !== "admin") return json({ error: "Acción reservada al dueño del local" }, 403);
    const shopId = current.actor.shopId;
    const body = await readBody(request, schema);
    if (body.accessToken !== undefined) await setSecret("wa_access_token", body.accessToken, shopId);
    if (body.phoneNumberId !== undefined) await setSecret("wa_phone_number_id", body.phoneNumberId, shopId);
    if (body.template !== undefined) await setSecret("wa_template", body.template, shopId);
    if (body.language !== undefined) await setSecret("wa_language", body.language, shopId);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
