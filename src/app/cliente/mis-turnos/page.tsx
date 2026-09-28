"use client";

import * as m from "motion/react-m";
import { CalendarPlus, ChevronRight, History, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusChip } from "@/components/appointments/StatusChip";
import { useClientAppointments } from "@/components/appointments/useClientAppointments";
import { NAV, Page } from "@/components/motion/Page";
import { MonthCalendar } from "@/components/ui/MonthCalendar";
import { longDate, todayISO } from "@/lib/dates";
import { money } from "@/lib/format";
import { fadeUp, listItem } from "@/lib/motion";
import { appointmentTotals } from "@/lib/pricing";
import { CLIENT_BOOKING_DAYS, clientBookingLimit, openingHours } from "@/lib/schedule";
import type { Appointment } from "@/lib/types";
import { useAppStore, useCurrentClient } from "@/store/useAppStore";

const WEEKS_AHEAD = CLIENT_BOOKING_DAYS / 7;

export default function MisTurnosPage() {
  const barbers = useAppStore((s) => s.barbers);
  const appointments = useAppStore((s) => s.appointments);
  const hours = useAppStore((s) => s.businessHours);
  const client = useCurrentClient();
  const { next } = useClientAppointments();

  const today = todayISO();
  const limit = clientBookingLimit();
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(today);

  /** Mis turnos por día: es lo que marca el calendario y lo que se lista al elegir una fecha. */
  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      if (a.clientId !== client?.id || a.status === "cancelado") continue;
      map.set(a.date, [...(map.get(a.date) ?? []), a]);
    }
    for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [appointments, client?.id]);

  /** Días en los que el cliente puede reservar: local abierto y dentro de las dos semanas. */
  const bookable = (iso: string) => iso >= today && iso <= limit && !!openingHours(iso, hours);

  const dayAppointments = byDay.get(date) ?? [];
  const selectDay = (iso: string) => {
    setDate(iso);
    setMonth(iso);
  };

  return (
    <Page className="gap-6 px-5 pb-6 pt-2">
      {next ? (
        <m.div variants={fadeUp} initial="hidden" animate="show">
          <NextCard appointment={next} barberName={barbers.find((b) => b.id === next.barberId)?.name} />
        </m.div>
      ) : (
        <div className="rounded-2xl bg-surface-lowest px-4 py-3.5 shadow-xs">
          <p className="text-[15px] font-semibold">No tenés turnos próximos</p>
          <p className="mt-0.5 text-[13px] text-secondary">
            {client?.credit
              ? `Tenés ${money(client.credit)} de crédito para tu próxima seña.`
              : "Elegí un día del calendario y reservá tu corte."}
          </p>
        </div>
      )}

      {/* Agenda del mes: los días con turno quedan marcados y desde cada fecha se reserva. */}
      <section>
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          selected={date}
          onSelect={selectDay}
          markOf={(iso) => ({ count: byDay.get(iso)?.length ?? 0, muted: !bookable(iso) })}
          minDate={today}
          hint={`Tocá una fecha para ver tus turnos y reservar. Se puede reservar hasta ${WEEKS_AHEAD} semanas por adelantado.`}
        />

        {/* Qué se puede hacer sobre el día elegido */}
        <div className="mt-3 rounded-2xl bg-surface-lowest p-4 shadow-xs">
          <p className="text-[15px] font-semibold capitalize">{longDate(date)}</p>
          <p className="text-[13px] text-secondary">
            {dayAppointments.length
              ? `${dayAppointments.length} ${dayAppointments.length === 1 ? "turno" : "turnos"} tuyos`
              : "No tenés turnos ese día"}
          </p>

          {dayAppointments.length > 0 && (
            <ul className="mt-3 divide-y divide-surface-high overflow-hidden rounded-xl bg-surface-low">
              {dayAppointments.map((a, i) => (
                <m.li key={a.id} custom={i} variants={listItem} initial="hidden" animate="show">
                  <Link href={`/cliente/turno/${a.id}`} transitionTypes={[...NAV.forward]} className="row">
                    <span className="w-12 shrink-0 text-[15px] font-bold tabular-nums">{a.time}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{a.serviceName}</span>
                      <span className="block text-[13px] text-secondary">
                        con {barbers.find((b) => b.id === a.barberId)?.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold text-primary">Ver</span>
                    <ChevronRight size={18} className="shrink-0 text-secondary" aria-hidden />
                  </Link>
                </m.li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-col gap-2">
            {bookable(date) ? (
              <Link href={`/cliente/reservar?fecha=${date}`} transitionTypes={[...NAV.forward]} className="tap btn-primary">
                <Plus size={18} aria-hidden /> Reservar turno
              </Link>
            ) : (
              <p className="rounded-xl bg-surface-low px-3 py-2.5 text-[13px] text-secondary">
                {date < today
                  ? "Ese día ya pasó: no se puede reservar."
                  : date > limit
                    ? `La agenda abre hasta ${WEEKS_AHEAD} semanas por adelantado. Para una fecha más lejana, escribinos.`
                    : "Ese día el local está cerrado."}
              </p>
            )}
            {dayAppointments.some((a) => a.status === "confirmado") && (
              <p className="px-1 text-xs text-muted">Entrá a tu turno para reprogramarlo, cancelarlo o sumar productos.</p>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-2">
        <Link href="/cliente/reservar" transitionTypes={[...NAV.tab]} className="tap row rounded-2xl bg-surface-lowest shadow-xs">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-fixed text-primary">
            <CalendarPlus size={19} aria-hidden />
          </span>
          <span className="flex-1 text-[15px] font-medium">Reservar por servicio</span>
          <ChevronRight size={18} className="text-secondary" aria-hidden />
        </Link>
        <Link href="/cliente/tienda" transitionTypes={[...NAV.tab]} className="tap row rounded-2xl bg-surface-lowest shadow-xs">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-fixed text-primary">
            <ShoppingBag size={19} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">Sumá productos</span>
            <span className="block text-[13px] text-secondary">Te los entregamos en el sillón</span>
          </span>
          <ChevronRight size={18} className="text-secondary" aria-hidden />
        </Link>
        <Link href="/cliente/historial" transitionTypes={[...NAV.forward]} className="tap row rounded-2xl bg-surface-lowest shadow-xs">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-low text-secondary">
            <History size={19} aria-hidden />
          </span>
          <span className="flex-1 text-[15px] font-medium">Historial de turnos</span>
          <ChevronRight size={18} className="text-secondary" aria-hidden />
        </Link>
      </div>
    </Page>
  );
}

function NextCard({ appointment, barberName }: { appointment: Appointment; barberName?: string }) {
  const t = appointmentTotals(appointment);
  return (
    <Link
      href={`/cliente/turno/${appointment.id}`}
      transitionTypes={[...NAV.forward]}
      className="tap block overflow-hidden rounded-3xl bg-primary p-5 text-on-primary shadow-cta"
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-primary-fixed">Tu próximo turno</span>
        <StatusChip appointment={appointment} className="bg-on-primary/15 text-on-primary" />
      </div>
      <p className="mt-3 text-[15px] capitalize text-primary-fixed">{longDate(appointment.date)}</p>
      <p className="text-5xl font-bold tracking-tight tabular-nums">{appointment.time}</p>
      <p className="mt-2 text-[17px] font-semibold">{appointment.serviceName}</p>
      <div className="mt-4 flex items-center justify-between border-t border-on-primary/15 pt-3 text-sm">
        <span className="text-primary-fixed">con {barberName}</span>
        <span className="flex items-center gap-1 font-semibold">
          Resta {money(t.dueAtChair)} <ChevronRight size={16} />
        </span>
      </div>
    </Link>
  );
}
