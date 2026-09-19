"use client";

import { Copy, CreditCard, Landmark, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { requestDepositPayment } from "@/lib/payments";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

type DigitalMethod = "mercadopago" | "transferencia";

interface CheckoutSheetProps {
  open: boolean;
  onClose: () => void;
  amount: number;
  description: string;
  onApproved: (method: DigitalMethod) => Promise<void> | void;
  onRejected?: () => void;
}

/** Pago de la seña 50% (Mercado Pago simulado o transferencia). */
export function CheckoutSheet({ open, onClose, amount, description, onApproved, onRejected }: CheckoutSheetProps) {
  const info = useAppStore((s) => s.businessInfo);
  const [method, setMethod] = useState<DigitalMethod>("mercadopago");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (open) setProcessing(false);
  }, [open]);

  const pay = async (simulateReject = false) => {
    setProcessing(true);
    const result = await requestDepositPayment({
      appointmentRef: description,
      amount: simulateReject ? 0 : amount,
      description,
      method,
    });
    if (result.status === "approved") {
      await onApproved(method);
    } else if (onRejected) {
      onRejected();
    } else {
      toast("El pago fue rechazado. Probá con otro medio.", "error");
    }
    setProcessing(false);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copiado", "success");
    } catch {
      toast(text);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={() => !processing && onClose()}
      title="Pagar seña"
      subtitle={description}
      footer={
        <button type="button" disabled={processing} onClick={() => pay()} className="tap btn-primary">
          {processing
            ? "Procesando…"
            : method === "mercadopago"
              ? `Pagar ${money(amount)} con Mercado Pago`
              : `Ya transferí ${money(amount)}`}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-surface-low py-4 text-center">
          <p className="text-[13px] text-secondary">Seña 50%</p>
          <p className="text-4xl font-bold tracking-tight tabular-nums text-primary">{money(amount)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Medio de pago">
          {(
            [
              { value: "mercadopago", label: "Mercado Pago", icon: CreditCard },
              { value: "transferencia", label: "Transferencia", icon: Landmark },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={method === value}
              onClick={() => setMethod(value)}
              className={cn(
                "tap flex flex-col items-center gap-1.5 rounded-2xl py-3 text-sm font-semibold transition-colors",
                method === value ? "bg-primary text-on-primary shadow-cta" : "bg-surface-low text-ink",
              )}
            >
              <Icon size={20} aria-hidden /> {label}
            </button>
          ))}
        </div>

        {method === "transferencia" && (
          <div className="divide-y divide-surface-high rounded-2xl bg-surface-low">
            {[
              { label: "Alias", value: info.transferAlias },
              { label: "CBU", value: info.transferCbu },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs text-secondary">{row.label}</p>
                  <p className="truncate font-mono text-sm font-semibold">{row.value}</p>
                </div>
                <button type="button" onClick={() => copy(row.value)} aria-label={`Copiar ${row.label}`} className="icon-btn text-primary">
                  <Copy size={17} />
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="flex items-center gap-1.5 text-xs text-secondary">
          <ShieldCheck size={15} className="text-primary" aria-hidden /> Se descuenta del total del servicio.
        </p>
        {onRejected && method === "mercadopago" && (
          <button type="button" disabled={processing} onClick={() => pay(true)} className="self-start text-xs text-secondary underline underline-offset-2">
            Simular pago rechazado (demo)
          </button>
        )}
      </div>
    </Sheet>
  );
}
