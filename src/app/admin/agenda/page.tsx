"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { Ban, CalendarDays, CalendarPlus, CalendarRange, CalendarX2, Lock } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppointmentFormSheet } from "@/components/appointments/AppointmentFormSheet";
import { BlockSheet } from "@/components/appointments/BlockSheet";
import { StatusChip } from "@/components/appointments/StatusChip";
import { WeekStrip } from "@/components/admin/WeekStrip";
import { NAV, Page } from "@/components/motion/Page";
import { Fab } from "@/components/ui/Fab";
import { EmptyState } from "@/components/ui/States";
import { MonthCalendar } from "@/components/ui/MonthCalendar";
import { SetupChecklist } from "@/components/layout/SetupChecklist";
import { cn } from "@/lib/cn";
import { dateTime, longDate, minutesToTime, monthYear, timeToMinutes, toISODate } from "@/lib/dates";
import { money } from "@/lib/format";
import { ease, listItem } from "@/lib/motion";
import { setupTasks } from "@/lib/notifications";
import { appointmentTotals } from "@/lib/pricing";
import { blockAppliesOn, firstOpenDay, openingHours, shiftOf } from "@/lib/schedule";
import type { Appointment, TimeBlock } from "@/lib/types";
import { deleteBlock } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";

type Item = { kind: "appointment"; data: Appointment } | { kind: "block"; data: TimeBlock };
const timeOf = (i: Item) => (i.kind === "appointment" ? i.data.time : i.data.start);
const ALL = "todos";

/** Hora actual que se refresca cada minuto: mueve la marca de "ahora" y el turno en curso. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    // Se alinea al cambio de minuto para que la hora de la marca coincida con la del reloj.
    const timeout = setTimeout(() => {
      setNow(Date.now());
      interval = setInterval(() => setNow(Date.now()), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);
  return now;
}

export default function AgendaPage() {
  const barbers = useAppStore((s) => s.barbers);
  const appointments = useAppStore((s) => s.appointments);
  const blocks = useAppStore((s) => s.blocks);
  const session = useAppStore((s) => s.session);
  const isOwner = session?.role === "admin";

  const nowMs = useNow();
  const today = toISODate(new Date(nowMs));
  const hours = useAppStore((s) => s.businessHours);
  // Si hoy el local está cerrado (domingo, por ejemplo), la agenda arranca en el próximo día
  // abierto en vez de mostrar un día vacío y la semana que ya pasó.
  const anchor = useMemo(() => firstOpenDay(today, hours), [today, hours]);
  const [date, setDate] = useState(anchor);
  const [month, setMonth] = useState(anchor);
  const [direction, setDirection] = useState(1);
  /** En el teléfono el mes entero se pide; en escritorio está siempre al costado. */
  const [showMonth, setShowMonth] = useState(false);
  const [barberFilter, setBarberFilter] = useState<string>(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);

  const activeBarbers = useMemo(() => barbers.filter((b) => b.active), [barbers]);
  // El barbero ve solo su sillón; el dueño puede acotar a uno con los filtros.
  const viewBarber = isOwner ? (barberFilter === ALL ? null : barberFilter) : (session?.barberId ?? null);
  const mine = useMemo(
    () => (viewBarber ? appointments.filter((a) => a.barberId === viewBarber) : appointments),
    [appointments, viewBarber],
  );
  const myBlocks = useMemo(() => (viewBarber ? blocks.filter((b) => b.barberId === viewBarber) : blocks), [blocks, viewBarber]);

  const integrations = useAppStore((s) => s.integrations);
  const services = useAppStore((s) => s.services);
  const synced = useAppStore((s) => s.synced);
  // Lo que le falta configurar al dueño queda a mano en una línea, sin tapar la agenda.
  const setup = useMemo(
    () => (synced && isOwner ? setupTasks({ integrations, services }, "admin") : []),
    [synced, isOwner, integrations, services],
  );

  /** Turnos por día: es el punto que marca cada casilla del calendario y de la semana. */
  const countByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of mine) {
      if (a.status === "cancelado") continue;
      map.set(a.date, (map.get(a.date) ?? 0) + 1);
    }
    return map;
  }, [mine]);
  const dayAppointments = useMemo(
    () => mine.filter((a) => a.date === date && a.status !== "cancelado"),
    [mine, date],
  );
  const items = useMemo<Item[]>(
    () =>
      [
        ...dayAppointments.map((data) => ({ kind: "appointment" as const, data })),
        ...myBlocks.filter((b) => blockAppliesOn(b, date)).map((data) => ({ kind: "block" as const, data })),
      ].sort((a, b) => timeToMinutes(timeOf(a)) - timeToMinutes(timeOf(b))),
    [dayAppointments, myBlocks, date],
  );
  const pending = dayAppointments.filter((a) => a.status === "confirmado").reduce((n, a) => n + appointmentTotals(a).dueAtChair, 0);
  const opening = openingHours(date, hours);

  const isToday = date === today;
  const nowDate = new Date(nowMs);
  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
  // Marca de "ahora": solo hoy y mientras el local está abierto (con un margen de media hora).
  const showNow = isToday && !!opening && nowMin >= timeToMinutes(opening.open) - 30 && nowMin <= timeToMinutes(opening.close) + 30;

  /** El turno en curso o, si no hay, el próximo: ahí arranca la vista de hoy. */
  const focusId = useMemo(() => {
    if (!isToday) return null;
    const next = dayAppointments
      .filter((a) => a.status === "confirmado" && dateTime(a.date, a.time).getTime() + a.durationMin * 60_000 > nowMs)
      .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))[0];
    return next?.id ?? null;
  }, [isToday, dayAppointments, nowMs]);

  // Al abrir hoy, la lista baja sola hasta lo que está pasando. Una sola vez por día elegido:
  // después el scroll es del usuario.
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isToday || !focusId || scrolledFor.current === date) return;
    scrolledFor.current = date;
    const el = document.querySelector(`[data-agenda-focus="${focusId}"]`);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Espera a que termine la animación de entrada de la lista.
    const id = setTimeout(() => el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" }), 350);
    return () => clearTimeout(id);
  }, [isToday, focusId, date]);

  const selectDay = (d: string) => {
    setDirection(d > date ? 1 : -1);
    setDate(d);
    setMonth(d);
  };

  const groups: { label: string; shift: "manana" | "tarde"; items: Item[] }[] = (
    [
      { label: "Mañana", shift: "manana" as const, items: items.filter((i) => shiftOf(timeOf(i)) === "manana") },
      { label: "Tarde", shift: "tarde" as const, items: items.filter((i) => shiftOf(timeOf(i)) === "tarde") },
    ]
  ).filter((g) => g.items.length);
  const nowShift = shiftOf(minutesToTime(nowMin));
  /**
   * Si el turno (mañana/tarde) de ahora no tiene ítems, la marca va suelta: antes de la tarde si
   * todavía es de mañana, o después de la mañana si ya es de tarde.
   */
  const looseNow = showNow && !groups.some((g) => g.shift === nowShift);
  const nowLabel = minutesToTime(nowMin);

  const calendar = (
    <MonthCalendar
      month={month}
      onMonthChange={setMonth}
      selected={date}
      onSelect={selectDay}
      markOf={(iso) => ({ count: countByDay.get(iso) ?? 0, muted: !openingHours(iso, hours) })}
    />
  );

  return (
    <Page className="pb-28">
      <SetupChecklist tasks={setup} shopName={session?.shop?.name} variant="banner" dismissible className="mx-5 mb-2 mt-1" />

      <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start lg:gap-6 lg:px-5">
        {/* Escritorio: el mes al costado, fijo mientras se recorre la lista. */}
        <aside className="hidden lg:sticky lg:top-2 lg:block lg:rounded-2xl lg:bg-surface-lowest lg:p-4 lg:shadow-xs">{calendar}</aside>

        <div className="min-w-0">
          {/* Teléfono: semana compacta; el mes entero, a pedido. */}
          <div className="px-5 pt-1 lg:hidden">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[15px] font-semibold">{monthYear(date)}</p>
              <div className="flex shrink-0 items-center gap-1">
                {date !== anchor && (
                  <button type="button" onClick={() => selectDay(anchor)} className="tap min-h-11 rounded-full px-3 text-[13px] font-semibold text-primary">
                    Hoy
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowMonth((v) => !v)}
                  aria-expanded={showMonth}
                  className="tap flex min-h-11 items-center gap-1.5 rounded-full bg-surface-low px-3 text-[13px] font-semibold text-ink"
                >
                  {showMonth ? <CalendarRange size={15} aria-hidden /> : <CalendarDays size={15} aria-hidden />}
                  {showMonth ? "Ver semana" : "Ver mes"}
                </button>
              </div>
            </div>
            <div className="mt-1">
              {showMonth ? (
                calendar
              ) : (
                <WeekStrip
                  selected={date}
                  onSelect={selectDay}
                  countOf={(iso) => countByDay.get(iso) ?? 0}
                  closedOf={(iso) => !openingHours(iso, hours)}
                />
              )}
            </div>
          </div>

          {/* Qué se puede hacer sobre el día elegido */}
          <section className="mt-3 px-5 lg:mt-0 lg:px-0">
            <div className="rounded-2xl bg-surface-lowest p-4 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold capitalize">{longDate(date)}</p>
                  <p className="text-[13px] text-secondary">
                    {dayAppointments.length} turnos
                    {pending > 0 && <> · {money(pending)} a cobrar</>}
                    {opening ? <> · {opening.ranges.map((r) => `${r.open} a ${r.close}`).join(" y ")}</> : <> · cerrado</>}
                  </p>
                </div>
                {date !== anchor && (
                  <button
                    type="button"
                    onClick={() => selectDay(anchor)}
                    className="tap hidden min-h-11 shrink-0 items-center rounded-full bg-surface-low px-3 text-[13px] font-semibold text-secondary lg:flex"
                  >
                    Ir a hoy
                  </button>
                )}
              </div>

              {date < today ? (
                <p className="mt-3 rounded-xl bg-surface-low px-3 py-2.5 text-[13px] text-secondary">
                  Ese día ya pasó: queda para consultar lo que se hizo.
                </p>
              ) : opening ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setFormOpen(true)} className="tap btn-primary">
                    <CalendarPlus size={17} aria-hidden /> Cargar turno
                  </button>
                  <button type="button" onClick={() => setBlockOpen(true)} className="tap btn-secondary">
                    <Ban size={16} aria-hidden /> Bloquear horario
                  </button>
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-surface-low px-3 py-2.5 text-[13px] text-secondary">
                  Ese día el local está cerrado. Podés abrirlo en Configuración › Horarios.
                </p>
              )}
            </div>
          </section>

          {/* El dueño puede mirar la agenda de un solo barbero. */}
          {isOwner && activeBarbers.length > 1 && (
            <div role="group" aria-label="Filtrar por barbero" className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-5 lg:px-0">
              {[{ id: ALL, name: "Todos" }, ...activeBarbers].map((b) => {
                const active = barberFilter === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setBarberFilter(b.id)}
                    className={cn(
                      "tap min-h-11 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors",
                      active ? "bg-primary text-on-primary" : "bg-surface-lowest text-secondary shadow-xs hover:text-ink",
                    )}
                  >
                    {b.id === ALL ? b.name : b.name.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          )}

          {/* Lista */}
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <m.div
              key={`${date}-${viewBarber ?? ALL}`}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0, transition: { duration: 0.25, ease: ease.enter } }}
              exit={{ opacity: 0, x: direction * -24, transition: { duration: 0.12, ease: ease.exit } }}
              className="mt-4 flex flex-col gap-5 px-5 lg:px-0"
            >
              {groups.length === 0 ? (
                <>
                  {showNow && <NowMarker label={nowLabel} standalone />}
                  <EmptyState icon={CalendarX2} title="Día libre" text="No hay turnos ni bloqueos para este día." />
                </>
              ) : (
                groups.map((group) => {
                  const nowIdx = showNow && group.shift === nowShift ? group.items.findIndex((i) => timeToMinutes(timeOf(i)) > nowMin) : -2;
                  // Una sola lista plana con claves: así AnimatePresence sigue animando la salida de cada fila.
                  const rows: ReactNode[] = [];
                  group.items.forEach((item, i) => {
                    if (nowIdx === i) rows.push(<NowMarker key="now" label={nowLabel} />);
                    rows.push(
                      item.kind === "appointment" ? (
                        <m.li
                          key={item.data.id}
                          layout
                          custom={i}
                          variants={listItem}
                          initial="hidden"
                          animate="show"
                          exit="exit"
                          data-agenda-focus={item.data.id}
                          className="scroll-my-24"
                        >
                          <AppointmentRow
                            appointment={item.data}
                            barberName={barbers.find((b) => b.id === item.data.barberId)?.name.split(" ")[0]}
                            showBarber={barbers.length > 1 && !viewBarber}
                            now={nowMs}
                          />
                        </m.li>
                      ) : (
                        <m.li key={item.data.id} layout custom={i} variants={listItem} initial="hidden" animate="show" exit="exit">
                          {/* Quitar un bloqueo se deshace desde el aviso: no hace falta confirmar. */}
                          <button
                            type="button"
                            onClick={() => void deleteBlock(item.data)}
                            aria-label={`Quitar bloqueo: ${item.data.reason}, ${blockWhen(item.data)}${item.data.weekdays?.length || item.data.until ? " (todos sus días)" : ""}`}
                            className="row bg-surface-low/60 text-secondary"
                          >
                            <span className="w-12 text-sm font-semibold tabular-nums">{isAllDay(item.data) ? "Día" : item.data.start}</span>
                            <Lock size={16} aria-hidden />
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {item.data.reason} · {blockWhen(item.data)}
                              {barbers.length > 1 && !viewBarber && ` · ${barbers.find((b) => b.id === item.data.barberId)?.name.split(" ")[0] ?? ""}`}
                            </span>
                            <span className="text-[12px] font-semibold text-primary">Quitar</span>
                          </button>
                        </m.li>
                      ),
                    );
                  });
                  if (nowIdx === -1) rows.push(<NowMarker key="now" label={nowLabel} />);
                  return (
                    <Fragment key={group.label}>
                      {looseNow && group.shift === "tarde" && <NowMarker label={nowLabel} standalone />}
                      <section>
                        <h2 className="section-title mb-2 px-1">{group.label}</h2>
                        <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
                          <AnimatePresence initial={false}>{rows}</AnimatePresence>
                        </ul>
                      </section>
                      {looseNow && group.shift === "manana" && <NowMarker label={nowLabel} standalone />}
                    </Fragment>
                  );
                })
              )}
            </m.div>
          </AnimatePresence>
        </div>
      </div>

      <Fab label="Turno" onClick={() => setFormOpen(true)} />

      <AppointmentFormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initialDate={date}
        onCreated={(id) => {
          const created = useAppStore.getState().appointments.find((a) => a.id === id);
          if (created) selectDay(created.date);
        }}
      />
      <BlockSheet open={blockOpen} onClose={() => setBlockOpen(false)} date={date} />
    </Page>
  );
}

/** Línea de "ahora" entre los turnos del día. */
function NowMarker({ label, standalone }: { label: string; standalone?: boolean }) {
  const Tag = standalone ? "div" : "li";
  return (
    <Tag className={cn("flex items-center gap-2 py-1", standalone ? "px-1" : "px-4")}>
      <span className="text-[11px] font-bold tabular-nums text-primary">
        <span className="sr-only">Ahora, </span>
        {label}
      </span>
      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
      <span className="h-px flex-1 bg-primary" aria-hidden />
    </Tag>
  );
}

function AppointmentRow({ appointment: a, barberName, showBarber, now }: { appointment: Appointment; barberName?: string; showBarber: boolean; now: number }) {
  const start = dateTime(a.date, a.time).getTime();
  const inProgress = a.status === "confirmado" && now >= start && now < start + a.durationMin * 60_000;
  return (
    <Link href={`/admin/turno/${a.id}`} transitionTypes={[...NAV.forward]} className={cn("row", a.status === "completado" && "opacity-60")}>
      <span className="w-12 shrink-0">
        <span className={cn("block text-[15px] font-bold tabular-nums", inProgress && "text-primary")}>{a.time}</span>
        <span className="block text-[11px] text-secondary">{inProgress ? "en curso" : `${a.durationMin}m`}</span>
      </span>
      <span className={cn("h-9 w-1 shrink-0 rounded-full", inProgress ? "bg-primary" : "bg-surface-high")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{a.clientName}</span>
        <span className="block truncate text-[13px] text-secondary">
          {a.serviceName}
          {showBarber && barberName ? ` · ${barberName}` : ""}
        </span>
      </span>
      {(a.status !== "confirmado" || a.deposit.status === "pendiente") && <StatusChip appointment={a} />}
    </Link>
  );
}

/** Un bloqueo "todo el día" se guarda de 00:00 a 23:59. */
const isAllDay = (b: TimeBlock) => b.start === "00:00" && b.end >= "23:59";

/** "hasta 14:00", "todo el día", "se repite", "hasta el 20/12": lo que se lee en la agenda. */
function blockWhen(b: TimeBlock): string {
  const time = isAllDay(b) ? "todo el día" : `hasta ${b.end}`;
  if (b.weekdays?.length) return `${time} · se repite`;
  if (b.until) return `${time} · hasta el ${b.until.slice(8, 10)}/${b.until.slice(5, 7)}`;
  return time;
}
