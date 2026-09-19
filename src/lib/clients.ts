import { dateTime } from "./dates";
import { appointmentTotals } from "./pricing";
import type { Appointment, ClientProfile } from "./types";

export interface ClientSummary {
  profile: ClientProfile;
  appointments: Appointment[];
  visits: number;
  cancelled: number;
  totalSpent: number;
  averageTicket: number;
  lastVisit?: Appointment;
  nextAppointment?: Appointment;
}

const ts = (a: Appointment) => dateTime(a.date, a.time).getTime();

export function summarizeClient(profile: ClientProfile, appointments: Appointment[], now = Date.now()): ClientSummary {
  const mine = appointments.filter((a) => a.clientId === profile.id).sort((a, b) => ts(b) - ts(a));
  const completed = mine.filter((a) => a.status === "completado");
  const totalSpent = completed.reduce((sum, a) => sum + appointmentTotals(a).grandTotal, 0);
  const upcoming = mine
    .filter((a) => a.status === "confirmado" && ts(a) + a.durationMin * 60_000 > now)
    .sort((a, b) => ts(a) - ts(b));
  return {
    profile,
    appointments: mine,
    visits: completed.length,
    cancelled: mine.filter((a) => a.status === "cancelado").length,
    totalSpent,
    averageTicket: completed.length ? Math.round(totalSpent / completed.length) : 0,
    lastVisit: completed[0],
    nextAppointment: upcoming[0],
  };
}

/** CRM: fichas de clientes con métricas, ordenadas por próximo turno y nombre. */
export function buildClients(clients: ClientProfile[], appointments: Appointment[], now = Date.now()): ClientSummary[] {
  return clients
    .map((c) => summarizeClient(c, appointments, now))
    .sort((a, b) => {
      const an = a.nextAppointment ? ts(a.nextAppointment) : Infinity;
      const bn = b.nextAppointment ? ts(b.nextAppointment) : Infinity;
      return an - bn || a.profile.name.localeCompare(b.profile.name);
    });
}
