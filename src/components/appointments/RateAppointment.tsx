"use client";

import * as m from "motion/react-m";
import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import type { Appointment } from "@/lib/types";
import { rateAppointment } from "@/store/actions";

/**
 * Reseña de un turno terminado. Es lo único que mueve el rating que ven los demás clientes,
 * así que se califica una sola vez y solo sobre un turno que realmente ocurrió.
 */
export function RateAppointment({ appointment, barberName }: { appointment: Appointment; barberName?: string }) {
  const [saving, setSaving] = useState(false);
  const [hovered, setHovered] = useState(0);

  if (appointment.status !== "completado") return null;

  const given = appointment.rating ?? 0;
  const shown = hovered || given;

  const rate = async (value: number) => {
    if (given || saving) return;
    setSaving(true);
    await rateAppointment(appointment.id, value);
    setSaving(false);
  };

  return (
    <section className="rounded-2xl bg-surface-lowest p-4 text-center shadow-xs">
      <p className="text-[15px] font-medium">
        {given ? "Gracias por tu reseña" : `¿Cómo estuvo tu corte${barberName ? ` con ${barberName}` : ""}?`}
      </p>
      <div
        className="mt-3 flex items-center justify-center gap-1"
        role="radiogroup"
        aria-label="Calificación del turno"
        onMouseLeave={() => setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <m.button
            key={value}
            type="button"
            role="radio"
            aria-checked={given === value}
            aria-label={`${value} ${value === 1 ? "estrella" : "estrellas"}`}
            disabled={!!given || saving}
            whileTap={given ? undefined : { scale: 0.85 }}
            transition={spring.pop}
            onMouseEnter={() => !given && setHovered(value)}
            onFocus={() => !given && setHovered(value)}
            onClick={() => void rate(value)}
            className={cn(
              "tap flex h-11 w-11 items-center justify-center rounded-full",
              given ? "cursor-default" : "hover:bg-surface-low",
            )}
          >
            <Star
              size={26}
              className={cn(value <= shown ? "fill-primary text-primary" : "text-surface-highest")}
              aria-hidden
            />
          </m.button>
        ))}
      </div>
      {!given && <p className="mt-1 text-[13px] text-secondary">Tu reseña ayuda a otros clientes a elegir.</p>}
    </section>
  );
}
