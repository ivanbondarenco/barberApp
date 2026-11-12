import { BadgeCheck, CalendarClock, CalendarPlus, CircleCheck, CircleX, Hourglass, UserX, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { dayNumber, dayShort, monthShort } from "@/lib/dates";
import { money, paymentMethodLabel } from "@/lib/format";
import { appointmentDepositPercent } from "@/lib/pricing";
import type { Appointment } from "@/lib/types";
import type { AppointmentViewer } from "./StatusChip";

interface Event {
  icon: LucideIcon;
  label: string;
  detail: string;
  at?: string;
  tone: "primary" | "mint" | "error" | "neutral";
}

function stamp(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function AppointmentTimeline({ appointment: a, viewer = "staff" }: { appointment: Appointment; viewer?: AppointmentViewer }) {
  const client = viewer === "client";
  const events: Event[] = [
    {
      icon: CalendarPlus,
      label: a.source === "manual" ? (client ? "Te agendó el local" : "Agendado por el local") : client ? "Reservaste desde la app" : "Reservado desde la app",
      detail: client ? a.serviceName : a.clientName,
      at: a.createdAt,
      tone: "neutral",
    },
  ];
  if (a.deposit.declaredAt && a.deposit.status !== "abonada") {
    events.push({
      icon: Hourglass,
      label: client ? "Avisaste la transferencia" : "Transferencia avisada",
      detail: a.deposit.reference ? `Comprobante ${a.deposit.reference}` : client ? "El local la está confirmando" : "A confirmar por el local",
      at: a.deposit.declaredAt,
      tone: "neutral",
    });
  }
  if (a.deposit.status === "abonada") {
    events.push({
      icon: BadgeCheck,
      label: client ? `Pagaste la seña (${appointmentDepositPercent(a)})` : `Seña ${appointmentDepositPercent(a)} abonada`,
      detail: `${money(a.deposit.amount)} · ${paymentMethodLabel[a.deposit.method]}`,
      at: a.deposit.paidAt,
      tone: "primary",
    });
  }
  if (a.rescheduledFrom) {
    const f = a.rescheduledFrom;
    events.push({
      icon: CalendarClock,
      label: "Reprogramado",
      detail: `Antes: ${dayShort(f.date)} ${dayNumber(f.date)} ${monthShort(f.date)} · ${f.time} hs`,
      at: f.at,
      tone: "neutral",
    });
  }
  if (a.balancePayment) {
    events.push({
      icon: CircleCheck,
      label: client ? "Pagaste el saldo en el local" : "Saldo cobrado en sillón",
      detail: `${money(a.balancePayment.amount)} · ${paymentMethodLabel[a.balancePayment.method]}`,
      at: a.balancePayment.paidAt,
      tone: "mint",
    });
  }
  if (a.status === "cancelado") {
    events.push({
      icon: CircleX,
      label: a.holdExpired ? (client ? "Se liberó el horario" : "Reserva liberada") : "Turno cancelado",
      detail: a.holdExpired
        ? "Venció el plazo para pagar la seña"
        : a.creditIssued
          ? `${client ? "Te quedó crédito a favor" : "Crédito a favor"} ${money(a.creditIssued)}`
          : "Sin reintegro de seña",
      at: a.cancelledAt,
      tone: "error",
    });
  }
  if (a.status === "no_show") {
    events.push({
      icon: UserX,
      label: client ? "No asististe" : "No se presentó",
      detail: a.depositForfeited
        ? `${client ? "El local retuvo la seña de" : "Seña retenida"} ${money(a.depositForfeited)}`
        : "No había seña abonada",
      at: a.noShowAt,
      tone: "error",
    });
  }

  return (
    <ol className="relative flex flex-col gap-2.5 pl-1">
      <span className="absolute bottom-3 left-[15px] top-3 w-px bg-surface-highest" aria-hidden />
      {events.map((e, i) => {
        const Icon = e.icon;
        return (
          <li key={i} className="relative flex items-start gap-2.5">
            <span
              className={cn(
                "z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-2 ring-surface-lowest",
                e.tone === "primary" && "bg-primary text-on-primary",
                e.tone === "mint" && "bg-mint text-mint-ink",
                e.tone === "error" && "bg-error-container text-error",
                e.tone === "neutral" && "bg-surface-high text-primary",
              )}
            >
              <Icon size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold leading-tight">{e.label}</p>
                <span className="shrink-0 text-xs text-secondary">{stamp(e.at)}</span>
              </div>
              <p className="truncate text-xs text-secondary">{e.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function StatusBadge({ appointment: a }: { appointment: Appointment }) {
  if (a.status === "completado")
    return <span className="rounded-full bg-mint px-2 py-0.5 text-xs font-bold uppercase text-mint-ink">Completado</span>;
  if (a.status === "cancelado")
    return <span className="rounded-full bg-error-container px-2 py-0.5 text-xs font-bold uppercase text-error">Cancelado</span>;
  return a.deposit.status === "abonada" ? (
    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold uppercase text-on-primary">Seña {appointmentDepositPercent(a)} abonada</span>
  ) : (
    <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-xs font-bold uppercase text-primary">Seña pendiente</span>
  );
}
