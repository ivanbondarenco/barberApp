"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { MessageCircle, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { MonthCalendar } from "@/components/ui/MonthCalendar";
import { addDays, dayNumber, dayShort, monthGrid, monthShort, sameMonth, todayISO } from "@/lib/dates";
import { whatsappLink } from "@/lib/format";
import { ease } from "@/lib/motion";
import {
  ANY_BARBER,
  anyBarberSlots,
  barberHours,
  buildSlots,
  clientBookingLimit,
  openingHours,
  shiftOf,
  windowLabel,
  type Shift,
} from "@/lib/schedule";
import { cn } from "@/lib/cn";
import { isStaff } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useBookingRules } from "@/store/useRules";

/** Hasta cuántos días adelante busca el primer día con lugar cuando agenda el local. */
const STAFF_SEARCH_DAYS = 90;

const shortDate = (iso: string) => `${dayShort(iso)} ${dayNumber(iso)} ${monthShort(iso)}`;

interface SlotPickerProps {
  barberId: string;
  durationMin: number;
  date: string | null;
  time: string | null;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string | null) => void;
  excludeAppointmentId?: string;
  /** Si viene, cuando no hay lugar en ningún día se ofrece probar con otro barbero. */
  onChangeBarber?: () => void;
}

/**
 * Calendario del mes + horarios libres del día elegido, agrupados por turno.
 *
 * Quien reserva por su cuenta (cliente o invitado sin sesión) solo puede elegir dentro de las
 * próximas dos semanas; el staff, cualquier día de acá en adelante. La misma regla la vuelve a
 * controlar el servidor al guardar. El staff además agenda al que entra sin turno: sin
 * anticipación mínima y con el horario que está corriendo ("Ahora").
 */
export function SlotPicker({
  barberId,
  durationMin,
  date,
  time,
  onDateChange,
  onTimeChange,
  excludeAppointmentId,
  onChangeBarber,
}: SlotPickerProps) {
  const appointments = useAppStore((s) => s.appointments);
  const blocks = useAppStore((s) => s.blocks);
  const shopHours = useAppStore((s) => s.businessHours);
  const barbers = useAppStore((s) => s.barbers);
  const rules = useBookingRules();
  const anyBarber = barberId === ANY_BARBER;
  // Cada barbero atiende en su horario; con "me da igual", vale el del local para saltear días.
  const hours = useMemo(
    () => (anyBarber ? shopHours : barberHours(barbers.find((b) => b.id === barberId), shopHours)),
    [anyBarber, barbers, barberId, shopHours],
  );
  const whatsapp = useAppStore((s) => s.businessInfo.whatsapp);
  // Sin sesión (invitado) o cliente: las mismas reglas que le aplica el servidor.
  const staff = useAppStore((s) => !!s.session && isStaff(s.session.role));
  const isClient = !staff;

  const today = todayISO();
  const maxDate = isClient ? clientBookingLimit(new Date(), rules.windowDays) : undefined;
  const [month, setMonth] = useState(date ?? today);

  const slotsOf = useCallback(
    (d: string) => {
      const query = { date: d, durationMin, appointments, blocks, excludeAppointmentId, walkIn: staff, rules };
      return anyBarber
        ? anyBarberSlots({ ...query, barbers, shopHours })
        : buildSlots({ ...query, barberId, hours });
    },
    [anyBarber, barbers, shopHours, barberId, durationMin, appointments, blocks, hours, excludeAppointmentId, staff, rules],
  );

  const inRange = useCallback((d: string) => d >= today && (!maxDate || d <= maxDate), [today, maxDate]);

  /** Horarios libres por día del mes visible: pinta el calendario y decide qué día se puede tocar. */
  const freeByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const iso of monthGrid(month).flat()) {
      if (!iso) continue;
      map.set(iso, inRange(iso) ? slotsOf(iso).filter((s) => s.available).length : 0);
    }
    return map;
  }, [month, inRange, slotsOf]);

  const firstFreeDay = useMemo(() => {
    const horizon = isClient ? rules.windowDays : STAFF_SEARCH_DAYS;
    for (let i = 0; i <= horizon; i++) {
      const d = addDays(today, i);
      if (!anyBarber && !openingHours(d, hours)) continue;
      if (slotsOf(d).some((s) => s.available)) return d;
    }
    return null;
  }, [isClient, rules.windowDays, today, anyBarber, hours, slotsOf]);

  // Cliente: si el día elegido no tiene lugar (o no hay día), salta al primero con horarios libres.
  // Staff: arranca en hoy y no salta solo; si no hay lugar se lo avisa y le ofrece el próximo día libre.
  useEffect(() => {
    if (time) return;
    if (staff) {
      if (!date || !inRange(date)) onDateChange(today);
      return;
    }
    if (date && inRange(date) && slotsOf(date).some((s) => s.available)) return;
    if (firstFreeDay && firstFreeDay !== date) onDateChange(firstFreeDay);
  }, [date, time, staff, today, inRange, slotsOf, firstFreeDay, onDateChange]);

  // El calendario sigue al día elegido, venga de un click o de afuera (un turno que se mueve).
  useEffect(() => {
    if (date && !sameMonth(date, month)) setMonth(date);
    // Solo cuando cambia el día.
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const slots = useMemo(() => (date ? slotsOf(date).filter((s) => s.available) : []), [date, slotsOf]);

  const morning = slots.filter((s) => shiftOf(s.time) === "manana");
  const afternoon = slots.filter((s) => shiftOf(s.time) === "tarde");
  const [shift, setShift] = useState<Shift>("manana");

  useEffect(() => {
    if (time && !slots.some((s) => s.time === time)) onTimeChange(null);
  }, [slots, time, onTimeChange]);

  useEffect(() => {
    if (time) setShift(shiftOf(time));
    else if (!morning.length && afternoon.length) setShift("tarde");
    else if (morning.length) setShift("manana");
    // Solo al cambiar de día.
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = shift === "manana" ? morning : afternoon;

  /** Staff parado en un día sin lugar: el próximo día con horarios libres después de ese. */
  const nextFreeDay = useMemo(() => {
    if (!staff || !date || slots.length) return null;
    for (let i = 1; i <= STAFF_SEARCH_DAYS; i++) {
      const d = addDays(date, i);
      if (!anyBarber && !openingHours(d, hours)) continue;
      if (slotsOf(d).some((s) => s.available)) return d;
    }
    return null;
  }, [staff, date, slots.length, anyBarber, hours, slotsOf]);

  /** Ningún día de la ventana tiene lugar: mandarlo a "otro día" no sirve. */
  const noAvailability = !firstFreeDay && !slots.length;
  const staffDayFull = staff && !!date && !slots.length;

  // Al tocar un día, si los horarios quedan abajo de la pantalla (calendario largo en celular),
  // se baja solo hasta ellos: si no, parece que el día no tiene lugar.
  const slotsRef = useRef<HTMLDivElement>(null);
  const [revealOn, setRevealOn] = useState<string | null>(null);
  const selectDay = useCallback(
    (d: string) => {
      setRevealOn(d);
      onDateChange(d);
    },
    [onDateChange],
  );
  useEffect(() => {
    if (!revealOn || revealOn !== date) return;
    setRevealOn(null);
    const el = slotsRef.current;
    if (!el) return;
    // Lo que tapa abajo: la barra de "Continuar" y la navegación.
    const firstRowBottom = el.getBoundingClientRect().top + 120;
    if (firstRowBottom <= window.innerHeight - 160) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [revealOn, date]);

  return (
    <div className="flex flex-col gap-4">
      <MonthCalendar
        month={month}
        onMonthChange={setMonth}
        selected={date}
        onSelect={selectDay}
        markOf={(iso) => ({ count: freeByDay.get(iso) ?? 0, disabled: !freeByDay.get(iso) })}
        minDate={today}
        maxDate={maxDate}
        hint={isClient ? `Podés reservar hasta ${windowLabel(rules.windowDays)} por adelantado.` : undefined}
        countLabel="horarios libres"
      />

      {noAvailability ? (
        <div role="status" className="flex flex-col gap-3 rounded-2xl bg-surface-low px-4 py-4 text-sm">
          <p className="text-secondary">
            {isClient
              ? `No quedan horarios libres en ${windowLabel(rules.windowDays)}${anyBarber ? "" : " con este barbero"}.`
              : "No quedan horarios libres con este barbero."}
          </p>
          {(onChangeBarber || (isClient && whatsapp)) && (
            <div className="flex flex-wrap gap-2">
              {onChangeBarber && (
                <button type="button" onClick={onChangeBarber} className="tap btn-secondary w-auto px-4">
                  <Users size={16} aria-hidden /> Probá con otro barbero
                </button>
              )}
              {isClient && whatsapp && (
                <a
                  href={whatsappLink(whatsapp, "Hola, quería sacar un turno y no encontré horarios libres en la app.")}
                  target="_blank"
                  rel="noreferrer"
                  className="tap btn-secondary w-auto px-4"
                >
                  <MessageCircle size={16} aria-hidden /> Escribile al local
                </a>
              )}
            </div>
          )}
        </div>
      ) : (
        staffDayFull && (
          <div role="status" className="flex flex-col items-start gap-1 rounded-2xl bg-surface-low px-4 py-3 text-sm">
            <p className="font-medium">{date === today ? "Hoy no quedan horarios libres" : "Este día no tiene horarios libres"}</p>
            {nextFreeDay && (
              <button type="button" onClick={() => selectDay(nextFreeDay)} className="text-link text-[13px]">
                Ver el próximo día libre ({shortDate(nextFreeDay)})
              </button>
            )}
          </div>
        )
      )}

      <div ref={slotsRef} className="flex scroll-mt-24 flex-col gap-4">
        <Segmented
          label="Turno"
          value={shift}
          onChange={setShift}
          options={[
            { value: "manana", label: "Mañana", count: morning.length },
            { value: "tarde", label: "Tarde", count: afternoon.length },
          ]}
        />

        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={`${date}-${shift}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: ease.enter } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            {visible.length === 0 ? (
              // Sin nada en todo el día, el aviso de arriba ya lo explica.
              noAvailability || staffDayFull ? null : (
                <p className="rounded-2xl bg-surface-low px-4 py-6 text-center text-sm text-secondary">
                  No quedan horarios {shift === "manana" ? "a la mañana" : "a la tarde"}.{" "}
                  {slots.length ? (
                    <button type="button" onClick={() => setShift(shift === "manana" ? "tarde" : "manana")} className="text-link">
                      Ver {shift === "manana" ? "la tarde" : "la mañana"}
                    </button>
                  ) : (
                    "Probá otro día."
                  )}
                </p>
              )
            ) : (
              <div role="radiogroup" aria-label="Horario" className="grid grid-cols-4 gap-2">
                {visible.map((slot) => {
                  const active = slot.time === time;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={slot.current ? `Ahora, ${slot.time}` : undefined}
                      onClick={() => onTimeChange(slot.time)}
                      className={cn(
                        "tap rounded-xl py-3 text-sm font-semibold tabular-nums transition-colors",
                        active
                          ? "bg-primary text-on-primary shadow-cta"
                          : "bg-surface-lowest text-ink shadow-xs hover:bg-surface-low",
                      )}
                    >
                      {slot.current ? "Ahora" : slot.time}
                    </button>
                  );
                })}
              </div>
            )}
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
