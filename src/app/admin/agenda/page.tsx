"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { Ban, CalendarX2, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppointmentFormSheet } from "@/components/appointments/AppointmentFormSheet";
import { BlockSheet } from "@/components/appointments/BlockSheet";
import { StatusChip } from "@/components/appointments/StatusChip";
import { NAV, Page } from "@/components/motion/Page";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Fab } from "@/components/ui/Fab";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { dateTime, dayNumber, dayShort, longDate, timeToMinutes, todayISO, workWeek } from "@/lib/dates";
import { money } from "@/lib/format";
import { ease, listItem } from "@/lib/motion";
import { appointmentTotals } from "@/lib/pricing";
import { firstOpenDay, shiftOf } from "@/lib/schedule";
import type { Appointment, TimeBlock } from "@/lib/types";
import { deleteBlock, openCash } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";

type Item = { kind: "appointment"; data: Appointment } | { kind: "block"; data: TimeBlock };
const timeOf = (i: Item) => (i.kind === "appointment" ? i.data.time : i.data.start);

export default function AgendaPage() {
  const router = useRouter();
  const barbers = useAppStore((s) => s.barbers);
  const appointments = useAppStore((s) => s.appointments);
  const blocks = useAppStore((s) => s.blocks);
  const cashRegister = useAppStore((s) => s.cashRegister);
  const session = useAppStore((s) => s.session);
  const isOwner = session?.role === "admin";

  const today = todayISO();
  const hours = useAppStore((s) => s.businessHours);
  // Si hoy el local está cerrado (domingo, por ejemplo), la agenda arranca en el próximo día
  // abierto en vez de mostrar un día vacío y la semana que ya pasó.
  const anchor = useMemo(() => firstOpenDay(today, hours), [today, hours]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [date, setDate] = useState(anchor);
  const [direction, setDirection] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockToDelete, setBlockToDelete] = useState<TimeBlock | null>(null);
  const [cashConfirm, setCashConfirm] = useState(false);

  const week = useMemo(() => workWeek(anchor, weekOffset), [anchor, weekOffset]);

  const mine = useMemo(
    () => (isOwner ? appointments : appointments.filter((a) => a.barberId === session?.barberId)),
    [appointments, isOwner, session?.barberId],
  );
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
  const nowMs = Date.now();

  const selectDay = (d: string) => {
    setDirection(d > date ? 1 : -1);
    setDate(d);
  };

  const groups: { label: string; items: Item[] }[] = [
    { label: "Mañana", items: items.filter((i) => shiftOf(timeOf(i)) === "manana") },
    { label: "Tarde", items: items.filter((i) => shiftOf(timeOf(i)) === "tarde") },
  ].filter((g) => g.items.length);

  return (
    <Page className="pb-28">
      {/* Semana */}
      <div className="px-5 pt-1">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold capitalize">{longDate(date)}</p>
          <div className="flex items-center">
            <button type="button" aria-label="Semana anterior" onClick={() => setWeekOffset((w) => w - 1)} className="icon-btn h-10 w-10 text-secondary">
              <ChevronLeft size={19} />
            </button>
            <button type="button" aria-label="Semana siguiente" onClick={() => setWeekOffset((w) => w + 1)} className="icon-btn h-10 w-10 text-secondary">
              <ChevronRight size={19} />
            </button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Día">
          {week.map((d) => {
            const active = d === date;
            const count = mine.filter((a) => a.date === d && a.status !== "cancelado").length;
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => selectDay(d)}
                className={cn("tap relative flex flex-col items-center rounded-2xl py-2", active ? "text-on-primary" : "text-ink")}
              >
                {active && <m.span layoutId="agenda-day" transition={{ type: "spring", damping: 30, stiffness: 400 }} className="absolute inset-0 rounded-2xl bg-primary shadow-cta" aria-hidden />}
                <span className={cn("relative text-[11px] font-medium", active ? "text-on-primary/80" : "text-secondary")}>{d === today ? "Hoy" : dayShort(d)}</span>
                <span className="relative text-lg font-bold tabular-nums">{dayNumber(d)}</span>
                <span className={cn("relative mt-0.5 h-1 w-1 rounded-full", count ? (active ? "bg-on-primary" : "bg-primary") : "bg-transparent")} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Resumen del día */}
      <div className="mt-4 flex items-center gap-2 px-5">
        <p className="min-w-0 flex-1 truncate text-sm text-secondary">
          <strong className="font-semibold text-ink">{dayAppointments.length} turnos</strong>
          {pending > 0 && <> · {money(pending)} a cobrar</>}
        </p>
        <button type="button" onClick={() => setBlockOpen(true)} aria-label="Bloquear horario" className="icon-btn h-10 w-10 bg-surface-lowest text-secondary shadow-xs">
          <Ban size={15} />
        </button>
        {isOwner && (
          <button
            type="button"
            onClick={() => (cashRegister.open ? router.push("/admin/finanzas/cierre", { transitionTypes: [...NAV.forward] }) : setCashConfirm(true))}
            className={cn("chip min-h-10 px-3", cashRegister.open ? "bg-mint text-mint-ink" : "bg-error-container text-error")}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", cashRegister.open ? "bg-mint-ink" : "bg-error")} />
            {cashRegister.open ? "Caja abierta" : "Caja cerrada"}
          </button>
        )}
      </div>

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
          if (created) setDate(created.date);
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
      <ConfirmDialog
        open={cashConfirm}
        onClose={() => setCashConfirm(false)}
        title="¿Abrir la caja?"
        description="Habilita registrar señas y cobros del día."
        confirmLabel="Abrir caja"
        onConfirm={() => void openCash()}
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
