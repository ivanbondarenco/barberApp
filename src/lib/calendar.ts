import { dateTime } from "./dates";
import type { Appointment, BusinessInfo } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

function icsStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

/** Descarga un .ics para agregar el turno al calendario del teléfono. */
export function downloadAppointmentIcs(appointment: Appointment, info: BusinessInfo): void {
  const start = dateTime(appointment.date, appointment.time);
  const end = new Date(start.getTime() + appointment.durationMin * 60_000);
  const reminder = new Date(start.getTime() - 3 * 3_600_000);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BarberApp//Turnos//ES",
    "BEGIN:VEVENT",
    `UID:${appointment.id}@barberapp`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${appointment.serviceName} · ${info.name}`,
    `LOCATION:${info.address}, ${info.neighborhood}`,
    `DESCRIPTION:Seña 50% ${appointment.deposit.status === "abonada" ? "abonada" : "pendiente"}. Cancelación sin cargo hasta ${pad(reminder.getHours())}:${pad(reminder.getMinutes())} hs.`,
    "BEGIN:VALARM",
    "TRIGGER:-PT3H",
    "ACTION:DISPLAY",
    `DESCRIPTION:Recordatorio de turno en ${info.name}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `turno-${appointment.date}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function mapsLink(info: BusinessInfo): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${info.address}, ${info.neighborhood}`)}`;
}

/** Código corto para check-in en recepción. */
export function checkInCode(appointmentId: string): string {
  let hash = 0;
  for (const ch of appointmentId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `DS-${hash.toString(36).toUpperCase().slice(-4).padStart(4, "0")}`;
}
