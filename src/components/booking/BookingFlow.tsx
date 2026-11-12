"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ArrowLeft, Banknote, CalendarCheck, Check, ChevronDown, ChevronRight, CreditCard, Landmark, PiggyBank, Star, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { CheckoutSheet } from "@/components/booking/CheckoutSheet";
import { SlotPicker } from "@/components/booking/SlotPicker";
import { NAV, Page } from "@/components/motion/Page";
import { Sheet } from "@/components/ui/Sheet";
import { Field } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { dayNumber, dayShort, monthShort, toISODate } from "@/lib/dates";
import { initials, money } from "@/lib/format";
import {
  guestBookingPath,
  readGuestBooking,
  readGuestContact,
  saveGuestBooking,
  saveGuestContact,
  type GuestBookingRef,
} from "@/lib/guest-contact";
import { ease, listItem, spring, stepSlide } from "@/lib/motion";
import { AR_PHONE_ERROR, AR_PREFIX, arLocalDigits, isArPhone, toArPhone } from "@/lib/phone";
import { depositPercent, HOLD_MINUTES, serviceDepositRate, splitDeposit } from "@/lib/pricing";
import { ANY_BARBER, cashDepositDeadline } from "@/lib/schedule";
import type { PaymentMethod } from "@/lib/types";
import { sanitizePhone } from "@/lib/validation";
import { bookAppointment, startCheckout } from "@/store/actions";
import { useAppStore, useCurrentClient } from "@/store/useAppStore";
import { useBookingRules } from "@/store/useRules";
import { toast } from "@/store/useToast";

type Step = 1 | 2 | 3;
const STEP_TITLES: Record<Step, string> = { 1: "¿Qué te hacés?", 2: "¿Cuándo venís?", 3: "Confirmá tu turno" };

/** Cómo paga la seña, ya con el medio concreto: así no se le pregunta dos veces. */
type PayChoice = "mercadopago" | "transferencia" | "efectivo" | "credito";

type GuestErrors = { name?: string; phone?: string };

const shortDate = (iso: string) => `${dayShort(iso)} ${dayNumber(iso)} ${monthShort(iso)}`;
const clock = (d: Date) => d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

function validateGuest(name: string, phone: string): GuestErrors {
  return {
    name: name.trim().length < 2 ? "Ingresá tu nombre" : undefined,
    phone: !isArPhone(phone) ? (phone.trim() ? AR_PHONE_ERROR : "Ingresá tu celular") : undefined,
  };
}

/**
 * Reserva en tres pasos: servicio (y barbero), día y hora, confirmación con la seña.
 *
 * `guest`: reserva sin cuenta desde el link del local. En la confirmación se piden solo nombre y
 * celular, y la seña se paga con Mercado Pago o en el local. El turno lo crea el servidor
 * (/api/reservas) como invitado: acá no hay sesión para aplicar el comando en el navegador.
 *
 * `backRef`: si la pantalla tiene su propio "volver" en el header (PublicShell), se lo cuelga acá
 * para que vuelva de a un paso; el asistente entonces no dibuja su flecha (serían dos).
 * Devuelve `true` si lo manejó.
 */
export function BookingFlow({ guest = false, backRef }: { guest?: boolean; backRef?: RefObject<(() => boolean) | null> }) {
  const router = useRouter();
  const params = useSearchParams();
  const client = useCurrentClient();
  const allServices = useAppStore((s) => s.services);
  const allBarbers = useAppStore((s) => s.barbers);
  const allowCash = useAppStore((s) => s.depositSettings.allowCash);
  const mercadopagoReady = useAppStore((s) => s.integrations.mercadopagoReady);
  const shopDepositRate = useAppStore((s) => s.depositSettings.rate);
  const rules = useBookingRules();
  const transferAlias = useAppStore((s) => s.businessInfo.transferAlias);
  const hours = useAppStore((s) => s.businessHours);

  const services = useMemo(() => allServices.filter((s) => s.active), [allServices]);
  const barbers = useMemo(() => allBarbers.filter((b) => b.active), [allBarbers]);

  const presetService = services.find((s) => s.id === params.get("servicio"))?.id ?? null;
  // Fecha elegida en el calendario de "Mis turnos": se arranca eligiendo el servicio, con ese día puesto.
  const presetDate = params.get("fecha");
  const [step, setStep] = useState<Step>(presetService ? 2 : 1);
  const [direction, setDirection] = useState(1);
  const [serviceId, setServiceId] = useState<string | null>(presetService);
  // Con varios barberos se arranca en "me da igual": es lo que más eligen y muestra más horarios.
  const [barberId, setBarberId] = useState(
    barbers.find((b) => b.id === params.get("barbero"))?.id ?? (barbers.length > 1 ? ANY_BARBER : barbers[0]?.id ?? ""),
  );
  const [date, setDate] = useState<string | null>(presetDate);
  const [time, setTime] = useState<string | null>(null);
  const [choice, setChoice] = useState<PayChoice | null>(null);
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [barberSheet, setBarberSheet] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestErrors, setGuestErrors] = useState<GuestErrors>({});
  const [savedBooking, setSavedBooking] = useState<GuestBookingRef | null>(null);

  useEffect(() => {
    if (!guest) return;
    const saved = readGuestContact();
    setGuestName(saved.name);
    // Versiones anteriores lo guardaban con el +54 9 adelante: acá el prefijo ya está fijo.
    setGuestPhone(saved.phone.trim().startsWith("+54") ? arLocalDigits(saved.phone) : saved.phone);
    setSavedBooking(readGuestBooking());
  }, [guest]);

  const service = services.find((s) => s.id === serviceId);
  const anyBarber = barberId === ANY_BARBER && barbers.length > 1;
  const barber = barbers.find((b) => b.id === barberId) ?? barbers[0];
  /** Lo que se muestra como "Con …": el barbero elegido, o el primero libre. */
  const barberLabel = anyBarber ? "El primero libre" : barber?.name ?? "";
  // Cada servicio puede tener su propia seña; si no, la del local.
  const depositRate = serviceDepositRate(service, shopDepositRate);
  const split = service ? splitDeposit(service.price, depositRate) : null;

  const deadline = date && time ? cashDepositDeadline(date, time, hours, rules.cashDeadlineHours) : null;
  const cashAvailable = allowCash && (!deadline || deadline.getTime() > Date.now());
  const creditAvailable = !!client && !!split && client.credit >= split.deposit;
  // El invitado no puede transferir: sin cuenta no hay cómo avisar que lo hizo.
  // Sin alias cargado tampoco: no habría a dónde transferir.
  const available: Record<PayChoice, boolean> = {
    mercadopago: mercadopagoReady,
    transferencia: !guest && !!transferAlias,
    efectivo: cashAvailable,
    credito: creditAvailable,
  };
  const effective: PayChoice | null =
    choice && available[choice]
      ? choice
      : (["mercadopago", "transferencia", "efectivo"] as const).find((c) => available[c]) ?? null;
  /** Invitado en un local con seña que no tiene ni Mercado Pago ni efectivo habilitados. */
  const guestBlocked = guest && depositRate > 0 && !mercadopagoReady && !cashAvailable;

  const go = useCallback(
    (next: Step) => {
      setDirection(next > step ? 1 : -1);
      setStep(next);
    },
    [step],
  );

  // El "volver" del header retrocede de a un paso; en el primero, sale de la reserva.
  useEffect(() => {
    if (!backRef) return;
    backRef.current = () => {
      if (step === 1) return false;
      go((step - 1) as Step);
      return true;
    };
    return () => {
      backRef.current = null;
    };
  }, [backRef, step, go]);

  const onDate = useCallback((d: string) => setDate(d), []);
  const onTime = useCallback((t: string | null) => setTime(t), []);
  const openBarbers = useCallback(() => setBarberSheet(true), []);

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

  const blurGuest = (field: keyof GuestErrors) => {
    const errors = validateGuest(guestName, guestPhone);
    // En el blur solo se marca lo que ya escribió: un campo vacío recién se reclama al confirmar.
    const value = field === "name" ? guestName : guestPhone;
    if (!value.trim() && !guestErrors[field]) return;
    setGuestErrors((prev) => ({ ...prev, [field]: errors[field] }));
  };

  /** Reserva sin cuenta: la crea el servidor y, si eligió Mercado Pago, devuelve el checkout. */
  const finalizeGuest = async (method: "mercadopago" | "efectivo") => {
    if (!service || !date || !time) return;
    const name = guestName.trim();
    const errors = validateGuest(guestName, guestPhone);
    setGuestErrors(errors);
    if (errors.name || errors.phone) {
      document.getElementById(errors.name ? "g-name" : "g-phone")?.focus();
      return;
    }
    const phone = toArPhone(guestPhone);
    saveGuestContact({ name, phone: guestPhone.trim() });

    setSaving(true);
    try {
      const res = await fetch("/api/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, barberId, serviceId: service.id, date, time, notes, depositMethod: method }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string; token?: string; initPoint?: string; next?: string };
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
      // El token del link es lo único que identifica la reserva: queda guardado para volver a verla.
      if (data.id && data.token) {
        saveGuestBooking({ id: data.id, token: data.token, date, time, label: `${shortDate(date)} · ${time} hs` });
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
    if (guest) return void finalizeGuest(depositRate > 0 && effective === "mercadopago" ? "mercadopago" : "efectivo");
    // Sin seña no hay nada que cobrar por adelantado: se reserva y listo.
    if (depositRate === 0) void finalize("efectivo");
    // La transferencia necesita los datos del local: los muestra el checkout.
    else if (effective === "transferencia") setCheckoutOpen(true);
    else if (effective) void finalize(effective);
  };

  if (!services.length || !barber) {
    return (
      <Page>
        <EmptyState icon={CreditCard} title="Todavía no hay servicios disponibles" text="Volvé a intentar en un rato." />
      </Page>
    );
  }

  const deadlineText = deadline ? `${dayShort(toISODate(deadline))} ${dayNumber(toISODate(deadline))} a las ${clock(deadline)} hs` : "";

  return (
    <Page>
      <div className="flex flex-1 flex-col px-5 pb-4 pt-2">
        {/* Progreso */}
        <div className="mb-4 flex items-center gap-3">
          <AnimatePresence initial={false}>
            {step > 1 && !backRef && (
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
            {step === 1 && guest && savedBooking && (
              <Link
                href={guestBookingPath(savedBooking)}
                transitionTypes={[...NAV.forward]}
                className="tap mb-4 flex items-center gap-3 rounded-2xl bg-primary-fixed px-4 py-3"
              >
                <CalendarCheck size={20} className="shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-secondary">Tenés un turno el {savedBooking.label}</span>
                  <span className="block text-[15px] font-semibold text-primary">Ver mi reserva</span>
                </span>
                <ChevronRight size={18} className="text-primary" aria-hidden />
              </Link>
            )}
            {step === 1 && client && <p className="text-[15px] text-secondary">Hola, {client.name.split(" ")[0]}</p>}
            <h2 className="page-title mb-4">{STEP_TITLES[step]}</h2>

            {step === 1 && (
              <>
                <button
                  type="button"
                  onClick={openBarbers}
                  className="tap mb-4 flex items-center gap-3 rounded-2xl bg-surface-lowest px-3 py-2.5 text-left shadow-xs"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed text-sm font-bold text-primary">
                    {anyBarber ? <Users size={18} aria-hidden /> : barber.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-secondary">Con</span>
                    <span className="block truncate text-[15px] font-semibold">{barberLabel}</span>
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
                  {service.name} · {service.durationMin} min · {anyBarber ? "con el primero libre" : `con ${barber.name.split(" ")[0]}`}
                </p>
                <SlotPicker
                  barberId={barberId}
                  durationMin={service.durationMin}
                  date={date}
                  time={time}
                  onDateChange={onDate}
                  onTimeChange={onTime}
                  onChangeBarber={barbers.length > 1 ? openBarbers : undefined}
                />
              </>
            )}

            {step === 3 && service && date && time && split && (
              <div className="flex flex-col gap-4">
                <div className="divide-y divide-surface-high rounded-2xl bg-surface-lowest shadow-xs">
                  <SummaryRow label="Servicio" value={service.name} onEdit={() => go(1)} />
                  <SummaryRow label="Día y hora" value={`${shortDate(date)} · ${time} hs`} onEdit={() => go(2)} />
                  <SummaryRow label="Barbero" value={anyBarber ? "El primero libre (te lo asignamos al confirmar)" : barber.name} onEdit={openBarbers} />
                </div>

                {guest && (
                  <div className="flex flex-col gap-3 rounded-2xl bg-surface-lowest p-4 shadow-xs">
                    <p className="section-title">Tus datos</p>
                    <Field label="Nombre" htmlFor="g-name" error={guestErrors.name}>
                      <input
                        id="g-name"
                        className="field py-3"
                        autoComplete="name"
                        autoCapitalize="words"
                        value={guestName}
                        maxLength={80}
                        onChange={(e) => {
                          setGuestName(e.target.value);
                          if (guestErrors.name) setGuestErrors((p) => ({ ...p, name: validateGuest(e.target.value, guestPhone).name }));
                        }}
                        onBlur={() => blurGuest("name")}
                      />
                    </Field>
                    <Field
                      label="Celular"
                      htmlFor="g-phone"
                      error={guestErrors.phone}
                      hint="Código de área y número. El local lo usa si necesita avisarte algo."
                    >
                      <div className="field flex items-center gap-2 py-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                        <span aria-hidden className="shrink-0 text-secondary">
                          {AR_PREFIX}
                        </span>
                        <input
                          id="g-phone"
                          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted sm:text-sm"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel-national"
                          placeholder="11 2345 6789"
                          maxLength={20}
                          value={guestPhone}
                          onChange={(e) => {
                            const value = sanitizePhone(e.target.value);
                            setGuestPhone(value);
                            if (guestErrors.phone) setGuestErrors((p) => ({ ...p, phone: validateGuest(guestName, value).phone }));
                          }}
                          onBlur={() => blurGuest("phone")}
                        />
                      </div>
                    </Field>
                  </div>
                )}

                {depositRate === 0 ? (
                  <p className="rounded-2xl bg-surface-lowest px-4 py-3 text-[13px] text-secondary shadow-xs">
                    Este local no pide seña: confirmás el turno y abonás {money(service.price)} en el sillón.
                  </p>
                ) : (
                  <div>
                    <p className="section-title mb-2 px-1">Seña del {depositPercent(depositRate)}</p>
                    <div className="flex flex-col gap-2" role="radiogroup" aria-label="Cómo pagás la seña">
                      {mercadopagoReady && (
                        <PayOption
                          active={effective === "mercadopago"}
                          onClick={() => setChoice("mercadopago")}
                          icon={CreditCard}
                          title={guest ? "Pagar con Mercado Pago" : "Mercado Pago"}
                          detail={`${money(split.deposit)} ahora, el resto en el local`}
                        />
                      )}
                      {!guest && (
                        <PayOption
                          active={effective === "transferencia"}
                          onClick={() => setChoice("transferencia")}
                          icon={Landmark}
                          title="Transferencia"
                          detail={`${money(split.deposit)} al alias del local`}
                        />
                      )}
                      {allowCash && (
                        <PayOption
                          active={effective === "efectivo"}
                          disabled={!cashAvailable}
                          onClick={() => setChoice("efectivo")}
                          icon={Banknote}
                          title={guest ? "Pagar en el local" : "Efectivo en el local"}
                          detail={
                            cashAvailable && deadline
                              ? `Seña de ${money(split.deposit)} en el local, hasta el ${deadlineText}`
                              : "Ya no llegás con el plazo"
                          }
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
                    {effective === "mercadopago" && (
                      <p className="mt-2 px-1 text-[13px] text-secondary">
                        Te guardamos el horario {HOLD_MINUTES} min mientras pagás.
                      </p>
                    )}
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

                {depositRate > 0 && (
                  <p className="px-1 text-[13px] text-secondary">
                    {guest
                      ? `Si no podés venir, avisale al local hasta ${rules.cancelHours} h antes y no perdés la seña.`
                      : `Cancelás o reprogramás sin cargo hasta ${rules.cancelHours} h antes.`}{" "}
                    {/* En otra pestaña: no se pierde lo elegido. */}
                    <a href="/politicas" target="_blank" rel="noreferrer" className="text-link">
                      Ver políticas
                    </a>
                  </p>
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
                  <p className="text-xs text-secondary">Seña {depositPercent(depositRate)}</p>
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
              <button
                type="button"
                disabled={saving || guestBlocked || !time || (!guest && depositRate > 0 && !effective)}
                onClick={confirm}
                className="tap btn-primary w-auto px-6"
              >
                {saving
                  ? "Reservando…"
                  : depositRate === 0
                    ? "Reservar turno"
                    : guest
                      ? effective === "mercadopago"
                        ? "Pagar seña"
                        : "Reservar turno"
                      : effective === "mercadopago" || effective === "transferencia"
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
          {barbers.length > 1 && (
            <li>
              <button
                type="button"
                onClick={() => {
                  if (!anyBarber) {
                    setBarberId(ANY_BARBER);
                    setTime(null);
                    if (step === 3) go(2);
                  }
                  setBarberSheet(false);
                }}
                className={cn(
                  "tap flex w-full items-center gap-3 rounded-2xl bg-surface-low px-3 py-3 text-left",
                  anyBarber && "ring-2 ring-primary",
                )}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-fixed text-primary">
                  <Users size={20} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Me da igual</span>
                  <span className="block text-[13px] text-secondary">El primero que esté libre: ves todos los horarios</span>
                </span>
                {anyBarber && <Check size={20} className="text-primary" aria-hidden />}
              </button>
            </li>
          )}
          {barbers.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => {
                  // Otro barbero tiene otra agenda: el horario elegido puede no estar libre con él.
                  if (b.id !== barberId) {
                    setBarberId(b.id);
                    setTime(null);
                    if (step === 3) go(2);
                  }
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
          methods={["transferencia"]}
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
      <button type="button" onClick={onEdit} className="text-link px-2 text-[13px]" aria-label={`Cambiar ${label.toLowerCase()}`}>
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
