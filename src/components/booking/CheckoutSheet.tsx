"use client";

import { Copy, CreditCard, Landmark, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { HOLD_MINUTES } from "@/lib/pricing";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

export type DigitalMethod = "mercadopago" | "transferencia";

interface CheckoutSheetProps {
  open: boolean;
  onClose: () => void;
  amount: number;
  description: string;
  /**
   * Confirma el medio elegido. La pantalla que la usa reserva el turno y, según el medio,
   * manda a Mercado Pago o registra el aviso de transferencia.
   * Acá no se acredita nada: la seña la confirma el servidor.
   */
  onConfirm: (method: DigitalMethod) => Promise<void> | void;
  /** "book": el turno se está creando. "pay": ya existe y se está saldando la seña. */
  mode?: "book" | "pay";
}

/** Elección del medio para la seña del 50%. */
export function CheckoutSheet({ open, onClose, amount, description, onConfirm, mode = "book" }: CheckoutSheetProps) {
  const info = useAppStore((s) => s.businessInfo);
  const mercadopagoReady = useAppStore((s) => s.integrations.mercadopagoReady);
  const [method, setMethod] = useState<DigitalMethod>(mercadopagoReady ? "mercadopago" : "transferencia");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (open) {
      setWorking(false);
      setMethod(mercadopagoReady ? "mercadopago" : "transferencia");
    }
  }, [open, mercadopagoReady]);

  const confirm = async () => {
    setWorking(true);
    try {
      await onConfirm(method);
    } finally {
      setWorking(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copiado", "success");
    } catch {
      toast(text);
    }
  };

  const options = [
    { value: "mercadopago" as const, label: "Mercado Pago", icon: CreditCard, enabled: mercadopagoReady },
    { value: "transferencia" as const, label: "Transferencia", icon: Landmark, enabled: true },
  ].filter((o) => o.enabled);

  return (
    <Sheet
      open={open}
      onClose={() => !working && onClose()}
      title="Pagar seña"
      subtitle={description}
      footer={
        <button type="button" disabled={working} onClick={() => void confirm()} className="tap btn-primary">
          {working
            ? "Un momento…"
            : method === "mercadopago"
              ? `Pagar ${money(amount)} con Mercado Pago`
              : mode === "book"
                ? `Reservar y transferir ${money(amount)}`
                : `Ya transferí ${money(amount)}`}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-surface-low py-4 text-center">
          <p className="text-[13px] text-secondary">Seña 50%</p>
          <p className="text-4xl font-bold tracking-tight tabular-nums text-primary">{money(amount)}</p>
        </div>

        {options.length > 1 && (
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Medio de pago">
            {options.map(({ value, label, icon: Icon }) => (
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
        )}

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

        <p className="flex items-start gap-1.5 text-xs text-secondary">
          <ShieldCheck size={15} className="mt-px shrink-0 text-primary" aria-hidden />
          <span>
            Se descuenta del total del servicio.{" "}
            {method === "mercadopago"
              ? `Te guardamos el horario ${HOLD_MINUTES} minutos mientras pagás.`
              : mode === "book"
                ? "Transferí a estos datos: confirmamos tu seña cuando la veamos acreditada."
                : "Avisanos cuando hayas transferido y la confirmamos al verla acreditada."}
          </span>
        </p>
      </div>
    </Sheet>
  );
}
