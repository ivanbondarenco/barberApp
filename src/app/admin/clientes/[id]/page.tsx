"use client";

import * as m from "motion/react-m";
import { CalendarPlus, ChevronRight, NotebookPen, Pencil, Phone, Smartphone, UserX } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ClientFormSheet } from "@/components/admin/ClientFormSheet";
import { AppointmentFormSheet } from "@/components/appointments/AppointmentFormSheet";
import { StatusChip } from "@/components/appointments/StatusChip";
import { NAV, Page } from "@/components/motion/Page";
import { EmptyState, Section } from "@/components/ui/States";
import { summarizeClient } from "@/lib/clients";
import { dayNumber, longDate, monthShort } from "@/lib/dates";
import { initials, money, whatsappLink } from "@/lib/format";
import { fadeUp, listItem } from "@/lib/motion";
import { useAppStore } from "@/store/useAppStore";

export default function FichaClientePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const profile = useAppStore((s) => s.clients.find((c) => c.id === id));
  const appointments = useAppStore((s) => s.appointments);
  const info = useAppStore((s) => s.businessInfo);
  const [editOpen, setEditOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);

  const summary = useMemo(() => (profile ? summarizeClient(profile, appointments) : null), [profile, appointments]);

  if (!profile || !summary) {
    return (
      <Page className="px-5">
        <EmptyState
          icon={UserX}
          title="Cliente no encontrado"
          action={
            <Link href="/admin/clientes" transitionTypes={[...NAV.back]} className="tap btn-primary px-6">
              Ver clientes
            </Link>
          }
        />
      </Page>
    );
  }

  return (
    <Page className="gap-5 px-5 pb-6 pt-2">
      <m.section variants={fadeUp} initial="hidden" animate="show" className="flex flex-col items-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-on-primary">{initials(profile.name)}</span>
        <h2 className="mt-3 text-xl font-bold tracking-tight">{profile.name}</h2>
        <p className="text-sm text-secondary">
          {profile.phone}
          {profile.hasAccount ? " · usa la app" : ""}
        </p>
        <div className="mt-4 grid w-full grid-cols-4 gap-2">
          <Action icon={Phone} label="Llamar" href={`tel:${profile.phone.replace(/\s/g, "")}`} />
          <Action icon={Smartphone} label="WhatsApp" href={whatsappLink(profile.phone, `Hola ${profile.name.split(" ")[0]}, te escribimos de ${info.name}.`)} />
          <Action icon={CalendarPlus} label="Turno" onClick={() => setBookOpen(true)} />
          <Action icon={Pencil} label="Editar" onClick={() => setEditOpen(true)} />
        </div>
      </m.section>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-lowest p-4 text-center shadow-xs">
        <Stat label="Visitas" value={String(summary.visits)} />
        <Stat label="Ticket" value={money(summary.averageTicket)} />
        <Stat label="Crédito" value={money(profile.credit)} />
      </div>

      {summary.nextAppointment && (
        <Link href={`/admin/turno/${summary.nextAppointment.id}`} transitionTypes={[...NAV.forward]} className="tap row rounded-2xl bg-primary text-on-primary shadow-cta">
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-primary-fixed">Próximo turno</span>
            <span className="block truncate text-[15px] font-semibold capitalize">
              {longDate(summary.nextAppointment.date)} · {summary.nextAppointment.time}
            </span>
          </span>
          <ChevronRight size={18} aria-hidden />
        </Link>
      )}

      {(profile.internalNotes || profile.preferences) && (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface-lowest p-4 text-[15px] shadow-xs">
          {profile.preferences && (
            <p>
              <span className="block text-[13px] text-secondary">Preferencias</span>
              {profile.preferences}
            </p>
          )}
          {profile.internalNotes && (
            <p className="flex items-start gap-2">
              <NotebookPen size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden />
              {profile.internalNotes}
            </p>
          )}
        </div>
      )}

      <Section title="Historial">
        {summary.appointments.length === 0 ? (
          <p className="rounded-2xl bg-surface-lowest px-4 py-5 text-center text-sm text-secondary shadow-xs">Todavía no tiene turnos.</p>
        ) : (
          <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
            {summary.appointments.slice(0, 12).map((a, i) => (
              <m.li key={a.id} custom={i} variants={listItem} initial="hidden" animate="show">
                <Link href={`/admin/turno/${a.id}`} transitionTypes={[...NAV.forward]} className="row">
                  <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-low leading-none">
                    <span className="text-base font-bold">{dayNumber(a.date)}</span>
                    <span className="text-[10px] uppercase text-secondary">{monthShort(a.date)}</span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px]">{a.serviceName}</span>
                  <StatusChip appointment={a} />
                </Link>
              </m.li>
            ))}
          </ul>
        )}
      </Section>

      <ClientFormSheet open={editOpen} client={profile} onClose={() => setEditOpen(false)} onDeleted={() => router.replace("/admin/clientes", { transitionTypes: [...NAV.back] })} />
      <AppointmentFormSheet open={bookOpen} onClose={() => setBookOpen(false)} prefill={{ clientId: profile.id, clientName: profile.name, clientPhone: profile.phone }} />
    </Page>
  );
}

function Action({ icon: Icon, label, href, onClick }: { icon: typeof Phone; label: string; href?: string; onClick?: () => void }) {
  const cls = "tap flex flex-col items-center gap-1.5 rounded-2xl bg-surface-lowest py-3 text-xs font-medium shadow-xs";
  const inner = (
    <>
      <Icon size={20} className="text-primary" aria-hidden />
      {label}
    </>
  );
  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-secondary">{label}</p>
      <p className="font-bold tabular-nums">{value}</p>
    </div>
  );
}
