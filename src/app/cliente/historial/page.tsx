"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { CalendarPlus, History, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusChip } from "@/components/appointments/StatusChip";
import { NAV, Page } from "@/components/motion/Page";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/States";
import { dateTime, dayNumber, monthShort } from "@/lib/dates";
import { listItem } from "@/lib/motion";
import { useAppStore, useCurrentClient } from "@/store/useAppStore";

type Filter = "todos" | "completado" | "cancelado";

const EMPTY_TEXT: Record<Filter, string> = {
  todos: "Acá van a aparecer los turnos que ya pasaron. Los próximos están en Mis turnos.",
  completado: "Todavía no tenés turnos realizados.",
  cancelado: "No tenés turnos cancelados.",
};

export default function HistorialPage() {
  const client = useCurrentClient();
  const appointments = useAppStore((s) => s.appointments);
  const [filter, setFilter] = useState<Filter>("todos");

  // Solo lo que ya pasó: los turnos confirmados por delante se ven en Mis turnos.
  const mine = useMemo(() => {
    const now = Date.now();
    return appointments
      .filter(
        (a) =>
          a.clientId === client?.id &&
          !(a.status === "confirmado" && dateTime(a.date, a.time).getTime() + a.durationMin * 60_000 > now),
      )
      .sort((a, b) => dateTime(b.date, b.time).getTime() - dateTime(a.date, a.time).getTime());
  }, [appointments, client?.id]);
  const visible = filter === "todos" ? mine : mine.filter((a) => a.status === filter);

  return (
    <Page className="gap-4 px-5 pb-6 pt-2">
      <Segmented
        label="Filtro"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "todos", label: "Todos" },
          { value: "completado", label: "Realizados" },
          { value: "cancelado", label: "Cancelados" },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nada por acá"
          text={EMPTY_TEXT[filter]}
          action={
            <Link href="/cliente/reservar" transitionTypes={[...NAV.tab]} className="tap btn-primary px-6">
              <CalendarPlus size={17} aria-hidden /> Reservar turno
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((a, i) => (
              <m.li key={a.id} layout custom={i} variants={listItem} initial="hidden" animate="show" exit="exit" className="flex items-center">
                <Link href={`/cliente/turno/${a.id}`} transitionTypes={[...NAV.forward]} className="row min-w-0 flex-1 pr-2">
                  <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-low leading-none">
                    <span className="text-base font-bold">{dayNumber(a.date)}</span>
                    <span className="text-xs font-medium uppercase text-secondary">{monthShort(a.date)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{a.serviceName}</span>
                    <StatusChip appointment={a} viewer="client" className="mt-0.5" />
                  </span>
                </Link>
                {a.status !== "confirmado" && (
                  <Link
                    href={`/cliente/reservar?servicio=${a.serviceId}&barbero=${a.barberId}`}
                    transitionTypes={[...NAV.tab]}
                    aria-label={`Repetir ${a.serviceName}`}
                    className="icon-btn mr-2 text-primary"
                  >
                    <RotateCcw size={18} />
                  </Link>
                )}
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Page>
  );
}
