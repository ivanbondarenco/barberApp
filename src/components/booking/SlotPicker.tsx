"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useMemo, useRef, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import { addDays, dayNumber, dayShort, monthShort, todayISO } from "@/lib/dates";
import { ease } from "@/lib/motion";
import { buildSlots, openingHours, shiftOf, type Shift } from "@/lib/schedule";
import { useAppStore } from "@/store/useAppStore";

const DAYS_AHEAD = 21;

interface SlotPickerProps {
  barberId: string;
  durationMin: number;
  date: string | null;
  time: string | null;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string | null) => void;
  excludeAppointmentId?: string;
}

/** Tira de días desplazable + horarios libres agrupados por turno. Solo muestra lo disponible. */
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
  const stripRef = useRef<HTMLDivElement>(null);

  const today = todayISO();
  const days = useMemo(() => {
    const list: { date: string; free: number }[] = [];
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = addDays(today, i);
      if (!openingHours(d, hours)) continue;
      const free = buildSlots({ date: d, barberId, durationMin, appointments, blocks, hours, excludeAppointmentId }).filter(
        (s) => s.available,
      ).length;
      list.push({ date: d, free });
    }
    return list;
  }, [today, hours, barberId, durationMin, appointments, blocks, excludeAppointmentId]);

  // Si el día elegido no tiene lugar (o no hay día), salta al primero con horarios libres.
  useEffect(() => {
    if (time) return;
    if (date && days.some((d) => d.date === date && d.free > 0)) return;
    const first = days.find((d) => d.free > 0);
    if (first && first.date !== date) onDateChange(first.date);
  }, [date, time, days, onDateChange]);

  const slots = useMemo(
    () =>
      date
        ? buildSlots({ date, barberId, durationMin, appointments, blocks, hours, excludeAppointmentId }).filter((s) => s.available)
        : [],
    [date, barberId, durationMin, appointments, blocks, hours, excludeAppointmentId],
  );

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

  useEffect(() => {
    stripRef.current?.querySelector('[aria-checked="true"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [date]);

  const visible = shift === "manana" ? morning : afternoon;

  return (
    <div className="flex flex-col gap-4">
      <div ref={stripRef} role="radiogroup" aria-label="Día" className="no-scrollbar -mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1">
        {days.map(({ date: d, free }) => {
          const active = d === date;
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={free === 0}
              onClick={() => onDateChange(d)}
              className={cn(
                "tap relative flex w-14 shrink-0 snap-center flex-col items-center rounded-2xl py-2.5 transition-colors",
                active ? "bg-primary text-on-primary shadow-cta" : "bg-surface-lowest text-ink shadow-xs",
                free === 0 && "opacity-40",
              )}
            >
              <span className={cn("text-[11px] font-medium", active ? "text-on-primary/80" : "text-secondary")}>
                {d === today ? "Hoy" : dayShort(d)}
              </span>
              <span className="text-lg font-bold leading-tight tabular-nums">{dayNumber(d)}</span>
              <span className={cn("text-[10px]", active ? "text-on-primary/80" : "text-secondary")}>{monthShort(d)}</span>
            </button>
          );
        })}
      </div>

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
