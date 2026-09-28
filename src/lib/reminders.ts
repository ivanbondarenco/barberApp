/**
 * Cola de recordatorios previos al turno.
 *
 * Es una función pura sobre el estado: no hay tabla de "pendientes" que se pueda desincronizar.
 * Hoy el staff los manda con un toque por WhatsApp (`wa.me`) y el turno queda marcado.
 * Cuando haya WhatsApp Cloud API, el mismo cálculo alimenta al worker que los envía solo.
 */
import { hoursUntil, longDate } from "./dates";
import { REMINDER_LEAD_HOURS } from "./pricing";
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
