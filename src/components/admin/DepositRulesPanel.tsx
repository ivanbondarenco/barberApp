"use client";

import { Lock } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { CASH_DEPOSIT_DEADLINE_HOURS, DEPOSIT_RATE, FREE_CANCELLATION_HOURS } from "@/lib/pricing";
import { setAllowCash } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";

export function DepositRulesPanel() {
  const allowCash = useAppStore((s) => s.depositSettings.allowCash);
  const pct = `${DEPOSIT_RATE * 100}%`;

  return (
    <div className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
      <div className="row">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary">
          <Lock size={17} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">Seña fija del {pct}</span>
          <span className="block text-[13px] text-secondary">Obligatoria en todos los servicios</span>
        </span>
        <span className="chip bg-primary text-on-primary">Siempre</span>
      </div>
      <label className="row cursor-pointer">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">Seña en efectivo</span>
          <span className="block text-[13px] text-secondary">Hasta {CASH_DEPOSIT_DEADLINE_HOURS}h antes, en el local</span>
        </span>
        <Switch checked={allowCash} onChange={(v) => void setAllowCash(v)} label="Seña en efectivo" />
      </label>
      <div className="row">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">Cancelación sin cargo</span>
          <span className="block text-[13px] text-secondary">Hasta {FREE_CANCELLATION_HOURS}h antes · la seña queda como crédito</span>
        </span>
      </div>
    </div>
  );
}
