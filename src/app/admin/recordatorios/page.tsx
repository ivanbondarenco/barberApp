"use client";

import * as m from "motion/react-m";
import { BellRing, Check, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusChip } from "@/components/appointments/StatusChip";
import { NAV, Page } from "@/components/motion/Page";
import { EmptyState, Section } from "@/components/ui/States";
import { dayNumber, dayShort, todayISO } from "@/lib/dates";
import { whatsappLink } from "@/lib/format";
import { listItem } from "@/lib/motion";
import { pendingReminders, reminderMessage } from "@/lib/reminders";
import { markReminderSent } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";

/**
 * Recordatorios del día siguiente, listos para mandar por WhatsApp.
 *
 * Mientras no esté la WhatsApp Cloud API, el envío es de un toque: se abre el chat con el
 * mensaje escrito y al volver se marca como enviado. La cola se calcula sola desde la agenda.
 */
export default function AdminRecordatoriosPage() {
  const appointments = useAppStore((s) => s.appointments);
  const clients = useAppStore((s) => s.clients);
  const info = useAppStore((s) => s.businessInfo);
  const [sending, setSending] = useState<string | null>(null);
  const today = todayISO();

  const pending = useMemo(() => pendingReminders(appointments, clients), [appointments, clients]);
  const sent = useMemo(
    () =>
      appointments
        .filter((a) => a.reminderSentAt && a.status === "confirmado" && a.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
    [appointments, today],
  );

  return (
    <Page className="gap-5 px-5 pb-6 pt-2">
      <div className="rounded-2xl bg-surface-lowest p-4 shadow-xs">
        <p className="text-[13px] text-secondary">Por avisar</p>
        <p className="text-3xl font-bold tabular-nums">{pending.length}</p>
        <p className="mt-1 text-[13px] text-secondary">
          Turnos de las próximas 24 h cuyo cliente pidió recordatorio y todavía no recibió el aviso.
        </p>
      </div>

      <Section title="Pendientes de aviso">
        {pending.length === 0 ? (
          <EmptyState icon={BellRing} title="Todo avisado" text="No hay recordatorios pendientes para las próximas 24 horas." className="py-6" />
        ) : (
          <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
            {pending.map((r, i) => {
              const a = r.appointment;
              return (
                <m.li key={a.id} custom={i} variants={listItem} initial="hidden" animate="show" className="row">
                  <Link href={`/admin/turno/${a.id}`} transitionTypes={[...NAV.forward]} className="min-w-0 flex-1 py-1">
                    <span className="block truncate text-[15px] font-medium">{a.clientName}</span>
                    <span className="block truncate text-[13px] text-secondary">
                      {a.date === today ? "Hoy" : `${dayShort(a.date)} ${dayNumber(a.date)}`} {a.time} · {a.serviceName}
                    </span>
                  </Link>
                  {r.depositPending && <StatusChip appointment={a} />}
                  <a
                    href={whatsappLink(a.clientPhone, reminderMessage(r, info))}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Avisar a ${a.clientName} por WhatsApp`}
                    onClick={() => setSending(a.id)}
                    className="icon-btn bg-surface-low text-primary"
                  >
                    <MessageSquareText size={18} />
                  </a>
                  <button
                    type="button"
                    aria-label={`Marcar como avisado a ${a.clientName}`}
                    onClick={() => void markReminderSent(a.id)}
                    className={cnHighlight(sending === a.id)}
                  >
                    <Check size={18} />
                  </button>
                </m.li>
              );
            })}
          </ul>
        )}
      </Section>

      {sent.length > 0 && (
        <Section title="Ya avisados">
          <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
            {sent.map((a) => (
              <li key={a.id} className="row">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{a.clientName}</span>
                  <span className="block truncate text-[13px] text-secondary">
                    {a.date === today ? "Hoy" : `${dayShort(a.date)} ${dayNumber(a.date)}`} {a.time} · {a.serviceName}
                  </span>
                </span>
                <Check size={18} className="text-mint-ink" aria-hidden />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Page>
  );
}

/** Resalta el tilde apenas se abrió WhatsApp, que es cuando corresponde marcarlo. */
function cnHighlight(active: boolean): string {
  return active ? "icon-btn bg-primary text-on-primary" : "icon-btn bg-surface-low text-secondary";
}
