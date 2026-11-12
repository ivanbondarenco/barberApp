"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { Users } from "lucide-react";
import { useMemo, useState } from "react";
import { BarberFormSheet } from "@/components/admin/BarberFormSheet";
import { Page } from "@/components/motion/Page";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Fab } from "@/components/ui/Fab";
import { EmptyState } from "@/components/ui/States";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { todayISO } from "@/lib/dates";
import { ease, listItem } from "@/lib/motion";
import { barberHours, occupancy } from "@/lib/schedule";
import type { Barber } from "@/lib/types";
import { saveBarber } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";

export default function EquipoPage() {
  const barbers = useAppStore((s) => s.barbers);
  const appointments = useAppStore((s) => s.appointments);
  const hours = useAppStore((s) => s.businessHours);
  const [sheet, setSheet] = useState<{ open: boolean; barber?: Barber }>({ open: false });
  /** Apagar las reservas de un barbero lo saca de la reserva online: se confirma antes. */
  const [pausing, setPausing] = useState<Barber | null>(null);
  const today = todayISO();

  const sorted = useMemo(() => [...barbers].sort((a, b) => a.chair - b.chair), [barbers]);

  return (
    <Page className="gap-3 px-5 pb-28 pt-2">
      <p className="px-1 text-sm text-secondary">Ocupación de hoy por sillón</p>
      {sorted.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin barberos"
          text="Sumá a tu equipo para que tus clientes puedan elegir con quién atenderse."
          action={
            <button type="button" onClick={() => setSheet({ open: true })} className="tap btn-primary px-6">
              Agregar barbero
            </button>
          }
        />
      ) : (
        <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
          <AnimatePresence initial={false}>
            {sorted.map((b, i) => {
              const count = appointments.filter((a) => a.date === today && a.barberId === b.id && a.status !== "cancelado").length;
              const pct = occupancy(today, b.id, appointments, barberHours(b, hours));
              return (
                <m.li key={b.id} layout custom={i} variants={listItem} initial="hidden" animate="show" exit="exit" className={cn("flex items-center", !b.active && "opacity-60")}>
                  <button type="button" onClick={() => setSheet({ open: true, barber: b })} className="row min-w-0 flex-1 pr-2">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-sm font-bold text-primary">{b.initials}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{b.name}</span>
                      <span className="block text-[13px] text-secondary">
                        Sillón {b.chair} · {count} {count === 1 ? "turno" : "turnos"} hoy
                      </span>
                      <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-surface-high">
                        <m.span className="block h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: ease.enter }} />
                      </span>
                    </span>
                  </button>
                  <span className="flex shrink-0 flex-col items-center gap-1 pr-4">
                    <Switch
                      checked={b.active}
                      onChange={(active) => (active ? void saveBarber({ ...b, active }, false) : setPausing(b))}
                      label={`${b.name} recibe reservas`}
                    />
                    <span className="text-[11px] font-medium text-secondary" aria-hidden>
                      Recibe reservas
                    </span>
                  </span>
                </m.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
      <Fab label="Barbero" onClick={() => setSheet({ open: true })} />
      <BarberFormSheet open={sheet.open} barber={sheet.barber} onClose={() => setSheet({ open: false })} />
      <ConfirmDialog
        open={!!pausing}
        onClose={() => setPausing(null)}
        title={`¿${pausing?.name.split(" ")[0] ?? "El barbero"} deja de recibir reservas?`}
        description="Deja de aparecer para reservar online. Sus turnos ya agendados siguen igual y lo podés volver a activar cuando quieras."
        confirmLabel="Dejar de recibir"
        busyLabel="Guardando…"
        onConfirm={async () => {
          if (pausing) await saveBarber({ ...pausing, active: false }, false);
        }}
      />
    </Page>
  );
}
