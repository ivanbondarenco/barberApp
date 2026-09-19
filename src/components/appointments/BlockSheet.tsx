"use client";

import { useEffect, useMemo, useState } from "react";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { longDate, minutesToTime, timeToMinutes } from "@/lib/dates";
import { openingHours, SLOT_STEP_MIN } from "@/lib/schedule";
import { createBlock } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";

/** Alta de bloqueo de horario (almuerzo, franco, capacitación). */
export function BlockSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const barbers = useAppStore((s) => s.barbers).filter((b) => b.active);
  const businessHours = useAppStore((s) => s.businessHours);
  const [barberId, setBarberId] = useState("");
  const [start, setStart] = useState("13:00");
  const [end, setEnd] = useState("14:00");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const hours = openingHours(date, businessHours) ?? { open: "09:00", close: "20:00" };
  const times = useMemo(() => {
    const list: string[] = [];
    for (let t = timeToMinutes(hours.open); t <= timeToMinutes(hours.close); t += SLOT_STEP_MIN) list.push(minutesToTime(t));
    return list;
  }, [hours.open, hours.close]);

  useEffect(() => {
    if (open) {
      setBarberId(barbers[0]?.id ?? "");
      setReason("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Bloquear horario"
      subtitle={longDate(date)}
      footer={
        <button
          type="button"
          disabled={saving || !reason.trim() || end <= start}
          onClick={async () => {
            setSaving(true);
            const result = await createBlock({ barberId, date, start, end, reason: reason.trim() });
            setSaving(false);
            if (result.ok) onClose();
          }}
          className="tap btn-primary"
        >
          {saving ? "Guardando…" : `Bloquear ${start}–${end}`}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Barbero" htmlFor="bl-barber">
          <select id="bl-barber" className="field" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · Sillón {b.chair}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde" htmlFor="bl-start">
            <select id="bl-start" className="field" value={start} onChange={(e) => setStart(e.target.value)}>
              {times.slice(0, -1).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Hasta" htmlFor="bl-end" error={end <= start ? "Debe ser después del inicio" : undefined}>
            <select id="bl-end" className="field" value={end} onChange={(e) => setEnd(e.target.value)}>
              {times.slice(1).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Motivo" htmlFor="bl-reason">
          <input id="bl-reason" className="field" placeholder="Almuerzo, franco, capacitación…" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
