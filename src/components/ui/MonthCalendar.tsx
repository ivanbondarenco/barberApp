"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { addMonths, dayNumber, firstOfMonth, longDate, monthGrid, monthYear, todayISO } from "@/lib/dates";
import { ease } from "@/lib/motion";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export interface DayMark {
  /** Cuántos turnos hay ese día: se dibuja como punto debajo del número. */
  count?: number;
  /** No se puede elegir: el local está cerrado, el día pasó o quedó fuera de la ventana. */
  disabled?: boolean;
  /**
   * Se puede elegir para ver qué pasa ese día, pero no para reservar. Sirve para que tocar la
   * fecha siempre muestre algo: los turnos que haya y el motivo por el que no se puede reservar.
   */
  muted?: boolean;
}

interface MonthCalendarProps {
  /** Cualquier día del mes que se está mirando. */
  month: string;
  onMonthChange: (iso: string) => void;
  selected: string | null;
  onSelect: (iso: string) => void;
  markOf?: (iso: string) => DayMark;
  /** Meses a los que no se puede llegar con las flechas (el mes de ese día, inclusive). */
  minDate?: string;
  maxDate?: string;
  /** Aclaración bajo el calendario: la regla que aplica a quien está mirando. */
  hint?: string;
  className?: string;
}

/**
 * Calendario mensual: el mes entero de un vistazo, con los días que tienen turnos marcados.
 * Es el mismo control para la agenda del local y para la del cliente; lo que cambia es qué
 * días llegan habilitados y hasta dónde dejan navegar las flechas.
 */
export function MonthCalendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  markOf,
  minDate,
  maxDate,
  hint,
  className,
}: MonthCalendarProps) {
  const today = todayISO();
  const weeks = useMemo(() => monthGrid(month), [month]);
  const first = firstOfMonth(month);
  const canGoBack = !minDate || first > firstOfMonth(minDate);
  const canGoForward = !maxDate || first < firstOfMonth(maxDate);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold capitalize">{monthYear(month)}</p>
        <div className="flex items-center">
          <button
            type="button"
            aria-label="Mes anterior"
            disabled={!canGoBack}
            onClick={() => onMonthChange(addMonths(first, -1))}
            className="icon-btn h-10 w-10 text-secondary disabled:opacity-30"
          >
            <ChevronLeft size={19} />
          </button>
          <button
            type="button"
            aria-label="Mes siguiente"
            disabled={!canGoForward}
            onClick={() => onMonthChange(addMonths(first, 1))}
            className="icon-btn h-10 w-10 text-secondary disabled:opacity-30"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1" aria-hidden>
        {WEEKDAYS.map((d, i) => (
          <span key={`${d}-${i}`} className="text-center text-[11px] font-medium text-secondary">
            {d}
          </span>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={first}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: ease.enter } }}
          exit={{ opacity: 0, transition: { duration: 0.1, ease: ease.exit } }}
          role="radiogroup"
          aria-label="Día"
          className="grid grid-cols-7 gap-1"
        >
          {weeks.flat().map((iso, i) =>
            iso === null ? (
              <span key={`pad-${i}`} aria-hidden />
            ) : (
              <DayCell key={iso} iso={iso} isToday={iso === today} active={iso === selected} mark={markOf?.(iso) ?? {}} onSelect={onSelect} />
            ),
          )}
        </m.div>
      </AnimatePresence>

      {hint && <p className="px-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function DayCell({
  iso,
  isToday,
  active,
  mark,
  onSelect,
}: {
  iso: string;
  isToday: boolean;
  active: boolean;
  mark: DayMark;
  onSelect: (iso: string) => void;
}) {
  const count = mark.count ?? 0;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={`${longDate(iso)}${count ? ` · ${count} turnos` : ""}`}
      disabled={mark.disabled}
      onClick={() => onSelect(iso)}
      className={cn(
        "tap relative flex aspect-square flex-col items-center justify-center rounded-xl text-[15px] font-semibold tabular-nums transition-colors",
        active ? "bg-primary text-on-primary shadow-cta" : "text-ink hover:bg-surface-low",
        !active && isToday && "ring-1 ring-primary",
        !active && mark.muted && "text-secondary",
        mark.disabled && "opacity-40",
      )}
    >
      <span className="leading-none">{dayNumber(iso)}</span>
      <span className={cn("mt-1 h-1 w-1 rounded-full", count ? (active ? "bg-on-primary" : "bg-primary") : "bg-transparent")} aria-hidden />
    </button>
  );
}
