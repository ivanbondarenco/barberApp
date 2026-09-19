"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { CalendarClock, CalendarPlus, ChevronDown, CircleX, MessageSquareText, Navigation, Package } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AppointmentTimeline } from "@/components/appointments/AppointmentTimeline";
import { RescheduleSheet } from "@/components/appointments/RescheduleSheet";
import { StatusChip } from "@/components/appointments/StatusChip";
import { NAV, Page } from "@/components/motion/Page";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/States";
import { checkInCode, downloadAppointmentIcs, mapsLink } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { hoursUntil, longDate } from "@/lib/dates";
import { money, paymentMethodLabel, whatsappLink } from "@/lib/format";
import { ease, fadeUp } from "@/lib/motion";
import { appointmentTotals, FREE_CANCELLATION_HOURS } from "@/lib/pricing";
import { cancelAppointment } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

export default function ClienteTurnoPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = useAppStore((s) => s.session?.clientId);
  const appointment = useAppStore((s) => s.appointments.find((a) => a.id === id && a.clientId === clientId));
  const barber = useAppStore((s) => s.barbers.find((b) => b.id === appointment?.barberId));
  const info = useAppStore((s) => s.businessInfo);

  const [rescheduling, setRescheduling] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  if (!appointment) {
    return (
      <Page className="px-5">
        <EmptyState
          icon={CircleX}
          title="No encontramos este turno"
          action={
            <Link href="/cliente/mis-turnos" transitionTypes={[...NAV.back]} className="tap btn-primary px-6">
              Mis turnos
            </Link>
          }
        />
      </Page>
    );
  }

  const t = appointmentTotals(appointment);
  const active = appointment.status === "confirmado";
  const inWindow = hoursUntil(appointment.date, appointment.time) >= FREE_CANCELLATION_HOURS;
  const depositPaid = appointment.deposit.status === "abonada";

  return (
    <Page className="gap-4 px-5 pb-6 pt-2">
      <m.section variants={fadeUp} initial="hidden" animate="show" className="text-center">
        <StatusChip appointment={appointment} />
        <p className="mt-3 text-[15px] capitalize text-secondary">{longDate(appointment.date)}</p>
        <p className="text-6xl font-bold tracking-tight tabular-nums">{appointment.time}</p>
        <p className="mt-1 text-lg font-semibold">{appointment.serviceName}</p>
        <p className="text-sm text-secondary">
          con {barber?.name} · {appointment.durationMin} min
        </p>
        {active && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-surface-lowest px-3 py-1.5 text-xs text-secondary shadow-xs">
            Código de recepción <span className="font-mono text-sm font-bold tracking-wider text-primary">{checkInCode(appointment.id)}</span>
          </p>
        )}
      </m.section>

      <div className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
        <div className="row">
          <span className="flex-1 text-[15px]">Seña 50%</span>
          <span className="text-right">
            <span className="block text-[15px] font-semibold tabular-nums">{money(t.deposit)}</span>
            <span className={cn("block text-xs", depositPaid ? "text-mint-ink" : "text-secondary")}>
              {depositPaid ? `Abonada · ${paymentMethodLabel[appointment.deposit.method]}` : "Pendiente"}
            </span>
          </span>
        </div>
        {appointment.products.length > 0 && (
          <div className="row">
            <Package size={18} className="text-secondary" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[15px]">
              {appointment.products.map((p) => `${p.name}${p.qty > 1 ? ` ×${p.qty}` : ""}`).join(", ")}
            </span>
            <span className="text-[15px] font-semibold tabular-nums">{money(t.products)}</span>
          </div>
        )}
        <div className="row">
          <span className="flex-1 text-[15px] font-semibold">{appointment.status === "completado" ? "Pagado en el sillón" : "A pagar en el sillón"}</span>
          <span className="text-lg font-bold tabular-nums">
            {money(appointment.status === "completado" ? appointment.balancePayment?.amount ?? 0 : t.dueAtChair)}
          </span>
        </div>
      </div>

      {active && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <QuickAction icon={CalendarPlus} label="Calendario" onClick={() => downloadAppointmentIcs(appointment, info)} />
            <QuickAction icon={Navigation} label="Cómo llegar" href={mapsLink(info)} />
            <QuickAction icon={MessageSquareText} label="WhatsApp" href={whatsappLink(info.whatsapp, `Hola, tengo turno el ${longDate(appointment.date)} a las ${appointment.time}`)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => (inWindow ? setRescheduling(true) : toast(`Solo podés reprogramar hasta ${FREE_CANCELLATION_HOURS}h antes`, "error"))}
              className="tap btn-secondary"
            >
              <CalendarClock size={17} /> Reprogramar
            </button>
            <button type="button" onClick={() => setCancelling(true)} className="tap btn-destructive">
              <CircleX size={17} /> Cancelar
            </button>
          </div>
        </>
      )}

      {!active && (
        <Link
          href={`/cliente/reservar?servicio=${appointment.serviceId}&barbero=${appointment.barberId}`}
          transitionTypes={[...NAV.tab]}
          className="tap btn-primary"
        >
          Reservar de nuevo
        </Link>
      )}

      <div>
        <button type="button" onClick={() => setActivityOpen((v) => !v)} className="flex min-h-11 w-full items-center justify-between px-1 text-sm font-semibold text-secondary">
          Actividad del turno
          <ChevronDown size={18} className={cn("transition-transform", activityOpen && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {activityOpen && (
            <m.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: ease.standard }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl bg-surface-lowest p-4 shadow-xs">
                <AppointmentTimeline appointment={appointment} />
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <RescheduleSheet appointment={rescheduling ? appointment : null} onClose={() => setRescheduling(false)} />
      <ConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        destructive
        title="¿Cancelar este turno?"
        confirmLabel="Cancelar turno"
        onConfirm={async () => {
          await cancelAppointment(appointment.id, inWindow && depositPaid ? `Cancelado · ${money(t.deposit)} quedan a tu favor` : "Turno cancelado");
        }}
        description={
          inWindow
            ? depositPaid
              ? `Tu seña de ${money(t.deposit)} queda como crédito para tu próxima reserva.`
              : "No se genera ningún cargo."
            : `Faltan menos de ${FREE_CANCELLATION_HOURS} horas: la seña no se reintegra.`
        }
      />
    </Page>
  );
}

function QuickAction({ icon: Icon, label, href, onClick }: { icon: typeof Navigation; label: string; href?: string; onClick?: () => void }) {
  const cls = "tap flex flex-col items-center gap-1.5 rounded-2xl bg-surface-lowest py-3 text-xs font-medium shadow-xs";
  const content = (
    <>
      <Icon size={20} className="text-primary" aria-hidden /> {label}
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {content}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  );
}
