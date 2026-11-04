"use client";

import * as m from "motion/react-m";
import { CalendarPlus, CreditCard, History, MessageCircle, RefreshCw, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { PublicShell } from "@/components/layout/PublicShell";
import { NAV } from "@/components/motion/Page";
import { SuccessCheck } from "@/components/motion/SuccessCheck";
import { EmptyState, SkeletonList } from "@/components/ui/States";
import { downloadAppointmentIcs } from "@/lib/calendar";
import { dayNumber, dayShort, longDate, toISODate } from "@/lib/dates";
import { money, whatsappLink } from "@/lib/format";
import { fadeUp } from "@/lib/motion";
import { CASH_DEPOSIT_DEADLINE_HOURS } from "@/lib/pricing";
import { cashDepositDeadline } from "@/lib/schedule";
import type { Appointment, BusinessInfo, Shop } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

type GuestAppointment = Pick<
  Appointment,
  "id" | "clientName" | "barberId" | "serviceName" | "servicePrice" | "durationMin" | "date" | "time" | "status" | "deposit" | "holdUntil"
>;
interface GuestBooking {
  appointment: GuestAppointment;
  info: BusinessInfo;
  shop: Pick<Shop, "name" | "slug"> | null;
}

export default function ReservaResultadoPage() {
  return (
    <Suspense>
      <ReservaResultado />
    </Suspense>
  );
}

/**
 * Cómo quedó una reserva hecha sin cuenta. Es también la vuelta de Mercado Pago (back_urls).
 * El turno se lee con el token que recibió al reservar: sin sesión, es lo único que lo identifica.
 */
function ReservaResultado() {
  const { estado } = useParams<{ estado: string }>();
  const params = useSearchParams();
  const turno = params.get("turno") ?? "";
  const token = params.get("t") ?? "";
  const hours = useAppStore((s) => s.businessHours);
  const barbers = useAppStore((s) => s.barbers);
  const [data, setData] = useState<GuestBooking | null>(null);
  const [missing, setMissing] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservas?turno=${encodeURIComponent(turno)}&t=${encodeURIComponent(token)}`, { cache: "no-store" });
      if (res.status === 404) return setMissing(true);
      if (res.ok) setData((await res.json()) as GuestBooking);
    } catch {
      // Sin conexión: se reintenta en el próximo ciclo.
    }
  }, [turno, token]);

  const appointment = data?.appointment;
  // Volvió de Mercado Pago aprobado pero el webhook todavía no acreditó: se consulta hasta que llegue.
  const waitingPayment = !!appointment && appointment.deposit.method === "mercadopago" && appointment.deposit.status === "pendiente";

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!waitingPayment) return;
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [waitingPayment, load]);

  const pay = async () => {
    setPaying(true);
    try {
      const res = await fetch("/api/reservas/pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turno, t: token }),
      });
      const body = (await res.json().catch(() => ({}))) as { initPoint?: string; error?: string };
      if (body.initPoint) {
        window.location.href = body.initPoint;
        return;
      }
      toast(body.error ?? "No pudimos abrir el pago", "error");
      void load();
    } catch {
      toast("Sin conexión. Revisá tu internet.", "error");
    }
    setPaying(false);
  };

  if (missing) {
    return (
      <PublicShell title="Tu reserva" fallbackHref="/reservar">
        <EmptyState icon={CalendarPlus} title="No encontramos esta reserva" text="Si ya reservaste, escribile al local para confirmarlo." />
      </PublicShell>
    );
  }
  if (!data || !appointment) {
    return (
      <PublicShell title="Tu reserva" fallbackHref="/reservar">
        <SkeletonList />
      </PublicShell>
    );
  }

  const { info } = data;
  const barber = barbers.find((b) => b.id === appointment.barberId);
  const paid = appointment.deposit.status === "abonada";
  const cancelled = appointment.status !== "confirmado";
  const balance = appointment.servicePrice - (paid ? appointment.deposit.amount : 0);
  const deadline = cashDepositDeadline(appointment.date, appointment.time, hours, CASH_DEPOSIT_DEADLINE_HOURS);
  const deadlineText = `${dayShort(toISODate(deadline))} ${dayNumber(toISODate(deadline))} a las ${deadline.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })} hs`;

  // El estado de la URL es lo que dijo Mercado Pago al volver; manda lo que diga el turno.
  const state: "exito" | "pendiente" | "error" = cancelled
    ? "error"
    : paid
      ? "exito"
      : estado === "error"
        ? "error"
        : estado === "exito" && appointment.deposit.method === "mercadopago"
          ? "exito"
          : "pendiente";

  const copy = {
    exito: {
      title: paid ? "¡Listo, te esperamos!" : "¡Turno reservado!",
      text: paid
        ? appointment.deposit.amount > 0
          ? "La seña quedó abonada. Te esperamos."
          : "No hace falta seña: abonás todo en el local."
        : "Estamos confirmando el pago con Mercado Pago. Puede tardar un minuto.",
    },
    pendiente: {
      title: "Turno reservado",
      text:
        appointment.deposit.method === "efectivo"
          ? `Aboná la seña de ${money(appointment.deposit.amount)} en el local antes del ${deadlineText}.`
          : `Todavía no nos llegó la seña de ${money(appointment.deposit.amount)}. Si ya pagaste, puede demorar unos minutos.`,
    },
    error: {
      title: cancelled ? "La reserva se venció" : "El pago no se completó",
      text: cancelled
        ? "No se acreditó la seña a tiempo y el horario se liberó. Podés reservar de nuevo."
        : "No se cobró nada. Tu horario queda reservado unos minutos más: podés reintentar el pago.",
    },
  }[state];

  const canPay = !cancelled && !paid && appointment.deposit.amount > 0 && appointment.deposit.method === "mercadopago";

  return (
    <PublicShell title={data.shop?.name ?? info.name} fallbackHref="/reservar">
      <div className="flex flex-1 flex-col px-5 pb-5 pt-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <SuccessCheck tone={state === "exito" ? "success" : state === "pendiente" ? "pending" : "error"} />
          <m.h2 variants={fadeUp} initial="hidden" animate="show" className="page-title mt-2">
            {copy.title}
          </m.h2>
          <m.p variants={fadeUp} initial="hidden" animate="show" className="max-w-80 text-[15px] text-secondary">
            {copy.text}
          </m.p>
        </div>

        {!cancelled && (
          <m.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.15 }}
            className="mt-6 rounded-2xl bg-surface-lowest p-4 shadow-xs"
          >
            <p className="text-[13px] text-secondary">{longDate(appointment.date)}</p>
            <p className="text-2xl font-bold tabular-nums">{appointment.time} hs</p>
            <p className="mt-1 text-[15px] font-medium">{appointment.serviceName}</p>
            {barber && <p className="text-[13px] text-secondary">con {barber.name}</p>}
            <p className="text-[13px] text-secondary">A nombre de {appointment.clientName}</p>
            <div className="mt-3 flex justify-between border-t border-surface-high pt-3 text-sm">
              <span className="text-secondary">{paid ? "Saldo en el local" : "Total en el local"}</span>
              <span className="font-semibold tabular-nums">{money(balance)}</span>
            </div>
          </m.div>
        )}

        {!cancelled && (
          <m.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.25 }}
            className="mt-4 rounded-2xl bg-primary-fixed p-4"
          >
            <p className="flex items-center gap-2 text-[15px] font-semibold text-primary">
              <UserRoundPlus size={18} aria-hidden /> Guardá este turno en tu cuenta
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-[13px] text-secondary">
              <li className="flex items-center gap-2">
                <History size={14} aria-hidden /> Tu historial de cortes y tus próximos turnos
              </li>
              <li className="flex items-center gap-2">
                <CalendarPlus size={14} aria-hidden /> Reprogramar o cancelar sin escribirle al local
              </li>
              <li className="flex items-center gap-2">
                <RefreshCw size={14} aria-hidden /> Repetir tu último corte en dos toques
              </li>
            </ul>
            <Link href="/auth/registro?desde=reserva" transitionTypes={[...NAV.forward]} className="tap btn-primary mt-3">
              Crear mi cuenta
            </Link>
            <p className="mt-2 text-center text-xs text-secondary">Ya tenemos tu nombre y celular: solo falta email y contraseña.</p>
          </m.div>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-6">
          {canPay && (
            <button type="button" disabled={paying} onClick={pay} className="tap btn-primary">
              {state === "error" ? <RefreshCw size={17} /> : <CreditCard size={17} />}
              {paying ? "Abriendo Mercado Pago…" : state === "error" ? "Reintentar el pago" : "Pagar con Mercado Pago"}
            </button>
          )}
          {cancelled && (
            <Link href="/reservar" transitionTypes={[...NAV.back]} className="tap btn-primary">
              <RefreshCw size={17} /> Reservar de nuevo
            </Link>
          )}
          {!cancelled && (
            <button type="button" onClick={() => downloadAppointmentIcs(appointment, info)} className="tap btn-secondary">
              <CalendarPlus size={17} /> Agregar al calendario
            </button>
          )}
          {info.whatsapp && (
            <a
              href={whatsappLink(info.whatsapp, `Hola ${info.name}, reservé un turno el ${longDate(appointment.date)} a las ${appointment.time} hs a nombre de ${appointment.clientName}.`)}
              target="_blank"
              rel="noreferrer"
              className="tap btn-secondary"
            >
              <MessageCircle size={17} /> Escribirle al local
            </a>
          )}
          <p className="pt-2 text-center text-[13px] text-secondary">
            ¿Ya tenés cuenta?{" "}
            <Link href="/auth/login?tipo=cliente" transitionTypes={[...NAV.forward]} className="text-link">
              Ingresá
            </Link>{" "}
            y vas a ver este turno con los demás.
          </p>
        </div>
      </div>
    </PublicShell>
  );
}
