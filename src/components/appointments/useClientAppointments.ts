"use client";

import { useMemo } from "react";
import { dateTime } from "@/lib/dates";
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
