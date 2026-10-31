import type { DomainState } from "./commands";
import { shortDate } from "./dates";
import { pendingReminders } from "./reminders";
import type { Role } from "./types";

/**
 * Notificaciones del panel: lo que pasó con los turnos y lo que falta configurar.
 *
 * Se derivan del estado, como los recordatorios: no hay tabla de avisos que se pueda
 * desincronizar. Lo "leído" es por dispositivo (la última vez que se abrió la campana).
 */

export type NotificationKind = "reserva" | "cancelacion" | "vencida" | "reprogramacion" | "transferencia" | "recordatorios";

export interface ActivityItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** ISO: cuándo pasó. Ordena la lista y decide si es nueva. */
  at: string;
  href: string;
}

export interface SetupTask {
  id: "mercadopago" | "whatsapp" | "servicios";
  title: string;
  body: string;
  href: string;
}

/** Hasta cuántos días atrás se muestra la actividad. */
const ACTIVITY_DAYS = 7;
const MAX_ITEMS = 40;

const when = (date: string, time: string) => `${shortDate(date)} ${time}`;

export function staffActivity(
  state: Pick<DomainState, "appointments" | "clients">,
  viewer: { role: Role; barberId?: string },
  now = new Date(),
): ActivityItem[] {
  const since = new Date(now.getTime() - ACTIVITY_DAYS * 86_400_000).toISOString();
  // El barbero ve lo de su sillón; los turnos de los demás le llegan anónimos.
  const mine = state.appointments.filter((a) => viewer.role === "admin" || a.barberId === viewer.barberId);
  const items: ActivityItem[] = [];

  for (const a of mine) {
    const href = `/admin/turno/${a.id}`;
    if (a.source === "app" && a.createdAt >= since) {
      items.push({
        id: `${a.id}:reserva`,
        kind: "reserva",
        title: "Nuevo turno",
        body: `${a.clientName} · ${a.serviceName} · ${when(a.date, a.time)}`,
        at: a.createdAt,
        href,
      });
    }
    if (a.rescheduledFrom && a.rescheduledFrom.at >= since) {
      items.push({
        id: `${a.id}:reprogramacion:${a.rescheduledFrom.at}`,
        kind: "reprogramacion",
        title: "Turno reprogramado",
        body: `${a.clientName}: ${when(a.rescheduledFrom.date, a.rescheduledFrom.time)} → ${when(a.date, a.time)}`,
        at: a.rescheduledFrom.at,
        href,
      });
    }
    if (a.status === "cancelado" && a.cancelledAt && a.cancelledAt >= since) {
      items.push({
        id: `${a.id}:cancelacion`,
        kind: a.holdExpired ? "vencida" : "cancelacion",
        title: a.holdExpired ? "Reserva vencida sin pagar" : "Turno cancelado",
        body: `${a.clientName} · ${when(a.date, a.time)}`,
        at: a.cancelledAt,
        href,
      });
    }
    // Una transferencia por revisar sigue en la lista hasta que alguien la confirme.
    if (a.deposit.status === "en_revision" && a.status === "confirmado") {
      items.push({
        id: `${a.id}:transferencia`,
        kind: "transferencia",
        title: "Transferencia para revisar",
        body: `${a.clientName} avisó que transfirió la seña`,
        at: a.deposit.declaredAt ?? a.createdAt,
        href,
      });
    }
  }

  const reminders = pendingReminders(mine, state.clients, now);
  if (reminders.length) {
    items.push({
      id: `recordatorios:${reminders.map((r) => r.appointment.id).join(",")}`,
      kind: "recordatorios",
      title: reminders.length === 1 ? "1 recordatorio para enviar" : `${reminders.length} recordatorios para enviar`,
      body: "Avisales a tus clientes de su turno de mañana.",
      at: now.toISOString(),
      href: "/admin/recordatorios",
    });
  }

  return items.sort((x, y) => y.at.localeCompare(x.at)).slice(0, MAX_ITEMS);
}

/** Lo que el dueño todavía tiene que configurar para que la barbería funcione completa. */
export function setupTasks(state: Pick<DomainState, "integrations" | "services">, role: Role): SetupTask[] {
  if (role !== "admin") return [];
  const tasks: SetupTask[] = [];
  if (!state.services.some((s) => s.active)) {
    tasks.push({
      id: "servicios",
      title: "Cargá tus servicios",
      body: "Sin servicios tus clientes no pueden reservar.",
      href: "/admin/servicios",
    });
  }
  if (!state.integrations.mercadopagoReady) {
    tasks.push({
      id: "mercadopago",
      title: "Conectá Mercado Pago",
      body: "Para cobrar las señas online, directo a tu cuenta.",
      href: "/admin/configuracion?tab=integraciones",
    });
  }
  if (!state.integrations.whatsappReady) {
    tasks.push({
      id: "whatsapp",
      title: "Conectá WhatsApp",
      body: "Para mandar los códigos de verificación a tus clientes.",
      href: "/admin/configuracion?tab=integraciones",
    });
  }
  return tasks;
}

/** Cuántos avisos nuevos hay desde la última vez que se abrió la campana. */
export function unreadCount(activity: ActivityItem[], tasks: SetupTask[], lastSeen: string | null): number {
  const fresh = activity.filter((i) => !lastSeen || i.at > lastSeen || i.kind === "transferencia" || i.kind === "recordatorios");
  return fresh.length + tasks.length;
}
