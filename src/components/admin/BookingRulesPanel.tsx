"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/ui/Field";
import { BUFFER_OPTIONS, SLOT_STEP_OPTIONS, windowLabel } from "@/lib/schedule";
import type { BookingRules } from "@/lib/types";
import { updateBookingRules } from "@/store/actions";
import { useBookingRules } from "@/store/useRules";

const WINDOW_OPTIONS = [7, 14, 21, 30, 45, 60, 90];
const LEAD_OPTIONS = [0, 15, 30, 60, 120, 180, 240, 720, 1440];
const CANCEL_OPTIONS = [0, 1, 2, 3, 6, 12, 24, 48];
const CASH_OPTIONS = [1, 2, 3, 4, 6, 12, 24];

const minutesLabel = (m: number) => (m === 0 ? "Sin mínimo" : m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} h` : `${m} min`);
const hoursLabel = (h: number) => (h === 1 ? "1 hora antes" : `${h} horas antes`);

/** Las opciones fijas más el valor actual, por si se guardó uno que no está en la lista. */
const withCurrent = (options: readonly number[], current: number) =>
  [...new Set([...options, current])].sort((a, b) => a - b);

/**
 * Reglas de reserva del local. Cada cambio se guarda solo, como el horario.
 * Lo que se cambia acá vale para las reservas nuevas; las ya tomadas no se tocan.
 */
export function BookingRulesPanel() {
  const rules = useBookingRules();
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const save = async (patch: Partial<BookingRules>) => {
    clearTimeout(timer.current);
    setStatus("saving");
    const result = await updateBookingRules(patch);
    setStatus(result.ok ? "saved" : "idle");
    if (result.ok) timer.current = setTimeout(() => setStatus("idle"), 2500);
  };

  const select = (
    id: string,
    key: keyof BookingRules,
    options: readonly number[],
    label: (n: number) => string,
  ) => (
    <select id={id} className="field" value={rules[key]} onChange={(e) => void save({ [key]: Number(e.target.value) })}>
      {withCurrent(options, rules[key]).map((n) => (
        <option key={n} value={n}>
          {label(n)}
        </option>
      ))}
    </select>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 px-1">
        <p className="text-[13px] text-secondary">
          Cómo reservan tus clientes. Los cambios valen para las reservas nuevas y se guardan solos.
        </p>
        <span aria-live="polite" className="flex min-h-5 shrink-0 items-center gap-1 text-xs font-semibold text-mint-ink">
          {status === "saving" && <span className="text-secondary">Guardando…</span>}
          {status === "saved" && (
            <>
              <Check size={14} aria-hidden /> Guardado
            </>
          )}
        </span>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-surface-lowest p-4 shadow-xs">
        <p className="section-title">Agenda</p>
        <Field label="Los turnos arrancan cada" htmlFor="br-step" hint="Con servicios de 45 minutos, 15 evita huecos muertos.">
          {select("br-step", "slotStepMin", SLOT_STEP_OPTIONS, (n) => `${n} minutos`)}
        </Field>
        <Field label="Tiempo libre entre turnos" htmlFor="br-buffer" hint="Para limpiar y preparar el sillón. Se suma después de cada turno.">
          {select("br-buffer", "bufferMin", BUFFER_OPTIONS, (n) => (n === 0 ? "Sin tiempo extra" : `${n} minutos`))}
        </Field>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-surface-lowest p-4 shadow-xs">
        <p className="section-title">Clientes</p>
        <Field label="Pueden reservar con hasta" htmlFor="br-window" hint="Vos y tus barberos agendan sin límite.">
          {select("br-window", "windowDays", WINDOW_OPTIONS, (n) => `${windowLabel(n)} de anticipación`)}
        </Field>
        <Field label="Anticipación mínima para un turno del día" htmlFor="br-lead">
          {select("br-lead", "minLeadMin", LEAD_OPTIONS, minutesLabel)}
        </Field>
        <Field
          label="Cancelan o reprograman sin cargo hasta"
          htmlFor="br-cancel"
          hint="Dentro de ese plazo la seña vuelve como crédito. Después, queda para el local."
        >
          {select("br-cancel", "cancelHours", CANCEL_OPTIONS, (n) => (n === 0 ? "Hasta la hora del turno" : hoursLabel(n)))}
        </Field>
        <Field label="Seña en efectivo en el local hasta" htmlFor="br-cash" hint="Solo si aceptás seña en efectivo (en Señas).">
          {select("br-cash", "cashDeadlineHours", CASH_OPTIONS, hoursLabel)}
        </Field>
      </div>
    </div>
  );
}
