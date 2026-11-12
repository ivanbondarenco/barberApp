"use client";

import { AlertTriangle, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/components/motion/Page";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/types";
import { useBillingStatus } from "./useBillingStatus";

/**
 * Aviso de la suscripción arriba de las pantallas del staff.
 * - Dueño: con la prueba por terminar (7 días o menos), vencida o suspendida. Lleva a pagar.
 * - Barbero: solo suspendida, para que entienda por qué no puede cargar turnos.
 * Suspendida no se puede cerrar: es lo que explica que nada se guarde.
 */
export function BillingBanner({ role }: { role?: Role }) {
  const pathname = usePathname();
  const isStaff = role === "admin" || role === "barbero";
  const info = useBillingStatus(isStaff);
  if (!info || !isStaff) return null;

  const suspended = info.status === "suspended";
  if (role === "barbero" && !suspended) return null;
  if (role === "admin" && !info.attention) return null;
  // En la pantalla de la suscripción el aviso sobra: ya está todo ahí.
  if (pathname === "/admin/suscripcion") return null;

  const days = Math.max(0, info.daysLeft);
  const text =
    role === "barbero"
      ? "La suscripción del local está suspendida: podés ver la agenda, pero no cargar ni cambiar turnos. Avisale al dueño."
      : suspended
        ? "Agenda suspendida: tus clientes no pueden reservar y no se guardan cambios. Tus datos están intactos."
        : info.status === "past_due"
          ? "Tu suscripción está vencida. Pagala para que no se suspenda la agenda."
          : days <= 1
            ? "Tu prueba gratis termina hoy."
            : `Te quedan ${days} días de prueba gratis.`;

  const tone = suspended || info.status === "past_due" ? "bg-error-container text-error" : "bg-amber-container text-amber-ink";
  const Icon = suspended || info.status === "past_due" ? AlertTriangle : Clock;
  const body = (
    <>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug">{text}</span>
      {role === "admin" && (
        <span className="flex shrink-0 items-center gap-0.5 text-[13px] font-bold">
          {suspended ? "Reactivar" : "Suscribirme"}
          <ChevronRight size={16} aria-hidden />
        </span>
      )}
    </>
  );

  return (
    <div className="shrink-0 px-4 pt-2" role={suspended ? "alert" : "status"}>
      {role === "admin" ? (
        <Link
          href="/admin/suscripcion"
          transitionTypes={[...NAV.forward]}
          className={cn("tap flex min-h-11 items-start gap-2.5 rounded-2xl px-3.5 py-2.5", tone)}
        >
          {body}
        </Link>
      ) : (
        <div className={cn("flex items-start gap-2.5 rounded-2xl px-3.5 py-2.5", tone)}>{body}</div>
      )}
    </div>
  );
}
