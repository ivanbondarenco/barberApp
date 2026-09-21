import "server-only";
import { DomainError } from "@/lib/commands";
import { onlyDigits } from "@/lib/format";
import { getSecret } from "./secrets";

const API = "https://graph.facebook.com/v21.0";

/** Plantilla por defecto: una plantilla de autenticación con el código como único parámetro. */
export const DEFAULT_OTP_TEMPLATE = "otp_code";
export const DEFAULT_OTP_LANGUAGE = "es_AR";

/** ¿Esta barbería puede mandar códigos por WhatsApp? */
export async function whatsappReady(shopId: string): Promise<boolean> {
  const [token, phoneId] = await Promise.all([
    getSecret("wa_access_token", shopId),
    getSecret("wa_phone_number_id", shopId),
  ]);
  return !!(token && phoneId);
}

/**
 * Manda el código por WhatsApp Cloud API.
 *
 * Meta solo permite texto libre dentro de la ventana de 24 h de atención, así que para un
 * código hay que usar una plantilla de autenticación aprobada. El nombre y el idioma se
 * configuran por barbería porque cada cuenta de Meta aprueba las suyas.
 */
export async function sendOtp(shopId: string, phone: string, code: string): Promise<void> {
  const [token, phoneId, template, language] = await Promise.all([
    getSecret("wa_access_token", shopId),
    getSecret("wa_phone_number_id", shopId),
    getSecret("wa_template", shopId),
    getSecret("wa_language", shopId),
  ]);
  if (!token || !phoneId) throw new DomainError("Esta barbería todavía no configuró WhatsApp", 503);

  const res = await fetch(`${API}/${encodeURIComponent(phoneId)}/messages`, {
    method: "POST",
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: onlyDigits(phone),
      type: "template",
      template: {
        name: template || DEFAULT_OTP_TEMPLATE,
        language: { code: language || DEFAULT_OTP_LANGUAGE },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          // Las plantillas de autenticación de Meta llevan un botón que copia el código.
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ],
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`WhatsApp Cloud API → ${res.status}`, detail.slice(0, 500));
    throw new DomainError("No pudimos enviarte el código. Probá de nuevo en un momento.", 502);
  }
}
