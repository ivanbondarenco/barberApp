"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/cn";
import { addDays, dayNumber, dayShort, longDate, todayISO, workWeek } from "@/lib/dates";

/**
 * Tira compacta de 7 días (lunes a domingo) para la agenda en el teléfono: deja el día elegido a
 * la vista sin empujar la lista de turnos hacia abajo como el mes entero. Se cambia de semana con
 * las flechas o deslizando el dedo.
 */
export function WeekStrip({
  selected,
  onSelect,
  countOf,
  closedOf,
}: {
  selected: string;
  onSelect: (iso: string) => void;
  /** Turnos del día: se dibuja como punto. */
  countOf: (iso: string) => number;
  /** El local no abre ese día: se atenúa, pero se puede elegir para consultar. */
  closedOf?: (iso: string) => boolean;
}) {
  const today = todayISO();
  const days = workWeek(selected, 0, true);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const go = (weeks: number) => onSelect(addDays(selected, weeks * 7));

  return (
    <div
      className="flex items-center gap-0.5"
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        // Solo un gesto claramente horizontal cambia de semana: el vertical es scroll.
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(t.clientY - start.y) * 1.5) go(dx < 0 ? 1 : -1);
      }}
    >
      <button type="button" aria-label="Semana anterior" onClick={() => go(-1)} className="icon-btn -ml-2 h-11 w-8 text-secondary">
        <ChevronLeft size={18} />
      </button>
      <div role="radiogroup" aria-label="Semana" className="grid min-w-0 flex-1 grid-cols-7 gap-0.5">
        {days.map((iso) => {
          const active = iso === selected;
          const count = countOf(iso);
          const closed = closedOf?.(iso) ?? false;
          return (
            <button
              key={iso}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${longDate(iso)}${iso === today ? " (hoy)" : ""}${count ? ` · ${count} turnos` : ""}${closed ? " · cerrado" : ""}`}
              onClick={() => onSelect(iso)}
              className={cn(
                "tap flex min-h-14 flex-col items-center justify-center rounded-xl transition-colors",
                active ? "bg-primary text-on-primary shadow-cta" : "text-ink hover:bg-surface-low",
                !active && iso === today && "ring-1 ring-primary",
                !active && closed && "text-secondary opacity-60",
              )}
            >
              <span className={cn("text-[11px] font-medium leading-none", active ? "text-on-primary/80" : "text-secondary")}>{dayShort(iso)}</span>
              <span className="mt-1 text-[16px] font-bold leading-none tabular-nums">{dayNumber(iso)}</span>
              <span className={cn("mt-1 h-1 w-1 rounded-full", count ? (active ? "bg-on-primary" : "bg-primary") : "bg-transparent")} aria-hidden />
            </button>
          );
        })}
      </div>
      <button type="button" aria-label="Semana siguiente" onClick={() => go(1)} className="icon-btn -mr-2 h-11 w-8 text-secondary">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
