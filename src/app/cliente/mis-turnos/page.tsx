"use client";

import * as m from "motion/react-m";
import { CalendarPlus, ChevronRight, Clock, CreditCard, History, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusChip } from "@/components/appointments/StatusChip";
import { depositDeadline, depositDue, formatDeadline, useClientAppointments } from "@/components/appointments/useClientAppointments";
import { PayDepositSheet } from "@/components/booking/PayDepositSheet";
import { NAV, Page } from "@/components/motion/Page";
import { MonthCalendar } from "@/components/ui/MonthCalendar";
import { dayNumber, dayShort, longDate, monthShort, todayISO } from "@/lib/dates";
import { money } from "@/lib/format";
import { fadeUp, listItem } from "@/lib/motion";
import { appointmentTotals } from "@/lib/pricing";
import { clientBookingLimit, openingHours, windowLabel } from "@/lib/schedule";
import type { Appointment } from "@/lib/types";
import { useAppStore, useCurrentClient } from "@/store/useAppStore";
import { useBookingRules } from "@/store/useRules";


export default function MisTurnosPage() {
  const barbers = useAppStore((s) => s.barbers);
  const appointments = useAppStore((s) => s.appointments);
  const hours = useAppStore((s) => s.businessHours);
  const client = useCurrentClient();
  const { next, upcoming } = useClientAppointments();
  const [paying, setPaying] = useState(false);
  const later = upcoming.slice(1);
  const barberName = (id: string) => barbers.find((b) => b.id === id)?.name;

  const today = todayISO();
  const rules = useBookingRules();
  const limit = clientBookingLimit(new Date(), rules.windowDays);
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
    <Page className="px-5 pb-6 pt-2">
      {/* Celular: una columna. Escritorio: lo próximo a la izquierda y el calendario a la derecha. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-3">
          {next ? (
            <m.div variants={fadeUp} initial="hidden" animate="show" className="flex flex-col gap-2">
              <NextCard appointment={next} barberName={barberName(next.barberId)} />
              {depositDue(next) && <DepositDue appointment={next} onPay={() => setPaying(true)} />}
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

          {later.length > 0 && (
            <section aria-labelledby="proximos-title" className="mt-2">
              <h2 id="proximos-title" className="mb-2 px-1 text-sm font-semibold text-secondary">
                Próximos turnos
              </h2>
              <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
                {later.map((a, i) => (
                  <m.li key={a.id} custom={i} variants={listItem} initial="hidden" animate="show">
                    <Link href={`/cliente/turno/${a.id}`} transitionTypes={[...NAV.forward]} className="row hover:bg-surface-low">
                      <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-low leading-none">
                        <span className="text-xs font-medium capitalize text-secondary">{dayShort(a.date)}</span>
                        <span className="text-base font-bold">{dayNumber(a.date)}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">
                          {a.time} · {a.serviceName}
                        </span>
                        <span className="block truncate text-[13px] text-secondary">
                          {monthShort(a.date)} · con {barberName(a.barberId)}
                        </span>
                      </span>
                      {a.deposit.status !== "abonada" && <StatusChip appointment={a} viewer="client" />}
                      <ChevronRight size={18} className="shrink-0 text-secondary" aria-hidden />
                    </Link>
                  </m.li>
                ))}
              </ul>
            </section>
          )}

          {/* La regla de cambios, una sola vez y a la vista: no aparece recién al intentar. */}
          {upcoming.length > 0 && (
            <p className="flex items-start gap-2 px-1 text-[13px] text-secondary">
              <Clock size={15} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                Entrá a un turno para reprogramarlo, cancelarlo o sumar productos. Sin cargo hasta {rules.cancelHours} h antes.
              </span>
            </p>
          )}
        </div>

        {/* Agenda del mes: los días con turno quedan marcados y desde cada fecha se reserva. */}
        <section className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            selected={date}
            onSelect={selectDay}
            markOf={(iso) => ({ count: byDay.get(iso)?.length ?? 0, muted: !bookable(iso) })}
            minDate={today}
            countLabel="turnos"
            hint={`Tocá una fecha para ver tus turnos y reservar. Se puede reservar hasta ${windowLabel(rules.windowDays)} por adelantado.`}
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
                        <span className="block text-[13px] text-secondary">con {barberName(a.barberId)}</span>
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
                      ? `La agenda abre hasta ${windowLabel(rules.windowDays)} por adelantado. Para una fecha más lejana, escribinos.`
                      : "Ese día el local está cerrado."}
                </p>
              )}
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-2 lg:col-start-1">
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
      </div>

      {next && <PayDepositSheet appointment={next} open={paying} onClose={() => setPaying(false)} />}
    </Page>
  );
}

/** La seña del próximo turno sigue sin pagar: hasta cuándo hay tiempo y el botón para pagarla. */
function DepositDue({ appointment, onPay }: { appointment: Appointment; onPay: () => void }) {
  const hours = useAppStore((s) => s.businessHours);
  const rules = useBookingRules();
  const deadline = depositDeadline(appointment, hours, rules);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-amber-container px-4 py-3 text-amber-ink">
      <span className="min-w-0 flex-1 text-[13px]">
        <span className="block text-[15px] font-semibold">Seña pendiente · {money(appointment.deposit.amount)}</span>
        {deadline ? `Aboná la seña antes del ${formatDeadline(deadline)}` : "Pagala para dejar el turno asegurado."}
      </span>
      <button
        type="button"
        onClick={onPay}
        className="tap inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-on-primary"
      >
        <CreditCard size={16} aria-hidden /> Pagar seña
      </button>
    </div>
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
        <StatusChip appointment={appointment} viewer="client" className="bg-on-primary/15 text-on-primary" />
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
