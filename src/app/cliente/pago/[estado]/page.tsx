"use client";

import * as m from "motion/react-m";
import { CalendarPlus, CreditCard, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PayDepositSheet } from "@/components/booking/PayDepositSheet";
import { NAV, Page } from "@/components/motion/Page";
import { SuccessCheck } from "@/components/motion/SuccessCheck";
import { downloadAppointmentIcs } from "@/lib/calendar";
import { dayNumber, dayShort, longDate, toISODate } from "@/lib/dates";
import { money, paymentMethodLabel } from "@/lib/format";
import { fadeUp } from "@/lib/motion";
import { CASH_DEPOSIT_DEADLINE_HOURS, splitDeposit } from "@/lib/pricing";
import { cashDepositDeadline } from "@/lib/schedule";
import { useAppStore } from "@/store/useAppStore";

export default function PagoResultadoPage() {
  return (
    <Suspense>
      <PagoResultado />
    </Suspense>
  );
}

function PagoResultado() {
  const { estado } = useParams<{ estado: string }>();
  const params = useSearchParams();
  const appointment = useAppStore((s) => s.appointments.find((a) => a.id === params.get("turno")));
  const barber = useAppStore((s) => s.barbers.find((b) => b.id === appointment?.barberId));
  const info = useAppStore((s) => s.businessInfo);
  const hours = useAppStore((s) => s.businessHours);
  const depositRate = useAppStore((s) => s.depositSettings.rate);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const state = estado === "exito" || estado === "pendiente" ? estado : "error";

  if (state !== "error" && !appointment) {
    return (
      <Page className="items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-secondary">No encontramos este turno.</p>
        <Link href="/cliente/mis-turnos" className="tap btn-primary w-auto px-5">
          Ir a mis turnos
        </Link>
      </Page>
    );
  }

  const split = appointment ? splitDeposit(appointment.servicePrice, depositRate) : null;
  const deadline = appointment ? cashDepositDeadline(appointment.date, appointment.time, hours, CASH_DEPOSIT_DEADLINE_HOURS) : null;

  // El texto de "pendiente" depende de por qué está pendiente: efectivo, transferencia avisada
  // o pago online sin acreditar todavía.
  const pendingText = () => {
    if (!appointment || !split) return "";
    if (appointment.deposit.status === "en_revision")
      return "Recibimos tu aviso de transferencia. Confirmamos la seña apenas la veamos acreditada.";
    if (appointment.deposit.method === "efectivo" && deadline)
      return `Aboná ${money(split.deposit)} en el local antes del ${dayShort(toISODate(deadline))} ${dayNumber(toISODate(deadline))} a las ${deadline.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })} hs.`;
    return `Todavía no nos llegó la seña de ${money(split.deposit)}. Si ya pagaste, puede demorar unos minutos en acreditarse.`;
  };

  const copy = {
    exito: {
      title: "¡Listo, te esperamos!",
      text: !appointment
        ? ""
        : appointment.deposit.status === "abonada"
          ? `Seña abonada con ${paymentMethodLabel[appointment.deposit.method]}.`
          : "Estamos confirmando el pago con Mercado Pago. Puede tardar un minuto.",
    },
    pendiente: { title: "Turno reservado", text: pendingText() },
    error: {
      title: "El pago no se completó",
      text: "No se cobró nada. Tu horario queda reservado un rato más: podés reintentar el pago o elegir otro medio.",
    },
  }[state];

  return (
    <Page className="px-5 pb-5 pt-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <SuccessCheck tone={state === "exito" ? "success" : state === "pendiente" ? "pending" : "error"} />
        <m.h2 variants={fadeUp} initial="hidden" animate="show" className="page-title mt-2">
          {copy.title}
        </m.h2>
        <m.p variants={fadeUp} initial="hidden" animate="show" className="max-w-80 text-[15px] text-secondary">
          {copy.text}
        </m.p>
      </div>

      {appointment && split && (
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
          <p className="text-[13px] text-secondary">con {barber?.name}</p>
          <div className="mt-3 flex justify-between border-t border-surface-high pt-3 text-sm">
            <span className="text-secondary">Saldo en el sillón</span>
            <span className="font-semibold tabular-nums">{money(appointment.deposit.status === "abonada" ? split.balance : split.total)}</span>
          </div>
        </m.div>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-6">
        {state === "exito" && appointment && (
          <>
            <Link href={`/cliente/turno/${appointment.id}`} transitionTypes={[...NAV.forward]} className="tap btn-primary">
              Ver mi turno
            </Link>
            <button type="button" onClick={() => downloadAppointmentIcs(appointment, info)} className="tap btn-secondary">
              <CalendarPlus size={17} /> Agregar al calendario
            </button>
          </>
        )}
        {state === "pendiente" && appointment && (
          <>
            {appointment.deposit.status !== "en_revision" && (
              <button type="button" onClick={() => setCheckoutOpen(true)} className="tap btn-primary">
                <CreditCard size={17} />
                {appointment.deposit.method === "transferencia" ? "Ver datos y avisar" : "Pagar online ahora"}
              </button>
            )}
            <Link href={`/cliente/turno/${appointment.id}`} transitionTypes={[...NAV.forward]} className="tap btn-secondary">
              Ver mi turno
            </Link>
          </>
        )}
        {state === "error" && (
          <>
            {appointment ? (
              <button type="button" onClick={() => setCheckoutOpen(true)} className="tap btn-primary">
                <RefreshCw size={17} /> Reintentar el pago
              </button>
            ) : (
              <Link
                href={`/cliente/reservar${params.get("servicio") ? `?servicio=${params.get("servicio")}&barbero=${params.get("barbero") ?? ""}` : ""}`}
                transitionTypes={[...NAV.back]}
                className="tap btn-primary"
              >
                <RefreshCw size={17} /> Intentar de nuevo
              </Link>
            )}
            <Link href="/ayuda" className="tap btn-secondary">
              Necesito ayuda
            </Link>
          </>
        )}
      </div>

      {appointment && <PayDepositSheet appointment={appointment} open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />}
    </Page>
  );
}
