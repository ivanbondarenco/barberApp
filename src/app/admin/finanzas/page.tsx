"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ChevronLeft, ChevronRight, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { NAV, Page } from "@/components/motion/Page";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState, Section } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { dayNumber, dayShort, longDate, monthRange, monthYear, timeToMinutes, todayISO, workWeek } from "@/lib/dates";
import { daySummary, periodTotals } from "@/lib/finance";
import { money, paymentMethodLabel } from "@/lib/format";
import { ease, listItem } from "@/lib/motion";
import { appointmentTotals } from "@/lib/pricing";
import { firstOpenDay } from "@/lib/schedule";
import type { PaymentMethod } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

const HOURS = Array.from({ length: 11 }, (_, i) => 9 + i);

interface Movement {
  id: string;
  appointmentId: string;
  time: string;
  label: string;
  concept: string;
  method: PaymentMethod;
  amount: number;
}

type Period = "dia" | "semana" | "mes";

export default function FinanzasPage() {
  const appointments = useAppStore((s) => s.appointments);
  const cashOpen = useAppStore((s) => s.cashRegister.open);
  const today = todayISO();
  const hours = useAppStore((s) => s.businessHours);
  // Si hoy el local está cerrado, se arranca en el próximo día abierto: el mismo criterio
  // que la agenda, así las dos pantallas hablan del mismo día.
  const anchor = useMemo(() => firstOpenDay(today, hours), [today, hours]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [period, setPeriod] = useState<Period>("dia");
  const week = useMemo(() => workWeek(anchor, weekOffset), [anchor, weekOffset]);
  const [date, setDate] = useState(anchor);
  const [activeHour, setActiveHour] = useState<number | null>(null);

  // Al cambiar de semana, el día elegido salta al primero de esa semana.
  useEffect(() => {
    if (!week.includes(date)) setDate(week[0]);
  }, [week, date]);

  const summary = useMemo(() => daySummary(appointments, date), [appointments, date]);

  const { movements, byHour } = useMemo(() => {
    const list: Movement[] = [];
    const hours = new Map<number, number>();
    for (const a of appointments.filter((x) => x.date === date && x.status !== "cancelado")) {
      const hour = Math.floor(timeToMinutes(a.time) / 60);
      const push = (concept: string, method: PaymentMethod, amount: number) => {
        list.push({ id: `${a.id}-${concept}`, appointmentId: a.id, time: a.time, label: a.clientName, concept, method, amount });
        hours.set(hour, (hours.get(hour) ?? 0) + amount);
      };
      if (a.deposit.status === "abonada") push("Seña", a.deposit.method, appointmentTotals(a).depositPaid);
      if (a.balancePayment) push("Saldo", a.balancePayment.method, a.balancePayment.amount);
    }
    return { movements: list.sort((x, y) => timeToMinutes(y.time) - timeToMinutes(x.time)), byHour: hours };
  }, [appointments, date]);

  const max = Math.max(1, ...HOURS.map((h) => byHour.get(h) ?? 0));

  // Semana: de lunes a sábado. Mes: del 1 al último día.
  const range = useMemo(
    () => (period === "mes" ? monthRange(date) : { from: week[0], to: week[week.length - 1] }),
    [period, date, week],
  );
  const totals = useMemo(
    () => periodTotals(appointments, range.from, range.to),
    [appointments, range.from, range.to],
  );
  const dayMax = Math.max(1, ...totals.byDay.map((d) => d.total));

  return (
    <Page className="gap-5 px-5 pb-6 pt-1">
      <Segmented
        label="Período"
        value={period}
        onChange={setPeriod}
        options={[
          { value: "dia", label: "Día" },
          { value: "semana", label: "Semana" },
          { value: "mes", label: "Mes" },
        ]}
      />

      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold capitalize">{monthYear(week[0])}</p>
        <div className="flex items-center">
          <button type="button" aria-label="Semana anterior" onClick={() => setWeekOffset((w) => w - 1)} className="icon-btn h-10 w-10 text-secondary">
            <ChevronLeft size={19} />
          </button>
          <button type="button" aria-label="Semana siguiente" onClick={() => setWeekOffset((w) => w + 1)} className="icon-btn h-10 w-10 text-secondary">
            <ChevronRight size={19} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Día">
        {week.map((d) => {
          const active = d === date;
          return (
            <button key={d} type="button" role="radio" aria-checked={active} onClick={() => setDate(d)} className={cn("tap relative flex flex-col items-center rounded-2xl py-2", active ? "text-on-primary" : "text-ink")}>
              {active && <m.span layoutId="fin-day" className="absolute inset-0 rounded-2xl bg-primary" transition={{ type: "spring", damping: 30, stiffness: 400 }} aria-hidden />}
              <span className={cn("relative text-[11px]", active ? "text-on-primary/80" : "text-secondary")}>{d === today ? "Hoy" : dayShort(d)}</span>
              <span className="relative text-lg font-bold tabular-nums">{dayNumber(d)}</span>
            </button>
          );
        })}
      </div>

      {period !== "dia" && (
        <m.section
          key={`${period}-${range.from}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.25, ease: ease.enter } }}
          className="rounded-3xl bg-surface-lowest p-5 shadow-xs"
        >
          <p className="text-[13px] capitalize text-secondary">
            Cobrado · {period === "mes" ? monthYear(date) : `semana del ${dayNumber(range.from)} al ${dayNumber(range.to)}`}
          </p>
          <p className="text-4xl font-bold tracking-tight tabular-nums">{money(totals.total)}</p>

          <div className="mt-4 flex h-24 items-end gap-1" role="group" aria-label="Cobros por día">
            {totals.byDay.map((d) => (
              <span key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.date}: ${money(d.total)}`}>
                <m.span
                  initial={{ height: 0 }}
                  animate={{ height: d.total ? `${Math.max(10, (d.total / dayMax) * 100)}%` : "3px" }}
                  transition={{ duration: 0.5, ease: ease.enter }}
                  className={cn("w-full rounded-t-[4px]", d.total ? "bg-primary" : "bg-surface-high")}
                />
                <span className="text-[10px] text-secondary">{dayNumber(d.date)}</span>
              </span>
            ))}
            {totals.byDay.length === 0 && <span className="flex-1 self-center text-center text-[13px] text-secondary">Sin cobros en el período</span>}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-surface-high pt-3 text-[13px]">
            {[
              { label: "Efectivo", value: money(totals.cash) },
              { label: "Digital", value: money(totals.digital) },
              { label: "Señas", value: money(totals.deposits) },
              { label: "Saldos en sillón", value: money(totals.balances) },
              { label: "Productos", value: money(totals.productsSold) },
              { label: "Turnos cobrados", value: String(totals.completed) },
              { label: "Ausencias", value: String(totals.noShows) },
              { label: "Cancelados", value: String(totals.cancelled) },
            ].map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-2">
                <dt className="text-secondary">{row.label}</dt>
                <dd className="font-semibold tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>
        </m.section>
      )}

      {period !== "dia" && totals.topServices.length > 0 && (
        <Section title="Servicios más vendidos">
          <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
            {totals.topServices.map((s) => (
              <li key={s.name} className="row">
                <span className="min-w-0 flex-1 truncate text-[15px]">{s.name}</span>
                <span className="text-[13px] text-secondary">×{s.count}</span>
                <span className="w-24 text-right text-[15px] font-semibold tabular-nums">{money(s.total)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {period === "dia" && (
        <m.section
          key={date}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.25, ease: ease.enter } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          className="rounded-3xl bg-surface-lowest p-5 shadow-xs"
        >
          <p className="text-[13px] capitalize text-secondary">Cobrado · {longDate(date)}</p>
          <p className="text-4xl font-bold tracking-tight tabular-nums">{money(summary.total)}</p>

          <div className="mt-4 flex h-24 items-end gap-1" role="group" aria-label="Cobros por hora">
            {HOURS.map((h) => {
              const value = byHour.get(h) ?? 0;
              const active = activeHour === h;
              return (
                <button key={h} type="button" onClick={() => setActiveHour(active ? null : h)} className="flex h-full flex-1 items-end" aria-label={`${h} h: ${money(value)}`}>
                  <m.span
                    initial={{ height: 0 }}
                    animate={{ height: value ? `${Math.max(10, (value / max) * 100)}%` : "3px" }}
                    transition={{ duration: 0.5, ease: ease.enter, delay: (h - 9) * 0.03 }}
                    className={cn("w-full rounded-t-[4px]", value ? (active ? "bg-primary-strong" : "bg-primary") : "bg-surface-high")}
                  />
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-secondary">
            <span>9 h</span>
            <span>{activeHour !== null ? `${activeHour} h · ${money(byHour.get(activeHour) ?? 0)}` : "Tocá una barra"}</span>
            <span>19 h</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-surface-high pt-4 text-center">
            <Stat label="Efectivo" value={money(summary.cash)} />
            <Stat label="Digital" value={money(summary.digital)} />
            <Stat label="Por cobrar" value={money(summary.pending)} highlight />
          </div>
        </m.section>
        )}
      </AnimatePresence>

      <Link href="/admin/finanzas/cierre" transitionTypes={[...NAV.forward]} className="tap row rounded-2xl bg-surface-lowest shadow-xs">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-fixed text-primary">
          <Receipt size={19} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">Cierre de caja</span>
          <span className="block text-[13px] text-secondary">{cashOpen ? "Caja abierta · hacé el arqueo al final del día" : "Caja cerrada"}</span>
        </span>
        <ChevronRight size={18} className="text-secondary" aria-hidden />
      </Link>

      <Section title="Movimientos">
        {movements.length === 0 ? (
          <EmptyState icon={Wallet} title="Sin cobros" text="Todavía no se registraron cobros este día." className="py-6" />
        ) : (
          <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
            {movements.map((mv, i) => (
              <m.li key={mv.id} custom={i} variants={listItem} initial="hidden" animate="show">
                <Link href={`/admin/turno/${mv.appointmentId}`} transitionTypes={[...NAV.forward]} className="row">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{mv.label}</span>
                    <span className="block text-[13px] text-secondary">
                      {mv.concept} · {paymentMethodLabel[mv.method]} · {mv.time}
                    </span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums">{money(mv.amount)}</span>
                </Link>
              </m.li>
            ))}
          </ul>
        )}
      </Section>
    </Page>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-secondary">{label}</p>
      <p className={cn("text-[15px] font-bold tabular-nums", highlight && "text-primary")}>{value}</p>
    </div>
  );
}
