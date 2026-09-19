"use client";

import {
  Ban,
  Banknote,
  CalendarClock,
  CircleX,
  CreditCard,
  type LucideIcon,
  Package,
  PiggyBank,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { PublicShell } from "@/components/layout/PublicShell";
import { CASH_DEPOSIT_DEADLINE_HOURS, DEPOSIT_RATE, FREE_CANCELLATION_HOURS } from "@/lib/pricing";
import { useAppStore } from "@/store/useAppStore";

interface Policy {
  icon: LucideIcon;
  title: string;
  text: string;
}

const POLICIES: Policy[] = [
  {
    icon: Wallet,
    title: `Seña fija del ${DEPOSIT_RATE * 100}%`,
    text: `Todos los servicios requieren abonar exactamente el ${DEPOSIT_RATE * 100}% de su valor para confirmar el turno. El ${DEPOSIT_RATE * 100}% restante se abona en el sillón.`,
  },
  {
    icon: CreditCard,
    title: "Medios de pago",
    text: "Mercado Pago (dinero en cuenta, débito o crédito) o transferencia al alias D.S.BARBERIA. En el local también aceptamos efectivo.",
  },
  {
    icon: Banknote,
    title: "Seña en efectivo",
    text: `Podés abonarla en recepción hasta ${CASH_DEPOSIT_DEADLINE_HOURS} horas antes del turno. Si no se abona en ese plazo, el horario se libera.`,
  },
  {
    icon: CalendarClock,
    title: "Reprogramación",
    text: `Sin cargo hasta ${FREE_CANCELLATION_HOURS} horas antes, desde Mis Turnos. La seña se mantiene para el nuevo horario.`,
  },
  {
    icon: CircleX,
    title: "Cancelación",
    text: `Con ${FREE_CANCELLATION_HOURS} horas o más de anticipación, la seña abonada queda como crédito a favor. Con menos anticipación, la seña no se reintegra.`,
  },
  {
    icon: PiggyBank,
    title: "Crédito a favor",
    text: "Se aplica automáticamente como seña en tu próxima reserva y tiene una vigencia de 90 días.",
  },
  {
    icon: Ban,
    title: "Ausencias",
    text: "Si no asistís sin avisar, se pierde la seña. Luego de 2 ausencias se solicitará seña digital obligatoria.",
  },
  {
    icon: Package,
    title: "Productos con retiro en sillón",
    text: "Se reservan con tu turno, se entregan durante el servicio y se suman al saldo. Si cancelás, vuelven al stock sin cargo.",
  },
];

export default function PoliticasPage() {
  const session = useAppStore((s) => s.session);

  return (
    <PublicShell
      title="Políticas de Señas"
      fallbackHref={session?.role === "admin" ? "/admin/agenda" : session ? "/cliente/perfil" : "/auth/login"}
      footer={
        <Link href={session?.role === "cliente" ? "/cliente/reservar" : session ? "/admin/agenda" : "/auth/login"} className="tap btn-primary">
          {session?.role === "cliente" ? "Reservar turno" : session ? "Volver a la agenda" : "Iniciar sesión"}
        </Link>
      }
    >
      <div className="flex flex-col gap-2 px-4 py-3">
        <p className="rounded-xl bg-primary px-3 py-2.5 text-xs leading-relaxed text-primary-fixed">
          Trabajamos con turnos exclusivos por sillón. La seña garantiza tu lugar y se descuenta del total del servicio.
        </p>
        <ul className="grid grid-cols-1 gap-2">
          {POLICIES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="card flex gap-2.5 p-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-high text-primary">
                <Icon size={16} />
              </span>
              <div>
                <h2 className="text-[13px] font-bold leading-tight">{title}</h2>
                <p className="mt-0.5 text-[11px] leading-snug text-secondary">{text}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="pb-1 text-center text-[10px] text-secondary">Última actualización: septiembre 2026</p>
      </div>
    </PublicShell>
  );
}
