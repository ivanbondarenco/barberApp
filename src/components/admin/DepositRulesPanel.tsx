"use client";

import { Ban, Percent } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import {
  CASH_DEPOSIT_DEADLINE_HOURS,
  DEPOSIT_RATE_OPTIONS,
  FREE_CANCELLATION_HOURS,
  NO_SHOW_DEPOSIT_LIMIT,
} from "@/lib/pricing";
import { setAllowCash, setDepositRate } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";

const label = (rate: number) => (rate === 0 ? "Sin seña" : `${Math.round(rate * 100)}%`);

/** Reglas de seña del local. La tasa la decide cada barbería; el resto son reglas del sistema. */
export function DepositRulesPanel() {
  const { allowCash, rate } = useAppStore((s) => s.depositSettings);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-surface-lowest p-4 shadow-xs">
        <p className="flex items-center gap-1.5 text-[15px] font-medium">
          <Percent size={16} className="text-primary" aria-hidden /> Seña que pedís
        </p>
        <p className="mt-1 text-[13px] text-secondary">
          Se calcula sobre el precio de cada servicio y se descuenta del total. Cambiarla no afecta a los turnos ya
          reservados.
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Porcentaje de seña">
          {DEPOSIT_RATE_OPTIONS.map((option) => {
            const active = Math.abs(rate - option) < 0.001;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => !active && void setDepositRate(option)}
                className={cn(
                  "tap min-h-11 rounded-2xl text-sm font-semibold transition-colors",
                  active ? "bg-primary text-on-primary shadow-cta" : "bg-surface-low text-ink",
                )}
              >
                {label(option)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
        {rate > 0 && (
          <label className="row cursor-pointer">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">Seña en efectivo</span>
              <span className="block text-[13px] text-secondary">
                Hasta {CASH_DEPOSIT_DEADLINE_HOURS}h antes, en el local
              </span>
            </span>
            <Switch checked={allowCash} onChange={(v) => void setAllowCash(v)} label="Seña en efectivo" />
          </label>
        )}
        <div className="row">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">Cancelación sin cargo</span>
            <span className="block text-[13px] text-secondary">
              Hasta {FREE_CANCELLATION_HOURS}h antes
              {rate > 0 ? " · la seña queda como crédito" : ""}
            </span>
          </span>
        </div>
        {rate > 0 && (
          <div className="row">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary">
              <Ban size={17} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">Ausencias reiteradas</span>
              <span className="block text-[13px] text-secondary">
                Con {NO_SHOW_DEPOSIT_LIMIT} ausencias, ese cliente solo puede reservar pagando la seña por adelantado
              </span>
            </span>
          </div>
        )}
      </div>

      {rate === 0 && (
        <p className="text-[13px] text-secondary">
          Sin seña, los turnos se confirman al instante y todo se cobra en el sillón. Tené en cuenta que las ausencias
          no tienen costo para el cliente.
        </p>
      )}
    </div>
  );
}
