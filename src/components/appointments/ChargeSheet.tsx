"use client";

import { Banknote, CreditCard, Landmark } from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";
import { money, paymentMethodLabel } from "@/lib/format";
import { appointmentTotals } from "@/lib/pricing";
import type { Appointment, PaymentMethod } from "@/lib/types";
import { chargeAppointment, registerDeposit } from "@/store/actions";

export type ChargeMode = "deposit" | "balance";

const METHODS: { value: PaymentMethod; icon: typeof Banknote }[] = [
  { value: "efectivo", icon: Banknote },
  { value: "mercadopago", icon: CreditCard },
  { value: "transferencia", icon: Landmark },
];

export function ChargeSheet({
  appointment,
  mode,
  onClose,
}: {
  appointment: Appointment | null;
  mode: ChargeMode;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (appointment) setMethod("efectivo");
  }, [appointment]);

  const t = appointment ? appointmentTotals(appointment) : null;
  const amount = !t ? 0 : mode === "deposit" ? t.deposit : t.dueAtChair;

  const confirm = async () => {
    if (!appointment) return;
    setSaving(true);
    const result =
      mode === "deposit"
        ? await registerDeposit(appointment.id, method, `Seña ${money(amount)} registrada`)
        : await chargeAppointment(appointment.id, method, `Cobrado ${money(amount)} · ${paymentMethodLabel[method]}`);
    setSaving(false);
    if (result.ok) onClose();
  };

  return (
    <Sheet
      open={!!appointment}
      onClose={onClose}
      title={mode === "deposit" ? "Registrar seña" : "Cobrar"}
      subtitle={appointment ? `${appointment.clientName} · ${appointment.serviceName}` : undefined}
      footer={
        <button type="button" onClick={confirm} disabled={saving} className="tap btn-primary">
          {saving ? "Procesando…" : `${mode === "deposit" ? "Registrar" : "Cobrar"} ${money(amount)}`}
        </button>
      }
    >
      {t && appointment && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-surface-low p-4 text-center">
            <p className="text-[13px] text-secondary">{mode === "deposit" ? "Seña 50%" : "A cobrar ahora"}</p>
            <p className="text-4xl font-bold tracking-tight tabular-nums text-primary">{money(amount)}</p>
            {mode === "balance" && (
              <p className="mt-1 text-xs text-secondary">
                Servicio {money(t.service)}
                {t.depositPaid > 0 && ` − seña ${money(t.depositPaid)}`}
                {t.products > 0 && ` + productos ${money(t.products)}`}
              </p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Medio de pago">
            {METHODS.map(({ value, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={method === value}
                onClick={() => setMethod(value)}
                className={cn(
                  "tap flex flex-col items-center gap-1.5 rounded-2xl py-3 text-xs font-semibold transition-colors",
                  method === value ? "bg-primary text-on-primary shadow-cta" : "bg-surface-low text-ink",
                )}
              >
                <Icon size={20} aria-hidden /> {paymentMethodLabel[value]}
              </button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
