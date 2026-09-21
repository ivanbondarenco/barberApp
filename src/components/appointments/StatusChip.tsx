import { cn } from "@/lib/cn";
import type { Appointment } from "@/lib/types";

export function appointmentStatus(a: Appointment): { label: string; className: string } {
  if (a.status === "no_show") return { label: "No vino", className: "bg-error-container text-error" };
  // Una reserva digital que venció sin pagar se cancela sola: conviene distinguirla.
  if (a.status === "cancelado")
    return { label: a.holdExpired ? "Sin pagar" : "Cancelado", className: "bg-error-container text-error" };
  if (a.status === "completado") return { label: "Cobrado", className: "bg-mint text-mint-ink" };
  if (a.deposit.status === "en_revision") return { label: "Seña a confirmar", className: "bg-amber-container text-amber-ink" };
  if (a.deposit.status === "pendiente") return { label: "Seña pendiente", className: "bg-surface-high text-ink" };
  return { label: "Confirmado", className: "bg-primary-fixed text-primary" };
}

export function StatusChip({ appointment, className }: { appointment: Appointment; className?: string }) {
  const s = appointmentStatus(appointment);
  return <span className={cn("chip shrink-0", s.className, className)}>{s.label}</span>;
}
