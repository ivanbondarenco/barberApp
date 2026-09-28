import "server-only";
import { longDate } from "@/lib/dates";
import { money } from "@/lib/format";
import { FREE_CANCELLATION_HOURS } from "@/lib/pricing";
import type { Appointment, BusinessInfo } from "@/lib/types";
import { appUrl } from "./mail";

/**
 * Los mails que manda la app, cada uno como una función que devuelve asunto y HTML.
 *
 * Van con estilos en línea y una sola columna: los clientes de correo ignoran las hojas de
 * estilo y muchos se leen desde el celular. El texto plano lo deriva `sendMail`.
 */
export interface Email {
  subject: string;
  html: string;
}

const NAVY = "#12203c";
const INK = "#1b2436";
const MUTED = "#5b6478";

/** Escapa lo que venga de la base: un nombre con `<` no puede romper el HTML del mail. */
function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function button(label: string, href: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:${NAVY};color:#ffffff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:12px">${esc(label)}</a>`;
}

/** Marco común: encabezado con el nombre del local y pie con el aviso de por qué le llega. */
function layout({ title, heading, body, footer }: { title: string; heading: string; body: string; footer?: string }): string {
  return `<div style="margin:0;padding:24px 12px;background:#eef1f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK}">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(18,32,60,.12)">
    <div style="background:${NAVY};padding:18px 24px;color:#ffffff;font-weight:700;letter-spacing:.02em">${esc(title)}</div>
    <div style="padding:24px">
      <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:${INK}">${esc(heading)}</h1>
      ${body}
    </div>
  </div>
  <p style="max-width:560px;margin:14px auto 0;font-size:12px;line-height:1.5;color:${MUTED};text-align:center">
    ${footer ?? "Recibís este mail porque tenés una cuenta en BarberApp."}
  </p>
</div>`;
}

const p = (text: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${INK}">${text}</p>`;
const small = (text: string) => `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${MUTED}">${text}</p>`;

/** Ficha del turno: lo que el cliente necesita mirar de un vistazo. */
function appointmentCard(appointment: Appointment, info: Pick<BusinessInfo, "name" | "address">): string {
  const rows: [string, string][] = [
    ["Cuándo", `${longDate(appointment.date)} · ${appointment.time} hs`],
    ["Servicio", appointment.serviceName],
    ["Precio", money(appointment.servicePrice)],
  ];
  if (info.address) rows.push(["Dónde", info.address]);
  return `<table style="width:100%;border-collapse:collapse;margin:4px 0 8px;background:#f5f7fb;border-radius:14px">
    ${rows
      .map(
        ([label, value]) => `<tr>
      <td style="padding:10px 14px;font-size:13px;color:${MUTED};white-space:nowrap">${esc(label)}</td>
      <td style="padding:10px 14px;font-size:15px;font-weight:600;color:${INK};text-align:right">${esc(value)}</td>
    </tr>`,
      )
      .join("")}
  </table>`;
}

const firstName = (name: string) => name.trim().split(" ")[0] || name;

// ───────── Cuenta ─────────

export function welcomeClientEmail(name: string, shopName?: string): Email {
  return {
    subject: "Tu cuenta ya está lista",
    html: layout({
      title: "BarberApp",
      heading: `¡Bienvenido, ${firstName(name)}!`,
      body:
        p(
          shopName
            ? `Ya podés reservar tus turnos en <strong>${esc(shopName)}</strong> desde la app.`
            : "Ya podés reservar tus turnos desde la app.",
        ) +
        p("Con esta misma cuenta te atendés en todas las barberías que quieras: sumalas desde <strong>Mis barberías</strong>.") +
        p(button("Reservar un turno", `${appUrl()}/cliente/reservar`)) +
        small("Si no creaste esta cuenta, ignorá este mail."),
    }),
  };
}

export function welcomeShopEmail(ownerName: string, shopName: string, shopSlug: string): Email {
  const link = `${appUrl()}/b/${shopSlug}`;
  return {
    subject: `${shopName} ya está publicada`,
    html: layout({
      title: shopName,
      heading: `¡Listo, ${firstName(ownerName)}!`,
      body:
        p(`<strong>${esc(shopName)}</strong> ya está creada en BarberApp, con un catálogo básico y vos como primer sillón.`) +
        p("Antes de compartirla, cargá tus servicios, tus horarios y tu equipo desde el panel.") +
        p(`Este es el link que les pasás a tus clientes para que reserven:<br><a href="${esc(link)}" style="color:${NAVY};font-weight:600">${esc(link)}</a>`) +
        p(button("Ir a mi agenda", `${appUrl()}/admin/agenda`)) +
        small("Recibís este mail porque registraste una barbería en BarberApp."),
    }),
  };
}

export function verifyEmailEmail(name: string, link: string): Email {
  return {
    subject: "Confirmá tu email",
    html: layout({
      title: "BarberApp",
      heading: "Confirmá tu email",
      body:
        p(`Hola ${esc(firstName(name))}, tocá el botón para confirmar que esta casilla es tuya.`) +
        p(button("Confirmar mi email", link)) +
        p(`<span style="font-size:13px;color:${MUTED}">Si el botón no funciona, copiá y pegá este link:<br>${esc(link)}</span>`) +
        small("El link vence en 48 horas. Si no creaste una cuenta, ignorá este mail."),
    }),
  };
}

export function passwordResetEmail(name: string, code: string): Email {
  return {
    subject: `${code} es tu código para recuperar la contraseña`,
    html: layout({
      title: "BarberApp",
      heading: "Recuperá tu contraseña",
      body:
        p(`Hola ${esc(firstName(name))}, este es tu código para elegir una contraseña nueva:`) +
        `<p style="margin:0 0 12px;font-size:34px;font-weight:700;letter-spacing:.22em;color:${NAVY}">${esc(code)}</p>` +
        p("Vence en 10 minutos y sirve una sola vez.") +
        small("Si no lo pediste, no hagas nada: tu contraseña sigue siendo la misma."),
    }),
  };
}

// ───────── Turnos ─────────

export function appointmentBookedEmail(appointment: Appointment, info: Pick<BusinessInfo, "name" | "address">): Email {
  const pending = appointment.deposit.status !== "abonada" && appointment.deposit.amount > 0;
  return {
    subject: `Turno reservado: ${longDate(appointment.date)} ${appointment.time} hs`,
    html: layout({
      title: info.name,
      heading: `Tu turno quedó reservado, ${firstName(appointment.clientName)}`,
      body:
        appointmentCard(appointment, info) +
        (pending
          ? p(`Queda pendiente la seña de <strong>${money(appointment.deposit.amount)}</strong>. Podés abonarla desde la app.`)
          : p("La seña ya está paga. Te esperamos.")) +
        p(button("Ver mi turno", `${appUrl()}/cliente/mis-turnos`)) +
        small(`Si no podés venir, avisá con tiempo: cancelás sin cargo hasta ${FREE_CANCELLATION_HOURS} horas antes.`),
    }),
  };
}

export function appointmentCancelledEmail(appointment: Appointment, info: Pick<BusinessInfo, "name" | "address">): Email {
  const credit = appointment.creditIssued ?? 0;
  return {
    subject: `Turno cancelado: ${longDate(appointment.date)} ${appointment.time} hs`,
    html: layout({
      title: info.name,
      heading: "Tu turno se canceló",
      body:
        appointmentCard(appointment, info) +
        (credit > 0
          ? p(`Te queda <strong>${money(credit)}</strong> de crédito a favor para tu próxima reserva.`)
          : p("Cuando quieras volver, reservás otro horario desde la app.")) +
        p(button("Reservar otro turno", `${appUrl()}/cliente/reservar`)),
    }),
  };
}

export function appointmentReminderEmail(appointment: Appointment, info: Pick<BusinessInfo, "name" | "address">): Email {
  const pending = appointment.deposit.status !== "abonada" && appointment.deposit.amount > 0;
  return {
    subject: `Te esperamos mañana a las ${appointment.time} hs`,
    html: layout({
      title: info.name,
      heading: `Recordá tu turno, ${firstName(appointment.clientName)}`,
      body:
        appointmentCard(appointment, info) +
        (pending ? p(`Te queda pendiente la seña de <strong>${money(appointment.deposit.amount)}</strong>.`) : "") +
        p(button("Ver mi turno", `${appUrl()}/cliente/mis-turnos`)) +
        small("Si no podés venir, avisanos así liberamos el horario."),
    }),
  };
}
