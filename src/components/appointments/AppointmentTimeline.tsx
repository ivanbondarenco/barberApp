import { BadgeCheck, CalendarClock, CalendarPlus, CircleCheck, CircleX, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { dayNumber, dayShort, monthShort } from "@/lib/dates";
import { money, paymentMethodLabel } from "@/lib/format";
import type { Appointment } from "@/lib/types";

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

export function AppointmentTimeline({ appointment: a }: { appointment: Appointment }) {
  const events: Event[] = [
    {
      icon: CalendarPlus,
      label: a.source === "manual" ? "Agendado por el local" : "Reservado desde la app",
      detail: a.clientName,
      at: a.createdAt,
      tone: "neutral",
    },
  ];
  if (a.deposit.status === "abonada") {
    events.push({
      icon: BadgeCheck,
      label: "Seña 50% abonada",
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
      label: "Saldo cobrado en sillón",
      detail: `${money(a.balancePayment.amount)} · ${paymentMethodLabel[a.balancePayment.method]}`,
      at: a.balancePayment.paidAt,
      tone: "mint",
    });
  }
  if (a.status === "cancelado") {
    events.push({
      icon: CircleX,
      label: "Turno cancelado",
      detail: a.creditIssued ? `Crédito a favor ${money(a.creditIssued)}` : "Sin reintegro de seña",
      at: a.cancelledAt,
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
                <p className="text-[13px] font-semibold leading-tight">{e.label}</p>
                <span className="shrink-0 text-[10px] text-secondary">{stamp(e.at)}</span>
              </div>
              <p className="truncate text-[11px] text-secondary">{e.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function StatusBadge({ appointment: a }: { appointment: Appointment }) {
  if (a.status === "completado")
    return <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-bold uppercase text-mint-ink">Completado</span>;
  if (a.status === "cancelado")
    return <span className="rounded-full bg-error-container px-2 py-0.5 text-[10px] font-bold uppercase text-error">Cancelado</span>;
  return a.deposit.status === "abonada" ? (
    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-on-primary">Seña 50% abonada</span>
  ) : (
    <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-[10px] font-bold uppercase text-primary">Seña pendiente</span>
  );
}
