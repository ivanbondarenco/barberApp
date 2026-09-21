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
import { CASH_DEPOSIT_DEADLINE_HOURS, FREE_CANCELLATION_HOURS, NO_SHOW_DEPOSIT_LIMIT } from "@/lib/pricing";
import { useAppStore } from "@/store/useAppStore";

interface Policy {
  icon: LucideIcon;
  title: string;
  text: string;
}

/**
 * Las políticas se arman con la configuración real del local: la seña que cobra, si acepta
 * efectivo y sus datos de transferencia. Publicar una regla que el sistema no aplica es peor
 * que no publicar nada.
 */
function buildPolicies(opts: {
  rate: number;
  allowCash: boolean;
  transferAlias: string;
  noShowLimit: number;
}): Policy[] {
  const pct = Math.round(opts.rate * 100);
  const list: Policy[] = [];

  list.push(
    opts.rate > 0
      ? {
          icon: Wallet,
          title: `Seña del ${pct}%`,
          text: `Para confirmar el turno se abona el ${pct}% del valor del servicio. El ${100 - pct}% restante se abona en el sillón.`,
        }
      : {
          icon: Wallet,
          title: "Reservá sin seña",
          text: "Este local no pide seña para confirmar el turno. El servicio se abona completo en el sillón.",
        },
  );

  if (opts.rate > 0) {
    list.push({
      icon: CreditCard,
      title: "Medios de pago",
      text: `Mercado Pago (dinero en cuenta, débito o crédito) o transferencia${opts.transferAlias ? ` al alias ${opts.transferAlias}` : ""}. En el local también aceptamos efectivo.`,
    });
    if (opts.allowCash) {
      list.push({
        icon: Banknote,
        title: "Seña en efectivo",
        text: `Podés abonarla en recepción hasta ${CASH_DEPOSIT_DEADLINE_HOURS} horas antes del turno. Si no se abona en ese plazo, el horario se libera.`,
      });
    }
  }

  list.push({
    icon: CalendarClock,
    title: "Reprogramación",
    text: `Sin cargo hasta ${FREE_CANCELLATION_HOURS} horas antes, desde Mis Turnos.${opts.rate > 0 ? " La seña se mantiene para el nuevo horario." : ""}`,
  });

  if (opts.rate > 0) {
    list.push(
      {
        icon: CircleX,
        title: "Cancelación",
        text: `Con ${FREE_CANCELLATION_HOURS} horas o más de anticipación, la seña abonada queda como crédito a favor. Con menos anticipación, la seña no se reintegra.`,
      },
      {
        icon: PiggyBank,
        title: "Crédito a favor",
        text: "Se aplica como seña en tu próxima reserva, desde la pantalla de pago.",
      },
      {
        icon: Ban,
        title: "Ausencias",
        text: `Si no asistís sin avisar, la seña queda para el local. Luego de ${opts.noShowLimit} ausencias, este local solo te va a aceptar reservas con la seña abonada por adelantado.`,
      },
    );
  } else {
    list.push({
      icon: Ban,
      title: "Ausencias",
      text: "Si no podés venir, avisanos así liberamos el horario para otra persona.",
    });
  }

  list.push({
    icon: Package,
    title: "Productos con retiro en sillón",
    text: "Se reservan con tu turno, se entregan durante el servicio y se suman al saldo. Si cancelás, vuelven al stock sin cargo.",
  });

  return list;
}

export default function PoliticasPage() {
  const session = useAppStore((s) => s.session);
  const { allowCash, rate } = useAppStore((s) => s.depositSettings);
  const info = useAppStore((s) => s.businessInfo);
  const policies = buildPolicies({
    rate,
    allowCash,
    transferAlias: info.transferAlias,
    noShowLimit: NO_SHOW_DEPOSIT_LIMIT,
  });

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
          {rate > 0
            ? "Trabajamos con turnos exclusivos por sillón. La seña garantiza tu lugar y se descuenta del total del servicio."
            : "Trabajamos con turnos exclusivos por sillón. Reservá tu horario y aboná al finalizar el servicio."}
        </p>
        <ul className="grid grid-cols-1 gap-2">
          {policies.map(({ icon: Icon, title, text }) => (
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
      </div>
    </PublicShell>
  );
}
