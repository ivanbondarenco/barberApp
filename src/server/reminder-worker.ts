import "server-only";
import { pendingReminders, whatsappReminderText, type PendingReminder } from "@/lib/reminders";
import { appUrl } from "./mail";
import { reportError } from "./monitor";
import { executeCommand, listShops, loadState } from "./repository";
import { evolutionConfig, sendWhatsappText } from "./wa-notify";

/**
 * Recordatorios automáticos por WhatsApp, el día anterior al turno.
 *
 * Cada pocos minutos recorre las barberías y manda los que `pendingReminders` marca como
 * pendientes (los mismos que el staff ve en /admin/recordatorios). Al salir, el turno queda
 * marcado con `reminderSentAt` vía comando: así no se repite, desaparece de la cola manual y,
 * de paso, sale el recordatorio por mail.
 */

const EVERY_MS = 10 * 60_000;
const FIRST_RUN_MS = 60_000;
/** Solo de día, en hora argentina: nadie quiere un aviso de turno a las 3 de la mañana. */
const SEND_FROM_HOUR = 9;
const SEND_UNTIL_HOUR = 21;
/** Un turno recién reservado no necesita recordatorio: la reserva se acaba de confirmar. */
const FRESH_BOOKING_MS = 2 * 3_600_000;

/** Hora en Argentina, sin depender de la zona horaria del servidor (el contenedor corre en UTC). */
export function argentinaHour(now: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  return Number(hour);
}

export function inSendingHours(now: Date): boolean {
  const hour = argentinaHour(now);
  return hour >= SEND_FROM_HOUR && hour < SEND_UNTIL_HOUR;
}

/** Se descartan las reservas hechas hace menos de 2 h. */
export function dueForWhatsapp(reminder: PendingReminder, now: Date): boolean {
  const created = Date.parse(reminder.appointment.createdAt);
  return Number.isNaN(created) || now.getTime() - created >= FRESH_BOOKING_MS;
}

let running = false;

/** Una pasada por todas las barberías. Devuelve cuántos recordatorios salieron. */
export async function runReminderSweep(now = new Date()): Promise<number> {
  if (running || !evolutionConfig() || !inSendingHours(now)) return 0;
  running = true;
  let sent = 0;
  try {
    for (const shop of await listShops()) {
      const { state } = await loadState(shop.id);
      const due = pendingReminders(state.appointments, state.clients, now).filter((r) => dueForWhatsapp(r, now));
      for (const reminder of due) {
        const a = reminder.appointment;
        const barber = state.barbers.find((b) => b.id === a.barberId);
        const text = whatsappReminderText(reminder, state.businessInfo, barber?.name, { link: appUrl(), now });
        if (!(await sendWhatsappText(a.clientPhone, text))) continue;
        try {
          await executeCommand({ role: "sistema", shopId: shop.id }, { type: "appointment.reminderSent", id: a.id });
          sent++;
        } catch (error) {
          // El turno pudo cancelarse justo mientras salía el mensaje: no es grave.
          await reportError("reminder-worker", error, { shopId: shop.id, appointmentId: a.id });
        }
      }
    }
  } catch (error) {
    await reportError("reminder-worker", error);
  } finally {
    running = false;
  }
  return sent;
}

/** Arranca el ciclo una sola vez por proceso (en dev, Next recarga módulos: se guarda en global). */
export function startReminderWorker(): void {
  const g = globalThis as { __barberReminderWorker?: boolean };
  if (g.__barberReminderWorker || !evolutionConfig()) return;
  g.__barberReminderWorker = true;
  const tick = () => void runReminderSweep();
  setTimeout(tick, FIRST_RUN_MS);
  setInterval(tick, EVERY_MS).unref?.();
}
