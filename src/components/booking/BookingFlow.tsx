"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ArrowLeft, Banknote, Check, ChevronDown, CreditCard, PiggyBank, Star } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckoutSheet } from "@/components/booking/CheckoutSheet";
import { SlotPicker } from "@/components/booking/SlotPicker";
import { NAV, Page } from "@/components/motion/Page";
import { Sheet } from "@/components/ui/Sheet";
import { Field } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { dayNumber, dayShort, monthShort } from "@/lib/dates";
import { initials, money, onlyDigits } from "@/lib/format";
import { readGuestContact, saveGuestContact } from "@/lib/guest-contact";
import { ease, listItem, spring, stepSlide } from "@/lib/motion";
import { CASH_DEPOSIT_DEADLINE_HOURS, splitDeposit } from "@/lib/pricing";
import { cashDepositDeadline } from "@/lib/schedule";
import type { DepositChoice, PaymentMethod } from "@/lib/types";
import { bookAppointment, startCheckout } from "@/store/actions";
import { useAppStore, useCurrentClient } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

type Step = 1 | 2 | 3;
const STEP_TITLES: Record<Step, string> = { 1: "¿Qué te hacés?", 2: "¿Cuándo venís?", 3: "Confirmá tu turno" };

/**
 * Reserva en tres pasos: servicio (y barbero), día y hora, confirmación con la seña.
 *
 * `guest`: reserva sin cuenta desde el link del local. En la confirmación se piden solo nombre y
 * celular, y la seña se paga con Mercado Pago o en el local. El turno lo crea el servidor
 * (/api/reservas) como invitado: acá no hay sesión para aplicar el comando en el navegador.
 */
export function BookingFlow({ guest = false }: { guest?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const client = useCurrentClient();
  const allServices = useAppStore((s) => s.services);
  const allBarbers = useAppStore((s) => s.barbers);
  const allowCash = useAppStore((s) => s.depositSettings.allowCash);
  const mercadopagoReady = useAppStore((s) => s.integrations.mercadopagoReady);
  const depositRate = useAppStore((s) => s.depositSettings.rate);
  const hours = useAppStore((s) => s.businessHours);

  const services = useMemo(() => allServices.filter((s) => s.active), [allServices]);
  const barbers = useMemo(() => allBarbers.filter((b) => b.active), [allBarbers]);

  const presetService = services.find((s) => s.id === params.get("servicio"))?.id ?? null;
  // Fecha elegida en el calendario de "Mis turnos": se arranca eligiendo el servicio, con ese día puesto.
  const presetDate = params.get("fecha");
  const [step, setStep] = useState<Step>(presetService ? 2 : 1);
  const [direction, setDirection] = useState(1);
  const [serviceId, setServiceId] = useState<string | null>(presetService);
  const [barberId, setBarberId] = useState(barbers.find((b) => b.id === params.get("barbero"))?.id ?? barbers[0]?.id ?? "");
  const [date, setDate] = useState<string | null>(presetDate);
  const [time, setTime] = useState<string | null>(null);
  const [choice, setChoice] = useState<DepositChoice>("digital");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [barberSheet, setBarberSheet] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestErrors, setGuestErrors] = useState<{ name?: string; phone?: string }>({});

  useEffect(() => {
    if (!guest) return;
    const saved = readGuestContact();
    setGuestName(saved.name);
    setGuestPhone(saved.phone);
  }, [guest]);

  const service = services.find((s) => s.id === serviceId);
  const barber = barbers.find((b) => b.id === barberId) ?? barbers[0];
  const split = service ? splitDeposit(service.price, depositRate) : null;

  const deadline = date && time ? cashDepositDeadline(date, time, hours, CASH_DEPOSIT_DEADLINE_HOURS) : null;
  const cashAvailable = allowCash && (!deadline || deadline.getTime() > Date.now());
  const creditAvailable = !!client && !!split && client.credit >= split.deposit;
  // El invitado paga online solo con Mercado Pago (sin cuenta no hay cómo avisar una transferencia).
  const digitalAvailable = !guest || mercadopagoReady;
  const preferred: DepositChoice =
    (choice === "efectivo" && !cashAvailable) || (choice === "credito" && !creditAvailable) ? "digital" : choice;
  const effective: DepositChoice = preferred === "digital" && !digitalAvailable && cashAvailable ? "efectivo" : preferred;
  /** Invitado en un local con seña que no tiene ni Mercado Pago ni efectivo habilitados. */
  const guestBlocked = guest && depositRate > 0 && !digitalAvailable && !cashAvailable;

  const go = (next: Step) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const onDate = useCallback((d: string) => setDate(d), []);
  const onTime = useCallback((t: string | null) => setTime(t), []);

  /**
   * Crea el turno y, según el medio, sigue el camino que corresponda.
   * El turno nace con la seña pendiente: la acredita el webhook de la pasarela o el staff.
   */
  const finalize = async (method: PaymentMethod) => {
    if (!service || !date || !time || !client) return;
    setSaving(true);
    const result = await bookAppointment({
      clientName: client.name,
      clientPhone: client.phone,
      barberId,
      serviceId: service.id,
      date,
      time,
      notes,
      depositMethod: method,
    });
    if (!result.ok) {
      setSaving(false);
      setCheckoutOpen(false);
      toast(result.error, "error");
      if (result.error.includes("horario")) {
        setTime(null);
        go(2);
      }
      return;
    }

    // Mercado Pago: se sale de la app al checkout. Vuelve por las back_urls.
    if (method === "mercadopago") {
      const checkout = await startCheckout(result.id);
      if (checkout.ok && checkout.initPoint) {
        window.location.href = checkout.initPoint;
        return;
      }
      setSaving(false);
      setCheckoutOpen(false);
      toast(checkout.ok ? "No pudimos abrir el pago" : checkout.error, "error");
      router.push(`/cliente/turno/${result.id}`, { transitionTypes: [...NAV.forward] });
      return;
    }

    setSaving(false);
    setCheckoutOpen(false);
    // Queda confirmado al instante si no hay seña que cobrar o si la cubrió el crédito.
    const state = depositRate === 0 || method === "credito" ? "exito" : "pendiente";
    router.push(`/cliente/pago/${state}?turno=${result.id}`, { transitionTypes: [...NAV.forward] });
  };

  /** Reserva sin cuenta: la crea el servidor y, si eligió Mercado Pago, devuelve el checkout. */
  const finalizeGuest = async (method: "mercadopago" | "efectivo") => {
    if (!service || !date || !time) return;
    const name = guestName.trim();
    const digits = onlyDigits(guestPhone);
    const errors = {
      name: name.length < 2 ? "Ingresá tu nombre" : undefined,
      phone: digits.length < 10 || digits.length > 13 ? "Celular inválido" : undefined,
    };
    setGuestErrors(errors);
    if (errors.name || errors.phone) return;
    saveGuestContact({ name, phone: guestPhone.trim() });

    setSaving(true);
    try {
      const res = await fetch("/api/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: guestPhone.trim(), barberId, serviceId: service.id, date, time, notes, depositMethod: method }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; initPoint?: string; next?: string };
      if (!res.ok || data.error) {
        setSaving(false);
        toast(data.error ?? "No pudimos reservar. Probá de nuevo.", "error");
        // El horario se lo ganó otro: se refresca la disponibilidad y vuelve a elegir.
        if (data.error?.includes("horario")) {
          void useAppStore.getState().refresh(true);
          setTime(null);
          go(2);
        }
        return;
      }
      if (data.initPoint) {
        window.location.href = data.initPoint;
        return;
      }
      void useAppStore.getState().refresh(true);
      router.push(data.next ?? "/reservar", { transitionTypes: [...NAV.forward] });
    } catch {
      setSaving(false);
      toast("Sin conexión. Revisá tu internet.", "error");
    }
  };

  const confirm = () => {
    if (guest) return void finalizeGuest(depositRate > 0 && effective === "digital" ? "mercadopago" : "efectivo");
    // Sin seña no hay nada que cobrar por adelantado: se reserva y listo.
    if (depositRate === 0) void finalize("efectivo");
    else if (effective === "digital") setCheckoutOpen(true);
    else if (effective === "credito") void finalize("credito");
    else void finalize("efectivo");
  };

  if (!services.length || !barber) {
    return (
      <Page>
        <EmptyState icon={CreditCard} title="Todavía no hay servicios disponibles" text="Volvé a intentar en un rato." />
      </Page>
    );
  }

  return (
    <Page>
      <div className="flex flex-1 flex-col px-5 pb-4 pt-2">
        {/* Progreso */}
        <div className="mb-4 flex items-center gap-3">
          <AnimatePresence initial={false}>
            {step > 1 && (
              <m.button
                type="button"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 40 }}
                exit={{ opacity: 0, width: 0 }}
                onClick={() => go((step - 1) as Step)}
                aria-label="Paso anterior"
                className="icon-btn -ml-2 overflow-hidden"
              >
                <ArrowLeft size={20} />
              </m.button>
            )}
          </AnimatePresence>
          <div className="flex-1">
            <p className="text-xs font-medium text-secondary">Paso {step} de 3</p>
            <div className="mt-1.5 flex gap-1.5">
              {[1, 2, 3].map((i) => (
                <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-surface-high">
                  <m.span
                    className="block h-full rounded-full bg-primary"
                    initial={false}
                    animate={{ width: i <= step ? "100%" : "0%" }}
                    transition={{ duration: 0.35, ease: ease.standard }}
                  />
                </span>
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <m.section
            key={step}
            custom={direction}
            variants={stepSlide}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-1 flex-col"
          >
            {step === 1 && client && <p className="text-[15px] text-secondary">Hola, {client.name.split(" ")[0]}</p>}
            <h2 className="page-title mb-4">{STEP_TITLES[step]}</h2>

            {step === 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setBarberSheet(true)}
                  className="tap mb-4 flex items-center gap-3 rounded-2xl bg-surface-lowest px-3 py-2.5 text-left shadow-xs"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed text-sm font-bold text-primary">
                    {barber.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-secondary">Con</span>
                    <span className="block truncate text-[15px] font-semibold">{barber.name}</span>
                  </span>
                  <span className="text-[13px] font-semibold text-primary">Cambiar</span>
                </button>

                <div className="flex flex-col gap-2" role="radiogroup" aria-label="Servicio">
                  {services.map((s, i) => {
                    const selected = s.id === serviceId;
                    return (
                      <m.div key={s.id} custom={i} variants={listItem} initial="hidden" animate="show" layout>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => {
                            setServiceId(s.id);
                            setTimeout(() => go(2), 180);
                          }}
                          className={cn(
                            "tap flex w-full items-center gap-3 rounded-2xl bg-surface-lowest px-4 py-3.5 text-left shadow-xs transition-shadow",
                            selected && "ring-2 ring-primary",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-[15px] font-semibold">{s.name}</span>
                              {s.featured && <Star size={13} className="shrink-0 fill-primary text-primary" aria-label="Destacado" />}
                            </span>
                            <span className="block text-[13px] text-secondary">{s.durationMin} min</span>
                          </span>
                          <span className="text-[15px] font-semibold tabular-nums">{money(s.price)}</span>
                        </button>
                      </m.div>
                    );
                  })}
                </div>
              </>
            )}

            {step === 2 && service && (
              <>
                <p className="-mt-2 mb-4 text-sm text-secondary">
                  {service.name} · {service.durationMin} min · con {barber.name.split(" ")[0]}
                </p>
                <SlotPicker barberId={barberId} durationMin={service.durationMin} date={date} time={time} onDateChange={onDate} onTimeChange={onTime} />
              </>
            )}

            {step === 3 && service && date && time && split && (
              <div className="flex flex-col gap-4">
                <div className="divide-y divide-surface-high rounded-2xl bg-surface-lowest shadow-xs">
                  <SummaryRow label="Servicio" value={service.name} onEdit={() => go(1)} />
                  <SummaryRow label="Día y hora" value={`${dayShort(date)} ${dayNumber(date)} ${monthShort(date)} · ${time} hs`} onEdit={() => go(2)} />
                  <SummaryRow label="Barbero" value={barber.name} onEdit={() => setBarberSheet(true)} />
                </div>

                {guest && (
                  <div className="flex flex-col gap-3 rounded-2xl bg-surface-lowest p-4 shadow-xs">
                    <p className="section-title">Tus datos</p>
                    <Field label="Nombre" htmlFor="g-name" error={guestErrors.name}>
                      <input
                        id="g-name"
                        className="field py-3"
                        autoComplete="name"
                        value={guestName}
                        maxLength={80}
                        onChange={(e) => setGuestName(e.target.value)}
                      />
                    </Field>
                    <Field label="Celular" htmlFor="g-phone" error={guestErrors.phone} hint="Te confirmamos el turno por WhatsApp">
                      <input
                        id="g-phone"
                        className="field py-3"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="11 2345 6789"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                      />
                    </Field>
                  </div>
                )}

                {depositRate === 0 ? (
                  <p className="rounded-2xl bg-surface-lowest px-4 py-3 text-[13px] text-secondary shadow-xs">
                    Este local no pide seña: confirmás el turno y abonás {money(service.price)} en el sillón.
                  </p>
                ) : (
                <div>
                  <p className="section-title mb-2 px-1">Seña del {Math.round(depositRate * 100)}%</p>
                  <div className="flex flex-col gap-2" role="radiogroup" aria-label="Cómo pagás la seña">
                    {digitalAvailable && (
                      <PayOption
                        active={effective === "digital"}
                        onClick={() => setChoice("digital")}
                        icon={CreditCard}
                        title={guest ? "Pagar con Mercado Pago" : "Pagar online"}
                        detail={guest ? `${money(split.deposit)} ahora, el resto en el local` : "Mercado Pago o transferencia"}
                      />
                    )}
                    {allowCash && (
                      <PayOption
                        active={effective === "efectivo"}
                        disabled={!cashAvailable}
                        onClick={() => setChoice("efectivo")}
                        icon={Banknote}
                        title={guest ? "Pagar en el local" : "Efectivo en el local"}
                        detail={cashAvailable ? `Hasta ${CASH_DEPOSIT_DEADLINE_HOURS}h antes del turno` : "Ya no llegás con el plazo"}
                      />
                    )}
                    {!!client?.credit && (
                      <PayOption
                        active={effective === "credito"}
                        disabled={!creditAvailable}
                        onClick={() => setChoice("credito")}
                        icon={PiggyBank}
                        title="Usar mi crédito"
                        detail={`Tenés ${money(client.credit)} a favor`}
                      />
                    )}
                  </div>
                  {guestBlocked && (
                    <p className="mt-2 rounded-2xl bg-error-container px-4 py-3 text-[13px] text-error">
                      Este local todavía no tiene habilitado el pago de la seña sin cuenta.{" "}
                      <Link href="/auth/login?tipo=cliente" className="font-semibold underline">
                        Ingresá con tu cuenta
                      </Link>{" "}
                      o escribile al local.
                    </p>
                  )}
                </div>
                )}

                <div>
                  <button type="button" onClick={() => setNotesOpen((v) => !v)} className="text-link px-1 text-sm">
                    {notes ? "Nota para el barbero" : "Agregar nota para el barbero"}
                    <ChevronDown size={16} className={cn("transition-transform", notesOpen && "rotate-180")} />
                  </button>
                  <AnimatePresence initial={false}>
                    {notesOpen && (
                      <m.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: ease.standard }}
                        className="overflow-hidden"
                      >
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          maxLength={160}
                          rows={2}
                          placeholder="Ej: largo arriba, fade bien comprimido"
                          className="field mt-2 resize-none"
                          aria-label="Nota para el barbero"
                        />
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </m.section>
        </AnimatePresence>
      </div>

      {/* Barra de acción */}
      <AnimatePresence>
        {step > 1 && service && split && (
          <m.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: spring.sheet }}
            exit={{ y: 80, opacity: 0, transition: { duration: 0.15 } }}
            className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-surface-high bg-surface-lowest/95 px-5 py-3 backdrop-blur-xl"
          >
            <div className="min-w-0 flex-1">
              {depositRate > 0 ? (
                <>
                  <p className="text-xs text-secondary">Seña {Math.round(depositRate * 100)}%</p>
                  <p className="text-lg font-bold leading-tight tabular-nums">
                    {money(split.deposit)} <span className="text-xs font-normal text-secondary">de {money(split.total)}</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-secondary">Total</p>
                  <p className="text-lg font-bold leading-tight tabular-nums">{money(split.total)}</p>
                </>
              )}
            </div>
            {step === 2 ? (
              <button type="button" disabled={!time} onClick={() => go(3)} className="tap btn-primary w-auto px-6">
                {time ? `Continuar · ${time}` : "Elegí un horario"}
              </button>
            ) : (
              <button type="button" disabled={saving || guestBlocked} onClick={confirm} className="tap btn-primary w-auto px-6">
                {saving
                  ? "Reservando…"
                  : guest
                    ? depositRate > 0 && effective === "digital"
                      ? "Pagar seña"
                      : "Reservar turno"
                  : depositRate === 0
                    ? "Reservar turno"
                    : effective === "digital"
                      ? "Pagar seña"
                      : effective === "credito"
                        ? "Usar crédito"
                        : "Reservar"}
              </button>
            )}
          </m.div>
        )}
      </AnimatePresence>

      <Sheet open={barberSheet} onClose={() => setBarberSheet(false)} title="Elegí tu barbero">
        <ul className="flex flex-col gap-2">
          {barbers.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => {
                  setBarberId(b.id);
                  setTime(null);
                  setBarberSheet(false);
                }}
                className={cn(
                  "tap flex w-full items-center gap-3 rounded-2xl bg-surface-low px-3 py-3 text-left",
                  b.id === barberId && "ring-2 ring-primary",
                )}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-fixed text-sm font-bold text-primary">
                  {initials(b.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{b.name}</span>
                  <span className="flex items-center gap-1 text-[13px] text-secondary">
                    {b.reviews ? (
                      <>
                        <Star size={12} className="fill-primary text-primary" aria-hidden /> {b.rating?.toFixed(1)} ·{" "}
                      </>
                    ) : null}
                    {b.title}
                  </span>
                </span>
                {b.id === barberId && <Check size={20} className="text-primary" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      {service && date && time && split && (
        <CheckoutSheet
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          amount={split.deposit}
          description={`${service.name} · ${dayShort(date)} ${dayNumber(date)} · ${time} hs`}
          onConfirm={(method) => finalize(method)}
        />
      )}
    </Page>
  );
}

function SummaryRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="row">
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-secondary">{label}</span>
        <span className="block truncate text-[15px] font-semibold">{value}</span>
      </span>
      <button type="button" onClick={onEdit} className="text-link px-2 text-[13px]">
        Cambiar
      </button>
    </div>
  );
}

function PayOption({
  active,
  disabled,
  onClick,
  icon: Icon,
  title,
  detail,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: typeof CreditCard;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "tap flex items-center gap-3 rounded-2xl bg-surface-lowest px-4 py-3 text-left shadow-xs transition-shadow",
        active && "ring-2 ring-primary",
        disabled && "opacity-50",
      )}
    >
      <Icon size={20} className={active ? "text-primary" : "text-secondary"} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block text-[13px] text-secondary">{detail}</span>
      </span>
      <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border-2", active ? "border-primary bg-primary" : "border-outline")}>
        {active && <m.span layoutId="pay-dot" className="h-2 w-2 rounded-full bg-on-primary" />}
      </span>
    </button>
  );
}
