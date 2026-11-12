/**
 * Cola de recordatorios previos al turno.
 *
 * Es una función pura sobre el estado: no hay tabla de "pendientes" que se pueda desincronizar.
 * Hoy el staff los manda con un toque por WhatsApp (`wa.me`) y el turno queda marcado.
 * Cuando haya WhatsApp Cloud API, el mismo cálculo alimenta al worker que los envía solo.
 */
import { money } from "./format";
import { addDays, hoursUntil, longDate, toISODate } from "./dates";
import { appointmentTotals, REMINDER_LEAD_HOURS } from "./pricing";
import type { Appointment, BusinessInfo, ClientProfile } from "./types";

export interface PendingReminder {
  appointment: Appointment;
  /** Horas que faltan para el turno (sirve para ordenar por urgencia). */
  hoursLeft: number;
  /** La seña todavía no entró: conviene recordarlo en el mismo mensaje. */
  depositPending: boolean;
}

/** ¿Este turno necesita que se le avise al cliente? */
export function needsReminder(appointment: Appointment, clients: ClientProfile[], now = new Date()): boolean {
  if (appointment.status !== "confirmado") return false;
  if (appointment.reminderSentAt) return false;
  // Una reserva que todavía retiene el horario sin pagar no se recuerda: puede liberarse sola.
  if (appointment.holdUntil) return false;
  // Turno cargado sin celular (cliente sin app): no hay a dónde escribirle.
  if (!appointment.clientPhone.trim()) return false;

  const left = hoursUntil(appointment.date, appointment.time, now);
  if (left <= 0 || left > REMINDER_LEAD_HOURS) return false;

  // Los turnos manuales de gente sin ficha se avisan igual; quien tiene ficha manda su preferencia.
  const client = clients.find((c) => c.id === appointment.clientId);
  return client ? client.notifications.reminder24h : true;
}

/** Turnos a avisar, del más urgente al menos. */
export function pendingReminders(
  appointments: Appointment[],
  clients: ClientProfile[],
  now = new Date(),
): PendingReminder[] {
  return appointments
    .filter((a) => needsReminder(a, clients, now))
    .map((a) => ({
      appointment: a,
      hoursLeft: hoursUntil(a.date, a.time, now),
      depositPending: a.deposit.status !== "abonada",
    }))
    .sort((a, b) => a.hoursLeft - b.hoursLeft);
}

/** Texto del recordatorio, listo para abrir en WhatsApp. */
export function reminderMessage(reminder: PendingReminder, info: Pick<BusinessInfo, "name" | "address">): string {
  const { appointment: a, depositPending } = reminder;
  const firstName = a.clientName.split(" ")[0];
  const lines = [
    `Hola ${firstName}! Te recordamos tu turno en ${info.name}.`,
    `${longDate(a.date)} a las ${a.time} hs — ${a.serviceName}.`,
    info.address ? `Te esperamos en ${info.address}.` : "",
    depositPending ? "Te queda pendiente la seña del 50%: podés abonarla desde la app o al llegar." : "",
    "Si no podés venir, avisanos así liberamos el horario. ¡Gracias!",
  ];
  return lines.filter(Boolean).join("\n");
}

/** "mañana", "hoy" o nada si falta más (el día igual va en su renglón). */
function dayWord(date: string, now: Date): string {
  const today = toISODate(now);
  if (date === today) return "hoy";
  if (date === addDays(today, 1)) return "mañana";
  return "";
}

/** Cómo quedó la plata del turno: cuánto pagó de seña y cuánto le falta. */
function paymentLines(a: Appointment): string[] {
  const t = appointmentTotals(a);
  if (a.deposit.status === "abonada" && t.depositPaid > 0) {
    return t.dueAtChair > 0
      ? [`✅ Seña abonada: *${money(t.depositPaid)}*`, `💵 Saldo a pagar en el local: *${money(t.dueAtChair)}*`]
      : [`✅ Pagaste *${money(t.depositPaid)}*: no te queda nada por pagar`];
  }
  if (a.deposit.status === "en_revision") {
    return [
      `🔎 Seña en revisión: *${money(t.deposit)}*`,
      `💵 Saldo a pagar en el local: *${money(t.dueAtChair - t.deposit)}*`,
    ];
  }
  if (t.deposit > 0) {
    return [
      `⏳ Seña pendiente: *${money(t.deposit)}*`,
      "_Podés abonarla desde la app o al llegar._",
      `💵 Total del turno: *${money(t.grandTotal)}*`,
    ];
  }
  return [`💵 Total a pagar en el local: *${money(t.dueAtChair)}*`];
}

/** Nombre del perfil de WhatsApp del número que manda los avisos (el que conviene agendar). */
export const WHATSAPP_SENDER_NAME = "Mi Barberia";

/**
 * Recordatorio automático por WhatsApp. Sale de un número único de BarberApp, así que dice
 * de qué local es y aclara que es automático (nadie lee las respuestas). Usa el formato de
 * WhatsApp: *negrita* y _cursiva_.
 */
export function whatsappReminderText(
  reminder: PendingReminder,
  info: Pick<BusinessInfo, "name" | "address">,
  barberName: string | undefined,
  { link, now = new Date() }: { link?: string; now?: Date } = {},
): string {
  const a = reminder.appointment;
  const firstName = a.clientName.split(" ")[0];
  const when = dayWord(a.date, now);
  const sections = [
    ["💈 *Recordatorio de turno*"],
    [`Hola *${firstName}*! 👋`, `Te esperamos ${when ? `*${when}* ` : ""}en *${info.name}*.`],
    [
      `📅 *${longDate(a.date)}*`,
      `🕐 *${a.time} hs*`,
      `✂️ ${a.serviceName}`,
      barberName ? `💇‍♂️ Con *${barberName.split(" ")[0]}*` : "",
      info.address ? `📍 ${info.address}` : "",
    ],
    ["💰 *Pago*", ...paymentLines(a)],
    ["❌ ¿No podés venir? Cancelalo desde la app así liberamos el horario."],
    // Quien no tiene el número agendado ve solo el número: agendarlo es lo que muestra el nombre.
    [`📲 Agendanos como *${WHATSAPP_SENDER_NAME}* para reconocer tus avisos.`],
    [`_Mensaje automático de ${WHATSAPP_SENDER_NAME}. Este número no lee respuestas._`],
    [link ? `🌐 ${link}` : ""],
  ];
  return sections
    .map((lines) => lines.filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");
}
