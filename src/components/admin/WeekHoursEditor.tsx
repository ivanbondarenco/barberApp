"use client";

import { Plus, X } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { minutesToTime, timeToMinutes } from "@/lib/dates";
import { dayRanges, MAX_RANGES_PER_DAY, normalizeRanges } from "@/lib/schedule";
import type { BusinessHours, DayHours, TimeRange } from "@/lib/types";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
/** De 06:00 a 23:30, cada media hora. */
const TIMES = Array.from({ length: 36 }, (_, i) => minutesToTime(6 * 60 + i * 30));

/**
 * Horario de la semana editado en memoria (sin guardar en cada cambio, a diferencia del horario
 * del local): se guarda junto con el formulario que lo contiene. Lo usa la ficha del barbero.
 */
export function WeekHoursEditor({
  value,
  onChange,
  idPrefix,
}: {
  value: BusinessHours;
  onChange: (next: BusinessHours) => void;
  idPrefix: string;
}) {
  const setDay = (i: number, day: DayHours) => onChange(value.map((d, k) => (k === i ? day : d)));

  const setRanges = (i: number, ranges: TimeRange[]) => {
    // Mientras edita puede quedar una franja al revés: se guarda igual y la marca el error.
    const sorted = [...ranges].sort((a, b) => a.open.localeCompare(b.open));
    setDay(i, { ...value[i], ranges: sorted, open: sorted[0].open, close: sorted[sorted.length - 1].close });
  };

  return (
    <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest">
      {ORDER.map((i) => {
        const day = value[i];
        const ranges = dayRanges(day);
        const problem = day.closed ? null : normalizeRanges(ranges);
        return (
          <li key={i} className="flex flex-col gap-2 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm font-medium">{DAYS[i]}</span>
              <Switch
                checked={!day.closed}
                onChange={(open) => setDay(i, { ...day, closed: !open })}
                label={`${DAYS[i]}: trabaja`}
              />
            </div>
            {day.closed ? (
              <p className="text-[13px] text-secondary">No trabaja</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {ranges.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <select
                      id={`${idPrefix}-${i}-${idx}-open`}
                      aria-label={`Entrada ${DAYS[i]} franja ${idx + 1}`}
                      value={r.open}
                      onChange={(e) => setRanges(i, ranges.map((x, k) => (k === idx ? { ...x, open: e.target.value } : x)))}
                      className="field flex-1 px-2 py-2 text-center text-sm"
                    >
                      {TIMES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <span className="text-[13px] text-secondary">a</span>
                    <select
                      aria-label={`Salida ${DAYS[i]} franja ${idx + 1}`}
                      value={r.close}
                      onChange={(e) => setRanges(i, ranges.map((x, k) => (k === idx ? { ...x, close: e.target.value } : x)))}
                      className="field flex-1 px-2 py-2 text-center text-sm"
                    >
                      {TIMES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    {ranges.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setRanges(i, ranges.filter((_, k) => k !== idx))}
                        className="tap grid size-11 shrink-0 place-items-center rounded-full text-secondary hover:bg-surface-low"
                        aria-label={`Quitar franja ${idx + 1} de ${DAYS[i]}`}
                      >
                        <X size={16} />
                      </button>
                    ) : (
                      <span className="size-11 shrink-0" />
                    )}
                  </div>
                ))}
                {typeof problem === "string" && <p className="text-xs text-error">{problem}</p>}
                {ranges.length < MAX_RANGES_PER_DAY && (
                  <button
                    type="button"
                    onClick={() => {
                      const from = timeToMinutes(ranges[ranges.length - 1].close) + 60;
                      const last = timeToMinutes(TIMES[TIMES.length - 1]);
                      if (from + 30 > last) return;
                      setRanges(i, [...ranges, { open: minutesToTime(from), close: minutesToTime(Math.min(from + 4 * 60, last)) }]);
                    }}
                    className="tap flex min-h-11 items-center gap-1 self-start text-[13px] font-semibold text-primary"
                  >
                    <Plus size={14} /> Agregar horario
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Primer error del horario, para no dejar guardar uno inválido. */
export function weekHoursError(hours: BusinessHours): string | null {
  for (const day of hours) {
    if (day.closed) continue;
    const result = normalizeRanges(dayRanges(day));
    if (typeof result === "string") return result;
  }
  return null;
}
