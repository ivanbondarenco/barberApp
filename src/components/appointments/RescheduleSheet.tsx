"use client";

import { useCallback, useEffect, useState } from "react";
import { SlotPicker } from "@/components/booking/SlotPicker";
import { Sheet } from "@/components/ui/Sheet";
import { dayNumber, dayShort } from "@/lib/dates";
import type { Appointment } from "@/lib/types";
import { updateAppointment } from "@/store/actions";

interface RescheduleSheetProps {
  appointment: Appointment | null;
  onClose: () => void;
  title?: string;
}

/** Reprogramar (cliente) o mover (admin) con la misma disponibilidad que la reserva. */
export function RescheduleSheet({ appointment, onClose, title = "Reprogramar" }: RescheduleSheetProps) {
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (appointment) {
      setDate(appointment.date);
      setTime(null);
    }
  }, [appointment]);

  const onTime = useCallback((t: string | null) => setTime(t), []);
  const onDate = useCallback((d: string) => setDate(d), []);

  return (
    <Sheet
      open={!!appointment}
      onClose={onClose}
      title={title}
      subtitle={appointment ? `Actual: ${dayShort(appointment.date)} ${dayNumber(appointment.date)} · ${appointment.time} hs` : undefined}
      footer={
        <button
          type="button"
          disabled={!date || !time || saving}
          onClick={async () => {
            if (!appointment || !date || !time) return;
            setSaving(true);
            const result = await updateAppointment(appointment.id, { date, time }, `Movido a ${dayShort(date)} ${dayNumber(date)} · ${time} hs`);
            setSaving(false);
            if (result.ok) onClose();
          }}
          className="tap btn-primary"
        >
          {saving ? "Guardando…" : date && time ? `Confirmar ${dayShort(date)} ${dayNumber(date)} · ${time}` : "Elegí un horario"}
        </button>
      }
    >
      {appointment && (
        <SlotPicker
          barberId={appointment.barberId}
          durationMin={appointment.durationMin}
          date={date}
          time={time}
          onDateChange={onDate}
          onTimeChange={onTime}
          excludeAppointmentId={appointment.id}
        />
      )}
    </Sheet>
  );
}
