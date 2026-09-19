"use client";

import * as m from "motion/react-m";
import { CalendarPlus, ChevronRight, History, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { StatusChip } from "@/components/appointments/StatusChip";
import { useClientAppointments } from "@/components/appointments/useClientAppointments";
import { NAV, Page } from "@/components/motion/Page";
import { EmptyState, Section } from "@/components/ui/States";
import { dayNumber, dayShort, longDate } from "@/lib/dates";
import { money } from "@/lib/format";
import { fadeUp, listItem } from "@/lib/motion";
import { appointmentTotals } from "@/lib/pricing";
import { useAppStore, useCurrentClient } from "@/store/useAppStore";

export default function MisTurnosPage() {
  const barbers = useAppStore((s) => s.barbers);
  const client = useCurrentClient();
  const { upcoming, next } = useClientAppointments();
  const others = upcoming.slice(1);

  if (!next) {
    return (
      <Page className="px-5">
        <EmptyState
          icon={CalendarPlus}
          title="No tenés turnos próximos"
          text={client?.credit ? `Tenés ${money(client.credit)} de crédito para tu próxima seña.` : "Reservá tu próximo corte en menos de un minuto."}
          action={
            <Link href="/cliente/reservar" transitionTypes={[...NAV.tab]} className="tap btn-primary px-6">
              Reservar turno
            </Link>
          }
        />
        <Link href="/cliente/historial" transitionTypes={[...NAV.forward]} className="mx-auto flex items-center gap-1.5 text-sm font-semibold text-primary">
          <History size={16} /> Ver historial
        </Link>
      </Page>
    );
  }

  const barber = barbers.find((b) => b.id === next.barberId);
  const t = appointmentTotals(next);

  return (
    <Page className="gap-6 px-5 pb-6 pt-2">
      <m.div variants={fadeUp} initial="hidden" animate="show">
        <Link
          href={`/cliente/turno/${next.id}`}
          transitionTypes={[...NAV.forward]}
          className="tap block overflow-hidden rounded-3xl bg-primary p-5 text-on-primary shadow-cta"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-primary-fixed">Tu próximo turno</span>
            <StatusChip appointment={next} className="bg-on-primary/15 text-on-primary" />
          </div>
          <p className="mt-3 text-[15px] capitalize text-primary-fixed">{longDate(next.date)}</p>
          <p className="text-5xl font-bold tracking-tight tabular-nums">{next.time}</p>
          <p className="mt-2 text-[17px] font-semibold">{next.serviceName}</p>
          <div className="mt-4 flex items-center justify-between border-t border-on-primary/15 pt-3 text-sm">
            <span className="text-primary-fixed">con {barber?.name}</span>
            <span className="flex items-center gap-1 font-semibold">
              Resta {money(t.dueAtChair)} <ChevronRight size={16} />
            </span>
          </div>
        </Link>
      </m.div>

      {others.length > 0 && (
        <Section title="Próximos">
          <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
            {others.map((a, i) => (
              <m.li key={a.id} custom={i} variants={listItem} initial="hidden" animate="show">
                <Link href={`/cliente/turno/${a.id}`} transitionTypes={[...NAV.forward]} className="row">
                  <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-low leading-none">
                    <span className="text-[10px] font-medium uppercase text-secondary">{dayShort(a.date)}</span>
                    <span className="text-base font-bold">{dayNumber(a.date)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{a.serviceName}</span>
                    <span className="block text-[13px] text-secondary">{a.time} hs</span>
                  </span>
                  <ChevronRight size={18} className="text-secondary" aria-hidden />
                </Link>
              </m.li>
            ))}
          </ul>
        </Section>
      )}

      <div className="flex flex-col gap-2">
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
