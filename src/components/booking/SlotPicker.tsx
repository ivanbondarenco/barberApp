"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { MonthCalendar } from "@/components/ui/MonthCalendar";
import { addDays, monthGrid, sameMonth, todayISO } from "@/lib/dates";
import { ease } from "@/lib/motion";
import {
  buildSlots,
  CLIENT_BOOKING_DAYS,
  clientBookingLimit,
  openingHours,
  shiftOf,
  type Shift,
} from "@/lib/schedule";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/store/useAppStore";

/** Hasta cuántos días adelante busca el primer día con lugar cuando agenda el local. */
const STAFF_SEARCH_DAYS = 90;

interface SlotPickerProps {
  barberId: string;
  durationMin: number;
  date: string | null;
  time: string | null;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string | null) => void;
  excludeAppointmentId?: string;
}

/**
 * Calendario del mes + horarios libres del día elegido, agrupados por turno.
 *
 * El cliente solo puede elegir dentro de las próximas dos semanas; el staff, cualquier día de
 * acá en adelante. La misma regla la vuelve a controlar el servidor al guardar.
 */
export function SlotPicker({
  barberId,
  durationMin,
  date,
  time,
  onDateChange,
  onTimeChange,
  excludeAppointmentId,
}: SlotPickerProps) {
  const appointments = useAppStore((s) => s.appointments);
  const blocks = useAppStore((s) => s.blocks);
  const hours = useAppStore((s) => s.businessHours);
  const isClient = useAppStore((s) => s.session?.role === "cliente");

  const today = todayISO();
  const maxDate = isClient ? clientBookingLimit() : undefined;
  const [month, setMonth] = useState(date ?? today);

  const slotsOf = useCallback(
    (d: string) => buildSlots({ date: d, barberId, durationMin, appointments, blocks, hours, excludeAppointmentId }),
    [barberId, durationMin, appointments, blocks, hours, excludeAppointmentId],
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
    const horizon = isClient ? CLIENT_BOOKING_DAYS : STAFF_SEARCH_DAYS;
    for (let i = 0; i <= horizon; i++) {
      const d = addDays(today, i);
      if (!openingHours(d, hours)) continue;
      if (slotsOf(d).some((s) => s.available)) return d;
    }
    return null;
  }, [isClient, today, hours, slotsOf]);

  // Si el día elegido no tiene lugar (o no hay día), salta al primero con horarios libres.
  useEffect(() => {
    if (time) return;
    if (date && inRange(date) && slotsOf(date).some((s) => s.available)) return;
    if (firstFreeDay && firstFreeDay !== date) onDateChange(firstFreeDay);
  }, [date, time, inRange, slotsOf, firstFreeDay, onDateChange]);

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

  return (
    <div className="flex flex-col gap-4">
      <MonthCalendar
        month={month}
        onMonthChange={setMonth}
        selected={date}
        onSelect={onDateChange}
        markOf={(iso) => ({ count: freeByDay.get(iso) ?? 0, disabled: !freeByDay.get(iso) })}
        minDate={today}
        maxDate={maxDate}
        hint={isClient ? `Podés reservar hasta ${CLIENT_BOOKING_DAYS / 7} semanas por adelantado.` : undefined}
      />

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
            <p className="rounded-2xl bg-surface-low px-4 py-6 text-center text-sm text-secondary">
              No quedan horarios {shift === "manana" ? "a la mañana" : "a la tarde"}. Probá otro día.
            </p>
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
                    onClick={() => onTimeChange(slot.time)}
                    className={cn(
                      "tap rounded-xl py-3 text-sm font-semibold tabular-nums transition-colors",
                      active ? "bg-primary text-on-primary shadow-cta" : "bg-surface-lowest text-ink shadow-xs hover:bg-surface-low",
                    )}
                  >
                    {slot.time}
                  </button>
                );
              })}
            </div>
          )}
        </m.div>
      </AnimatePresence>
    </div>
  );
}
