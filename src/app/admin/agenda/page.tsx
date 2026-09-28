"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { Ban, CalendarPlus, CalendarX2, Lock } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AppointmentFormSheet } from "@/components/appointments/AppointmentFormSheet";
import { BlockSheet } from "@/components/appointments/BlockSheet";
import { StatusChip } from "@/components/appointments/StatusChip";
import { NAV, Page } from "@/components/motion/Page";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Fab } from "@/components/ui/Fab";
import { EmptyState } from "@/components/ui/States";
import { MonthCalendar } from "@/components/ui/MonthCalendar";
import { cn } from "@/lib/cn";
import { dateTime, longDate, timeToMinutes, todayISO } from "@/lib/dates";
import { money } from "@/lib/format";
import { ease, listItem } from "@/lib/motion";
import { appointmentTotals } from "@/lib/pricing";
import { firstOpenDay, openingHours, shiftOf } from "@/lib/schedule";
import type { Appointment, TimeBlock } from "@/lib/types";
import { deleteBlock } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";

type Item = { kind: "appointment"; data: Appointment } | { kind: "block"; data: TimeBlock };
const timeOf = (i: Item) => (i.kind === "appointment" ? i.data.time : i.data.start);

export default function AgendaPage() {
  const barbers = useAppStore((s) => s.barbers);
  const appointments = useAppStore((s) => s.appointments);
  const blocks = useAppStore((s) => s.blocks);
  const session = useAppStore((s) => s.session);
  const isOwner = session?.role === "admin";

  const today = todayISO();
  const hours = useAppStore((s) => s.businessHours);
  // Si hoy el local está cerrado (domingo, por ejemplo), la agenda arranca en el próximo día
  // abierto en vez de mostrar un día vacío y la semana que ya pasó.
  const anchor = useMemo(() => firstOpenDay(today, hours), [today, hours]);
  const [date, setDate] = useState(anchor);
  const [month, setMonth] = useState(anchor);
  const [direction, setDirection] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockToDelete, setBlockToDelete] = useState<TimeBlock | null>(null);

  const mine = useMemo(
    () => (isOwner ? appointments : appointments.filter((a) => a.barberId === session?.barberId)),
    [appointments, isOwner, session?.barberId],
  );
  /** Turnos por día del mes: es el punto que marca cada casilla del calendario. */
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
        ...blocks.filter((b) => b.date === date).map((data) => ({ kind: "block" as const, data })),
      ].sort((a, b) => timeToMinutes(timeOf(a)) - timeToMinutes(timeOf(b))),
    [dayAppointments, blocks, date],
  );
  const pending = dayAppointments.filter((a) => a.status === "confirmado").reduce((n, a) => n + appointmentTotals(a).dueAtChair, 0);
  const opening = openingHours(date, hours);
  const nowMs = Date.now();

  const selectDay = (d: string) => {
    setDirection(d > date ? 1 : -1);
    setDate(d);
    setMonth(d);
  };

  const groups: { label: string; items: Item[] }[] = [
    { label: "Mañana", items: items.filter((i) => shiftOf(timeOf(i)) === "manana") },
    { label: "Tarde", items: items.filter((i) => shiftOf(timeOf(i)) === "tarde") },
  ].filter((g) => g.items.length);

  return (
    <Page className="pb-28">
      {/* Mes completo: de un vistazo se ve qué días tienen turnos. */}
      <div className="px-5 pt-1">
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          selected={date}
          onSelect={selectDay}
          markOf={(iso) => ({ count: countByDay.get(iso) ?? 0 })}
        />
      </div>

      {/* Qué se puede hacer sobre el día elegido */}
      <section className="mt-4 px-5">
        <div className="rounded-2xl bg-surface-lowest p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold capitalize">{longDate(date)}</p>
              <p className="text-[13px] text-secondary">
                {dayAppointments.length} turnos
                {pending > 0 && <> · {money(pending)} a cobrar</>}
                {opening ? <> · abre {opening.open} a {opening.close}</> : <> · cerrado</>}
              </p>
            </div>
            {date !== anchor && (
              <button type="button" onClick={() => selectDay(anchor)} className="chip shrink-0 bg-surface-low px-2.5 py-1.5 text-secondary">
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

      {/* Lista */}
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <m.div
          key={date}
          custom={direction}
          initial={{ opacity: 0, x: direction * 24 }}
          animate={{ opacity: 1, x: 0, transition: { duration: 0.25, ease: ease.enter } }}
          exit={{ opacity: 0, x: direction * -24, transition: { duration: 0.12, ease: ease.exit } }}
          className="mt-4 flex flex-col gap-5 px-5"
        >
          {groups.length === 0 ? (
            <EmptyState icon={CalendarX2} title="Día libre" text="No hay turnos ni bloqueos para este día." />
          ) : (
            groups.map((group) => (
              <section key={group.label}>
                <h2 className="section-title mb-2 px-1">{group.label}</h2>
                <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
                  <AnimatePresence initial={false}>
                    {group.items.map((item, i) =>
                      item.kind === "appointment" ? (
                        <m.li key={item.data.id} layout custom={i} variants={listItem} initial="hidden" animate="show" exit="exit">
                          <AppointmentRow
                            appointment={item.data}
                            barberName={barbers.find((b) => b.id === item.data.barberId)?.name.split(" ")[0]}
                            showBarber={barbers.length > 1}
                            now={nowMs}
                          />
                        </m.li>
                      ) : (
                        <m.li key={item.data.id} layout custom={i} variants={listItem} initial="hidden" animate="show" exit="exit">
                          <button type="button" onClick={() => setBlockToDelete(item.data)} className="row bg-surface-low/60 text-secondary">
                            <span className="w-12 text-sm font-semibold tabular-nums">{item.data.start}</span>
                            <Lock size={16} aria-hidden />
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {item.data.reason} · hasta {item.data.end}
                              {barbers.length > 1 && ` · ${barbers.find((b) => b.id === item.data.barberId)?.name.split(" ")[0] ?? ""}`}
                            </span>
                          </button>
                        </m.li>
                      ),
                    )}
                  </AnimatePresence>
                </ul>
              </section>
            ))
          )}
        </m.div>
      </AnimatePresence>

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
      <ConfirmDialog
        open={!!blockToDelete}
        onClose={() => setBlockToDelete(null)}
        title="¿Quitar bloqueo?"
        description={blockToDelete ? `${blockToDelete.reason} · ${blockToDelete.start}–${blockToDelete.end}. El horario vuelve a estar disponible.` : ""}
        confirmLabel="Quitar"
        onConfirm={async () => {
          if (blockToDelete) await deleteBlock(blockToDelete);
        }}
      />
    </Page>
  );
}

function AppointmentRow({ appointment: a, barberName, showBarber, now }: { appointment: Appointment; barberName?: string; showBarber: boolean; now: number }) {
  const start = dateTime(a.date, a.time).getTime();
  const inProgress = a.status === "confirmado" && now >= start && now < start + a.durationMin * 60_000;
  return (
    <Link href={`/admin/turno/${a.id}`} transitionTypes={[...NAV.forward]} className={cn("row", a.status === "completado" && "opacity-60")}>
      <span className="w-12 shrink-0">
        <span className={cn("block text-[15px] font-bold tabular-nums", inProgress && "text-primary")}>{a.time}</span>
        <span className="block text-[11px] text-secondary">{a.durationMin}m</span>
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
