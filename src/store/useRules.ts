"use client";

import { useMemo } from "react";
import { rulesOf } from "@/lib/schedule";
import type { BookingRules } from "@/lib/types";
import { useAppStore } from "./useAppStore";

/**
 * Reglas de reserva del local activo, completas. Se elige el objeto guardado y se completa en
 * un memo: devolver un objeto nuevo desde el selector haría renderizar en loop.
 */
export function useBookingRules(): BookingRules {
  const stored = useAppStore((s) => s.bookingRules);
  return useMemo(() => rulesOf({ bookingRules: stored }), [stored]);
}

