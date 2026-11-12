import { cn } from "@/lib/cn";
import type { Appointment } from "@/lib/types";

/** Quién mira el turno: el staff habla de cobros y ausencias; el cliente, de lo que le pasó a él. */
export type AppointmentViewer = "client" | "staff";

export function appointmentStatus(a: Appointment, viewer: AppointmentViewer = "staff"): { label: string; className: string } {
  const client = viewer === "client";
  if (a.status === "no_show") return { label: client ? "No asististe" : "No vino", className: "bg-error-container text-error" };
  // Una reserva digital que venció sin pagar se cancela sola: conviene distinguirla.
  if (a.status === "cancelado")
    return { label: a.holdExpired ? (client ? "Venció sin pagar" : "Sin pagar") : "Cancelado", className: "bg-error-container text-error" };
  if (a.status === "completado") return { label: client ? "Realizado" : "Cobrado", className: "bg-mint text-mint-ink" };
  if (a.deposit.status === "en_revision") return { label: "Seña a confirmar", className: "bg-amber-container text-amber-ink" };
  if (a.deposit.status === "pendiente") return { label: "Seña pendiente", className: "bg-surface-high text-ink" };
  return { label: "Confirmado", className: "bg-primary-fixed text-primary" };
}

export function StatusChip({
  appointment,
  className,
  viewer = "staff",
}: {
  appointment: Appointment;
  className?: string;
  viewer?: AppointmentViewer;
}) {
  const s = appointmentStatus(appointment, viewer);
  return <span className={cn("chip shrink-0", s.className, className)}>{s.label}</span>;
}
