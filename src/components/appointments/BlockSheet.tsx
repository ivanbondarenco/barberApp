"use client";

import { useEffect, useMemo, useState } from "react";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";
import { addDays, fromISODate, longDate, minutesToTime, timeToMinutes } from "@/lib/dates";
import { barberHours, openingHours } from "@/lib/schedule";
import { createBlock } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";
import { useBookingRules } from "@/store/useRules";

/** Cómo se repite el bloqueo. */
type Mode = "dia" | "repite" | "varios";

const MODES: { value: Mode; label: string }[] = [
  { value: "dia", label: "Este día" },
  { value: "repite", label: "Se repite" },
  { value: "varios", label: "Varios días" },
];

const WEEKDAYS = [
  { day: 1, label: "Lu" },
  { day: 2, label: "Ma" },
  { day: 3, label: "Mi" },
  { day: 4, label: "Ju" },
  { day: 5, label: "Vi" },
  { day: 6, label: "Sá" },
  { day: 0, label: "Do" },
];

/**
 * Alta de bloqueo de horario. Además del rato de un día (un trámite), cubre lo que se repite
 * (el almuerzo de todos los días) y lo que dura varios días (vacaciones, una capacitación).
 */
export function BlockSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const allBarbers = useAppStore((s) => s.barbers);
  const barbers = useMemo(() => allBarbers.filter((b) => b.active), [allBarbers]);
  const businessHours = useAppStore((s) => s.businessHours);
  const session = useAppStore((s) => s.session);
  const rules = useBookingRules();
  /** El barbero bloquea solo su sillón (el servidor rechaza otro): no elige. */
  const ownBarberId = session?.role === "barbero" ? session.barberId : undefined;
  const [barberId, setBarberId] = useState("");
  const [mode, setMode] = useState<Mode>("dia");
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState("13:00");
  const [end, setEnd] = useState("14:00");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const hoursOf = barberHours(
    barbers.find((b) => b.id === barberId),
    businessHours,
  );
  const opening = openingHours(date, hoursOf) ?? { open: "08:00", close: "22:00" };
  const times = useMemo(() => {
    const list: string[] = [];
    const step = Math.min(rules.slotStepMin, 30);
    for (let t = timeToMinutes(opening.open); t <= timeToMinutes(opening.close); t += step) list.push(minutesToTime(t));
    return list;
  }, [opening.open, opening.close, rules.slotStepMin]);

  useEffect(() => {
    if (open) {
      setBarberId(ownBarberId ?? barbers[0]?.id ?? "");
      setReason("");
      setMode("dia");
      setAllDay(false);
      setWeekdays([fromISODate(date).getDay()]);
      setUntil(addDays(date, 6));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Varios días" es casi siempre un franco o vacaciones: el día entero por defecto.
  useEffect(() => {
    if (mode === "varios") setAllDay(true);
  }, [mode]);

  // Día entero: de la primera a la última hora posible, para que tape cualquier franja.
  const from = allDay ? "00:00" : start;
  const to = allDay ? "23:59" : end;

  const errors = {
    time: !allDay && end <= start ? "Debe ser después del inicio" : undefined,
    weekdays: mode === "repite" && !weekdays.length ? "Elegí al menos un día" : undefined,
    until: mode === "varios" && (!until || until < date) ? "Tiene que ser después del primer día" : undefined,
  };
  const invalid = !reason.trim() || !!errors.time || !!errors.weekdays || !!errors.until;

  const summary =
    mode === "varios"
      ? `Bloquear hasta el ${longDate(until || date)}`
      : mode === "repite"
        ? "Bloquear todas las semanas"
        : allDay
          ? "Bloquear el día"
          : `Bloquear ${start}–${end}`;

  const toggleDay = (day: number) =>
    setWeekdays((list) => (list.includes(day) ? list.filter((d) => d !== day) : [...list, day]));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Bloquear horario"
      subtitle={mode === "dia" ? longDate(date) : `Desde el ${longDate(date)}`}
      footer={
        <button
          type="button"
          disabled={saving || invalid}
          onClick={async () => {
            setSaving(true);
            const result = await createBlock({
              barberId,
              date,
              start: from,
              end: to,
              reason: reason.trim(),
              ...(mode === "varios" ? { until } : {}),
              ...(mode === "repite" ? { weekdays, ...(until ? { until } : {}) } : {}),
            });
            setSaving(false);
            if (result.ok) onClose();
          }}
          className="tap btn-primary"
        >
          {saving ? "Guardando…" : summary}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        {!ownBarberId && (
          <Field label="Barbero" htmlFor="bl-barber">
            <select id="bl-barber" className="field" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · Sillón {b.chair}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Segmented label="Cuándo" options={MODES} value={mode} onChange={setMode} />

        {mode === "repite" && (
          <Field label="Días de la semana" htmlFor="bl-days" error={errors.weekdays}>
            <div id="bl-days" role="group" aria-label="Días de la semana" className="flex gap-1.5">
              {WEEKDAYS.map(({ day, label }) => {
                const active = weekdays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "tap min-h-11 flex-1 rounded-xl text-[13px] font-semibold",
                      active ? "bg-primary text-on-primary" : "bg-surface-low text-ink",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {mode !== "dia" && (
          <Field
            label={mode === "varios" ? "Último día" : "Hasta (opcional)"}
            htmlFor="bl-until"
            hint={mode === "repite" ? "Vacío: se repite hasta que lo borres." : undefined}
            error={errors.until}
          >
            <input
              id="bl-until"
              type="date"
              className="field"
              min={date}
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </Field>
        )}

        <label className="flex min-h-11 items-center gap-3 text-[15px]">
          <input type="checkbox" className="h-5 w-5 accent-[var(--color-primary)]" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          Todo el día
        </label>

        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde" htmlFor="bl-start">
              <select id="bl-start" className="field" value={start} onChange={(e) => setStart(e.target.value)}>
                {times.slice(0, -1).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Hasta" htmlFor="bl-end" error={errors.time}>
              <select id="bl-end" className="field" value={end} onChange={(e) => setEnd(e.target.value)}>
                {times.slice(1).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <Field label="Motivo" htmlFor="bl-reason">
          <input
            id="bl-reason"
            className="field"
            placeholder={mode === "varios" ? "Vacaciones, licencia…" : "Almuerzo, franco, capacitación…"}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </div>
    </Sheet>
  );
}
