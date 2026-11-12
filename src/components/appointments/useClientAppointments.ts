"use client";

import { useMemo } from "react";
import { dateTime, dayNumber, dayShort, toISODate, todayISO } from "@/lib/dates";
import { CASH_DEPOSIT_DEADLINE_HOURS, FREE_CANCELLATION_HOURS } from "@/lib/pricing";
import type { BookingRules } from "@/lib/types";
import { cashDepositDeadline } from "@/lib/schedule";
import type { Appointment, BusinessHours } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

/** Turnos próximos del cliente logueado, ordenados por fecha. */
export function useClientAppointments() {
  const clientId = useAppStore((s) => s.session?.clientId);
  const appointments = useAppStore((s) => s.appointments);

  return useMemo(() => {
    const now = Date.now();
    const upcoming = appointments
      .filter(
        (a) =>
          a.clientId === clientId &&
          a.status === "confirmado" &&
          dateTime(a.date, a.time).getTime() + a.durationMin * 60_000 > now,
      )
      .sort((a, b) => dateTime(a.date, a.time).getTime() - dateTime(b.date, b.time).getTime());
    return { upcoming, next: upcoming[0] };
  }, [appointments, clientId]);
}

/** La seña todavía no entró ni está en revisión: al cliente le toca pagarla. */
export function depositDue(a: Appointment): boolean {
  return a.status === "confirmado" && a.deposit.status === "pendiente" && a.deposit.amount > 0;
}

/**
 * Hasta cuándo tiene el cliente para pagar la seña. Una reserva digital retiene el horario unos
 * minutos (`holdUntil`); la seña en efectivo vence unas horas antes, ajustada al horario del local.
 * Las demás no tienen un límite propio que mostrar.
 */
export function depositDeadline(a: Appointment, hours?: BusinessHours, rules?: Pick<BookingRules, "cashDeadlineHours">): Date | null {
  if (!depositDue(a)) return null;
  if (a.holdUntil) return new Date(a.holdUntil);
  if (a.deposit.method === "efectivo") return cashDepositDeadline(a.date, a.time, hours, rules?.cashDeadlineHours ?? CASH_DEPOSIT_DEADLINE_HOURS);
  return null;
}

/** "hoy a las 18:30 hs" / "vie 14 a las 18:30 hs". */
export function formatDeadline(d: Date): string {
  const iso = toISODate(d);
  const time = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${iso === todayISO() ? "hoy" : `${dayShort(iso)} ${dayNumber(iso)}`} a las ${time} hs`;
}

/** Cuánto falta hasta un momento, en palabras cortas: "2 días", "5 h", "40 min". */
export function timeLeft(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} días`;
}

/** Hasta cuándo se puede reprogramar o cancelar sin perder la seña. */
export function freeChangeUntil(a: Appointment, cancelHours = FREE_CANCELLATION_HOURS): Date {
  return new Date(dateTime(a.date, a.time).getTime() - cancelHours * 3_600_000);
}
