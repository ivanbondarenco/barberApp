import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Envío de mails por SMTP.
 *
 * A diferencia de Mercado Pago y WhatsApp, el SMTP es uno solo para toda la instalación
 * (variables de entorno): los mails de cuenta —bienvenida, verificar el email, recuperar la
 * contraseña— no son de ninguna barbería en particular, porque la cuenta del cliente sirve
 * para todas. En los mails de turnos el remitente lleva el nombre del local y se responde a
 * su casilla, así el cliente contesta al lugar donde se atiende.
 *
 * Sin SMTP configurado la app funciona igual: nada de esto es obligatorio para reservar.
 */
const config = () => ({
  host: process.env.SMTP_HOST?.trim(),
  port: Number(process.env.SMTP_PORT) || 587,
  user: process.env.SMTP_USER?.trim(),
  password: process.env.SMTP_PASSWORD,
  // El 465 es TLS desde el saludo; 587 y 25 arrancan en claro y suben con STARTTLS.
  secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "1" : Number(process.env.SMTP_PORT) === 465,
  from: process.env.MAIL_FROM?.trim() || process.env.SMTP_USER?.trim(),
});

/** ¿Hay SMTP configurado? Sin esto no se manda nada y la app sigue andando. */
export function mailReady(): boolean {
  const { host, from } = config();
  return !!(host && from);
}

/** Dirección pública de la app, para los links de los mails. */
export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

const globalForMail = globalThis as unknown as { __dsMailer?: Transporter };

function transporter(): Transporter {
  const { host, port, user, password, secure } = config();
  globalForMail.__dsMailer ??= nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass: password } : undefined,
    // Un SMTP lento no puede dejar colgado un registro ni una reserva.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return globalForMail.__dsMailer;
}

export interface Mail {
  to: string;
  subject: string;
  /** Cuerpo en HTML. El texto plano se deriva de este. */
  html: string;
  /** Nombre que se muestra como remitente (el del local, en los mails de turnos). */
  fromName?: string;
  /** Casilla a la que contesta el cliente, normalmente la de la barbería. */
  replyTo?: string;
}

/** Versión en texto plano, para los clientes de correo que no muestran HTML. */
function toPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(p|div|tr|h1|h2|h3|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/**
 * Manda un mail. Nunca lanza: un problema del servidor de correo no puede voltear un registro
 * ni una reserva. Devuelve si se envió, para el que quiera avisarlo en pantalla.
 */
export async function sendMail({ to, subject, html, fromName, replyTo }: Mail): Promise<boolean> {
  const { from } = config();
  if (!mailReady() || !from) {
    console.warn(`[mail] sin SMTP configurado: no se envió "${subject}" a ${to}`);
    return false;
  }
  try {
    await transporter().sendMail({
      // El remitente es siempre la casilla de la plataforma (si no, el correo rebota por SPF);
      // lo que cambia es el nombre visible y el "responder a".
      from: fromName ? { name: fromName, address: from.replace(/^.*<|>$/g, "") } : from,
      to,
      replyTo,
      subject,
      html,
      text: toPlainText(html),
    });
    return true;
  } catch (error) {
    console.error(`[mail] falló el envío de "${subject}" a ${to}:`, error);
    return false;
  }
}
