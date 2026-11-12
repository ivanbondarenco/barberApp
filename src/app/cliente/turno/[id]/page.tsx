"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { CalendarClock, CalendarPlus, ChevronDown, CircleX, Clock, CreditCard, MessageSquareText, Navigation, Package } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AppointmentTimeline } from "@/components/appointments/AppointmentTimeline";
import { RateAppointment } from "@/components/appointments/RateAppointment";
import { RescheduleSheet } from "@/components/appointments/RescheduleSheet";
import { PayDepositSheet } from "@/components/booking/PayDepositSheet";
import { StatusChip } from "@/components/appointments/StatusChip";
import { depositDeadline, formatDeadline, freeChangeUntil, timeLeft } from "@/components/appointments/useClientAppointments";
import { NAV, Page } from "@/components/motion/Page";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/States";
import { checkInCode, downloadAppointmentIcs, mapsLink } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { hoursUntil, longDate } from "@/lib/dates";
import { money, paymentMethodLabel, whatsappLink } from "@/lib/format";
import { ease, fadeUp } from "@/lib/motion";
import { appointmentDepositPercent, appointmentTotals } from "@/lib/pricing";
import { cancelAppointment } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";
import { useBookingRules } from "@/store/useRules";

export default function ClienteTurnoPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = useAppStore((s) => s.session?.clientId);
  const appointment = useAppStore((s) => s.appointments.find((a) => a.id === id && a.clientId === clientId));
  const barber = useAppStore((s) => s.barbers.find((b) => b.id === appointment?.barberId));
  const info = useAppStore((s) => s.businessInfo);
  const hours = useAppStore((s) => s.businessHours);
  const rules = useBookingRules();

  const [rescheduling, setRescheduling] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);
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
  const inWindow = hoursUntil(appointment.date, appointment.time) >= rules.cancelHours;
  const depositPaid = appointment.deposit.status === "abonada";
  const underReview = appointment.deposit.status === "en_revision";
  // Aunque la haya elegido en efectivo, la seña se puede adelantar online desde acá.
  const canPayOnline = active && !depositPaid && !underReview && t.deposit > 0;
  const deadline = depositDeadline(appointment, hours, rules);
  const freeLeft = freeChangeUntil(appointment, rules.cancelHours).getTime() - Date.now();

  return (
    <Page className="gap-4 px-5 pb-6 pt-2">
      <m.section variants={fadeUp} initial="hidden" animate="show" className="text-center">
        <StatusChip appointment={appointment} viewer="client" />
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
          <span className="flex-1 text-[15px]">Seña {appointmentDepositPercent(appointment)}</span>
          <span className="text-right">
            <span className="block text-[15px] font-semibold tabular-nums">{money(t.deposit)}</span>
            <span className={cn("block text-xs", depositPaid ? "text-mint-ink" : underReview ? "text-amber-ink" : "text-secondary")}>
              {depositPaid
                ? `Abonada · ${paymentMethodLabel[appointment.deposit.method]}`
                : underReview
                  ? "Estamos confirmando tu transferencia"
                  : deadline
                    ? `Aboná la seña antes del ${formatDeadline(deadline)}`
                    : "Pendiente"}
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

      {canPayOnline && (
        <button type="button" onClick={() => setPaying(true)} className="tap btn-primary">
          <CreditCard size={17} /> {appointment.deposit.method === "efectivo" ? "Pagar seña online" : "Pagar seña"} {money(t.deposit)}
        </button>
      )}

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
              disabled={!inWindow}
              aria-describedby="turno-policy"
              onClick={() => setRescheduling(true)}
              className="tap btn-secondary disabled:opacity-50"
            >
              <CalendarClock size={17} /> Reprogramar
            </button>
            <button type="button" onClick={() => setCancelling(true)} className="tap btn-destructive">
              <CircleX size={17} /> Cancelar
            </button>
          </div>
          {/* La regla siempre a la vista: no aparece recién como error después de tocar. */}
          <p id="turno-policy" className={cn("-mt-1 flex items-start gap-2 px-1 text-[13px]", inWindow ? "text-secondary" : "text-amber-ink")}>
            <Clock size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              {inWindow
                ? `Reprogramá o cancelá sin cargo hasta ${rules.cancelHours} h antes · te quedan ${timeLeft(freeLeft)}.`
                : `Faltan menos de ${rules.cancelHours} h: ya no se puede reprogramar.${depositPaid ? " Si cancelás, la seña no se reintegra." : ""}`}
            </span>
          </p>
        </>
      )}

      {appointment.status === "completado" && <RateAppointment appointment={appointment} barberName={barber?.name} />}

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
                <AppointmentTimeline appointment={appointment} viewer="client" />
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <PayDepositSheet appointment={appointment} open={paying} onClose={() => setPaying(false)} />

      <RescheduleSheet appointment={rescheduling ? appointment : null} onClose={() => setRescheduling(false)} />
      <ConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        destructive
        title="¿Cancelar este turno?"
        confirmLabel="Cancelar turno"
        busyLabel="Cancelando…"
        onConfirm={async () => {
          await cancelAppointment(appointment.id, inWindow && depositPaid ? `Cancelado · ${money(t.deposit)} quedan a tu favor` : "Turno cancelado");
        }}
        description={
          inWindow
            ? depositPaid
              ? `Tu seña de ${money(t.deposit)} queda como crédito para tu próxima reserva.`
              : "No se genera ningún cargo."
            : depositPaid
              ? `Faltan menos de ${rules.cancelHours} horas: la seña no se reintegra.`
              : "No se genera ningún cargo."
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
