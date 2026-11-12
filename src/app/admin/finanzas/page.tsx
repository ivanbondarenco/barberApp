"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ChevronLeft, ChevronRight, ReceiptText, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { NAV, Page } from "@/components/motion/Page";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState, Section } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import {
  addDays,
  addMonths,
  dayNumber,
  dayShort,
  daysBetween,
  longDate,
  monthRange,
  monthYear,
  rangeLabel,
  timeToMinutes,
  todayISO,
  workWeek,
} from "@/lib/dates";
import { daySummary, paymentMovements, percentChange, periodTotals, type Movement } from "@/lib/finance";
import { money, paymentMethodLabel } from "@/lib/format";
import { ease, listItem } from "@/lib/motion";
import { firstOpenDay, lastOpenDay, openingHours } from "@/lib/schedule";
import type { BusinessHours } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

type Period = "dia" | "semana" | "mes";

const STEP_LABELS: Record<Period, [string, string]> = {
  dia: ["Día anterior", "Día siguiente"],
  semana: ["Semana anterior", "Semana siguiente"],
  mes: ["Mes anterior", "Mes siguiente"],
};

/**
 * Horas que muestra el gráfico del día: las del horario del local (o, si ese día cerró, las del
 * día más amplio de la semana), estiradas si hubo cobros fuera de hora.
 */
function chartHours(date: string, hours: BusinessHours, withData: number[]): number[] {
  const opening = openingHours(date, hours);
  let from = 24;
  let to = 0;
  const widen = (open: string, close: string) => {
    from = Math.min(from, Math.floor(timeToMinutes(open) / 60));
    to = Math.max(to, Math.ceil(timeToMinutes(close) / 60) - 1);
  };
  if (opening) widen(opening.open, opening.close);
  else for (let i = 0; i < 7; i++) {
    const o = openingHours(addDays(date, i), hours);
    if (o) widen(o.open, o.close);
  }
  for (const h of withData) {
    from = Math.min(from, h);
    to = Math.max(to, h);
  }
  if (from > to) [from, to] = [9, 19];
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

export default function FinanzasPage() {
  const appointments = useAppStore((s) => s.appointments);
  const today = todayISO();
  const hours = useAppStore((s) => s.businessHours);
  // Si hoy el local está cerrado, se arranca en el próximo día abierto: el mismo criterio
  // que la agenda, así las dos pantallas hablan del mismo día.
  const anchor = useMemo(() => firstOpenDay(today, hours), [today, hours]);
  const [period, setPeriod] = useState<Period>("dia");
  const [date, setDate] = useState(anchor);
  /** Barra tocada en el gráfico (hora en "Día", fecha en "Semana" y "Mes"). */
  const [activeBar, setActiveBar] = useState<string | null>(null);

  // La semana va de lunes a sábado; si el local abre los domingos, también los incluye.
  const opensSunday = !!hours[0] && !hours[0].closed;
  const week = useMemo(() => workWeek(date, 0, opensSunday), [date, opensSunday]);

  const range = useMemo(() => {
    if (period === "dia") return { from: date, to: date };
    if (period === "mes") return monthRange(date);
    return { from: week[0], to: week[week.length - 1] };
  }, [period, date, week]);

  /** El mismo tramo, un paso atrás: contra eso se calcula la variación. */
  const previous = useMemo(() => {
    if (period === "dia") return { from: addDays(date, -7), to: addDays(date, -7) };
    if (period === "mes") return monthRange(addMonths(date, -1));
    return { from: addDays(range.from, -7), to: addDays(range.to, -7) };
  }, [period, date, range.from, range.to]);

  const step = (dir: 1 | -1) => {
    setActiveBar(null);
    if (period === "dia") setDate((d) => (dir > 0 ? firstOpenDay(addDays(d, 1), hours) : lastOpenDay(addDays(d, -1), hours)));
    else if (period === "semana") setDate((d) => addDays(d, dir * 7));
    else setDate((d) => addMonths(d, dir));
  };

  const summary = useMemo(() => daySummary(appointments, date), [appointments, date]);
  const totals = useMemo(() => periodTotals(appointments, range.from, range.to), [appointments, range.from, range.to]);
  const prevTotals = useMemo(() => periodTotals(appointments, previous.from, previous.to), [appointments, previous.from, previous.to]);
  const delta = percentChange(totals.total, prevTotals.total);
  const movements = useMemo(() => paymentMovements(appointments, range.from, range.to), [appointments, range.from, range.to]);

  const byHour = useMemo(() => {
    const map = new Map<number, number>();
    for (const mv of movements) {
      const h = Math.floor(timeToMinutes(mv.time) / 60);
      map.set(h, (map.get(h) ?? 0) + mv.amount);
    }
    return map;
  }, [movements]);
  const hourList = useMemo(() => chartHours(date, hours, [...byHour.keys()]), [date, hours, byHour]);
  const hourMax = Math.max(1, ...hourList.map((h) => byHour.get(h) ?? 0));

  // Semana y mes muestran todos los días del tramo, también los que no tuvieron cobros.
  const dayBars = useMemo(() => {
    const totalsByDay = new Map(totals.byDay.map((d) => [d.date, d.total]));
    return daysBetween(range.from, range.to).map((d) => ({ date: d, total: totalsByDay.get(d) ?? 0 }));
  }, [totals.byDay, range.from, range.to]);
  const dayMax = Math.max(1, ...dayBars.map((d) => d.total));

  const periodLabel =
    period === "dia" ? longDate(date) : period === "mes" ? monthYear(date) : `semana del ${rangeLabel(range.from, range.to)}`;
  const total = period === "dia" ? summary.total : totals.total;

  // Movimientos agrupados por día (en "Día" queda un único grupo).
  const groups = useMemo(() => {
    const map = new Map<string, Movement[]>();
    for (const mv of movements) map.set(mv.date, [...(map.get(mv.date) ?? []), mv]);
    return [...map.entries()];
  }, [movements]);

  const caption = (() => {
    if (activeBar === null) return "Tocá una barra";
    if (period === "dia") return `${activeBar} h · ${money(byHour.get(Number(activeBar)) ?? 0)}`;
    const bar = dayBars.find((d) => d.date === activeBar);
    return bar ? `${dayShort(bar.date)} ${dayNumber(bar.date)} · ${money(bar.total)}` : "Tocá una barra";
  })();

  const [prevLabel, nextLabel] = STEP_LABELS[period];

  return (
    <Page className="gap-5 px-5 pb-6 pt-1">
      <Segmented
        label="Período"
        value={period}
        onChange={(p) => {
          setPeriod(p);
          setActiveBar(null);
        }}
        options={[
          { value: "dia", label: "Día" },
          { value: "semana", label: "Semana" },
          { value: "mes", label: "Mes" },
        ]}
      />

      <div className="flex items-center justify-between gap-2">
        {/* Fuera de "Día" no hay tira de días: el título dice qué tramo se está mirando. */}
        <p className="min-w-0 truncate text-[15px] font-semibold">
          {period === "semana" ? `Semana del ${rangeLabel(range.from, range.to)}` : monthYear(date)}
        </p>
        <div className="flex shrink-0 items-center">
          <button type="button" aria-label={prevLabel} onClick={() => step(-1)} className="icon-btn text-secondary">
            <ChevronLeft size={19} />
          </button>
          <button type="button" aria-label={nextLabel} onClick={() => step(1)} className="icon-btn text-secondary">
            <ChevronRight size={19} />
          </button>
        </div>
      </div>

      {period === "dia" && (
        <div className={cn("grid gap-1.5", week.length === 7 ? "grid-cols-7" : "grid-cols-6")} role="radiogroup" aria-label="Día">
          {week.map((d) => {
            const active = d === date;
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={longDate(d)}
                onClick={() => {
                  setDate(d);
                  setActiveBar(null);
                }}
                className={cn("tap relative flex min-h-12 flex-col items-center rounded-2xl py-2", active ? "text-on-primary" : "text-ink")}
              >
                {active && <m.span layoutId="fin-day" className="absolute inset-0 rounded-2xl bg-primary" transition={{ type: "spring", damping: 30, stiffness: 400 }} aria-hidden />}
                <span className={cn("relative text-[11px]", active ? "text-on-primary/80" : "text-secondary")}>{d === today ? "Hoy" : dayShort(d)}</span>
                <span className="relative text-lg font-bold tabular-nums">{dayNumber(d)}</span>
              </button>
            );
          })}
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <m.section
          key={`${period}-${range.from}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.25, ease: ease.enter } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          className="rounded-3xl bg-surface-lowest p-5 shadow-xs"
        >
          <p className="text-[13px] text-secondary first-letter:uppercase">Cobrado · {periodLabel}</p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-4xl font-bold tracking-tight tabular-nums">{money(total)}</p>
            {delta !== null && (
              <p className={cn("text-[13px] font-semibold tabular-nums", delta >= 0 ? "text-mint-ink" : "text-error")}>
                {delta >= 0 ? "+" : "−"}
                {Math.abs(delta)}%{" "}
                <span className="font-normal text-secondary">{period === "dia" ? "vs. mismo día de la semana pasada" : "vs. período anterior"}</span>
              </p>
            )}
          </div>

          {period === "dia" ? (
            <div className="mt-4 flex h-24 items-end gap-1" role="group" aria-label="Cobros por hora">
              {hourList.map((h, i) => {
                const value = byHour.get(h) ?? 0;
                const active = activeBar === String(h);
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setActiveBar(active ? null : String(h))}
                    aria-pressed={active}
                    className="flex h-full flex-1 items-end"
                    aria-label={`${h} h: ${money(value)}`}
                  >
                    <m.span
                      initial={{ height: 0 }}
                      animate={{ height: value ? `${Math.max(10, (value / hourMax) * 100)}%` : "3px" }}
                      transition={{ duration: 0.5, ease: ease.enter, delay: i * 0.03 }}
                      className={cn("w-full rounded-t-[4px]", value ? (active ? "bg-primary-strong" : "bg-primary") : "bg-surface-high")}
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={cn("mt-4 flex h-24 items-end", dayBars.length > 10 ? "gap-0.5" : "gap-1")} role="group" aria-label="Cobros por día">
              {dayBars.map((d) => {
                const active = activeBar === d.date;
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setActiveBar(active ? null : d.date)}
                    aria-pressed={active}
                    aria-label={`${longDate(d.date)}: ${money(d.total)}`}
                    className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                  >
                    <m.span
                      initial={{ height: 0 }}
                      animate={{ height: d.total ? `${Math.max(10, (d.total / dayMax) * 100)}%` : "3px" }}
                      transition={{ duration: 0.5, ease: ease.enter }}
                      className={cn("w-full rounded-t-[4px]", d.total ? (active ? "bg-primary-strong" : "bg-primary") : "bg-surface-high")}
                    />
                    {dayBars.length <= 10 && <span className="text-[10px] text-secondary">{dayNumber(d.date)}</span>}
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-1 flex justify-between gap-2 text-[11px] text-secondary">
            <span>{period === "dia" ? `${hourList[0]} h` : period === "mes" ? dayNumber(range.from) : ""}</span>
            <span className={cn(activeBar !== null && "font-semibold text-ink")} aria-live="polite">
              {caption}
            </span>
            <span>{period === "dia" ? `${hourList[hourList.length - 1]} h` : period === "mes" ? dayNumber(range.to) : ""}</span>
          </div>

          {period === "dia" ? (
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-surface-high pt-4 text-center">
              <Stat label="Efectivo" value={money(summary.cash)} />
              <Stat label="Digital" value={money(summary.digital)} />
              <Stat label="Por cobrar" value={money(summary.pending)} highlight />
            </div>
          ) : (
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
          )}
        </m.section>
      </AnimatePresence>

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

      <Section title={`Movimientos · ${period === "dia" ? (date === today ? "hoy" : longDate(date)) : periodLabel}`}>
        {movements.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Sin cobros"
            text={period === "dia" ? "Todavía no se registraron cobros este día." : "No hubo cobros en este período."}
            className="py-6"
          />
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map(([day, list]) => (
              <div key={day} className="flex flex-col gap-1.5">
                {period !== "dia" && (
                  <p className="flex items-baseline justify-between px-1 text-[13px] font-semibold text-secondary">
                    <span>{longDate(day)}</span>
                    <span className="tabular-nums">{money(list.reduce((n, mv) => n + mv.amount, 0))}</span>
                  </p>
                )}
                <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
                  {list.map((mv, i) => (
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
              </div>
            ))}
          </div>
        )}
      </Section>

      <Link href="/admin/sueldos" transitionTypes={[...NAV.forward]} className="tap row card">
        <ReceiptText size={19} className="text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Sueldos y adelantos</span>
          <span className="block text-[13px] text-secondary">Comisiones del equipo, liquidaciones y recibos</span>
        </span>
        <ChevronRight size={17} className="text-secondary" aria-hidden />
      </Link>
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
