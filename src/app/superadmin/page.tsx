"use client";

import { Store } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PublicShell } from "@/components/layout/PublicShell";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState, SkeletonList } from "@/components/ui/States";
import { BILLING_STATUS_LABEL, type BillingStatus } from "@/lib/billing";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { toast } from "@/store/useToast";

/** Lo que devuelve GET /api/superadmin/shops (ver SuperadminShop en src/server/billing.ts). */
interface ShopRow {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  status: BillingStatus;
  exempt: boolean;
  trialEndsAt: string;
  paidUntil: string | null;
  price: number;
  subscription: string | null;
  owner: string | null;
  appointments30d: number;
  lastActivity: string | null;
}

type Action = { shop: ShopRow; kind: "payment" | "trial" };
type Filter = "todas" | BillingStatus;

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");

const STATUS_TONE: Record<BillingStatus, string> = {
  trial: "bg-primary-fixed text-primary",
  active: "bg-mint text-mint-ink",
  past_due: "bg-amber-container text-amber-ink",
  suspended: "bg-error-container text-error",
};

/**
 * Panel de la plataforma: todas las barberías con su suscripción. Solo para las cuentas de
 * SUPERADMIN_IDENTIFIERS; a cualquier otro el servidor le responde como si no existiera.
 */
export default function SuperadminPage() {
  const [shops, setShops] = useState<ShopRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("todas");
  const [action, setAction] = useState<Action | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/superadmin/shops", { credentials: "same-origin", cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { shops?: ShopRow[]; error?: string };
      if (res.ok && data.shops) setShops(data.shops);
      else setError(res.status === 401 ? "Iniciá sesión con tu cuenta de superadmin." : "No encontrado.");
    })().catch(() => setError("Sin conexión. Probá de nuevo."));
  }, []);

  const visible = useMemo(() => (shops ?? []).filter((s) => filter === "todas" || s.status === filter), [shops, filter]);

  return (
    <PublicShell title="Barberías" fallbackHref="/">
      <div className="flex flex-col gap-4 px-4 pb-6 pt-1">
        {error ? (
          <EmptyState
            icon={Store}
            title="Superadmin"
            text={error}
            action={
              <Link href="/" className="text-link">
                Ir al ingreso
              </Link>
            }
          />
        ) : !shops ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            <Segmented
              label="Estado"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "todas", label: "Todas", count: shops.length },
                { value: "trial", label: "Prueba", count: shops.filter((s) => s.status === "trial").length },
                { value: "active", label: "Al día", count: shops.filter((s) => s.status === "active").length },
                { value: "past_due", label: "Vencidas", count: shops.filter((s) => s.status === "past_due").length },
                { value: "suspended", label: "Susp.", count: shops.filter((s) => s.status === "suspended").length },
              ]}
            />
            {visible.length === 0 ? (
              <EmptyState icon={Store} title="Nada por acá" text="No hay barberías con ese estado." className="py-6" />
            ) : (
              <ul className="flex flex-col gap-3">
                {visible.map((s) => (
                  <li key={s.id} className="rounded-2xl bg-surface-lowest p-4 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold">{s.name}</p>
                        <p className="truncate text-[13px] text-secondary">
                          /b/{s.slug} · {s.owner ?? "sin dueño"}
                        </p>
                      </div>
                      <span className={cn("chip shrink-0", STATUS_TONE[s.status])}>
                        {s.exempt ? "Exenta" : BILLING_STATUS_LABEL[s.status]}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                      {[
                        ["Creada", date(s.createdAt)],
                        ["Prueba hasta", date(s.trialEndsAt)],
                        ["Pagada hasta", date(s.paidUntil)],
                        ["Precio", money(s.price)],
                        ["Turnos (30 días)", String(s.appointments30d)],
                        ["Última actividad", date(s.lastActivity)],
                        ["Mercado Pago", s.subscription ?? "—"],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-baseline justify-between gap-2">
                          <dt className="text-secondary">{label}</dt>
                          <dd className="truncate font-semibold tabular-nums">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" className="tap btn-secondary min-h-11" onClick={() => setAction({ shop: s, kind: "payment" })}>
                        Registrar pago
                      </button>
                      <button type="button" className="tap btn-secondary min-h-11" onClick={() => setAction({ shop: s, kind: "trial" })}>
                        Extender prueba
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <ActionSheet action={action} onClose={() => setAction(null)} onDone={(list) => setShops(list)} />
    </PublicShell>
  );
}

function ActionSheet({ action, onClose, onDone }: { action: Action | null; onClose: () => void; onDone: (shops: ShopRow[]) => void }) {
  const [months, setMonths] = useState("1");
  const [days, setDays] = useState("15");
  const [method, setMethod] = useState<"transferencia" | "efectivo">("transferencia");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!action) return;
    setMonths("1");
    setDays("15");
    setAmount("");
    setNote("");
  }, [action]);

  const submit = async () => {
    if (!action) return;
    const body =
      action.kind === "payment"
        ? { action: "payment", months: Number(months), method, amount: amount ? Number(amount) : undefined, note: note || undefined }
        : { action: "trial", days: Number(days) };
    setBusy(true);
    try {
      const res = await fetch(`/api/superadmin/shops/${encodeURIComponent(action.shop.id)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { shops?: ShopRow[]; error?: string };
      if (res.ok && data.shops) {
        onDone(data.shops);
        toast(action.kind === "payment" ? "Pago registrado" : "Prueba extendida", "success");
        onClose();
      } else toast(data.error ?? "No se pudo guardar", "error");
    } catch {
      toast("Sin conexión. Probá de nuevo.", "error");
    }
    setBusy(false);
  };

  const suggested = action ? action.shop.price * (Number(months) || 0) : 0;

  return (
    <Sheet
      open={!!action}
      onClose={onClose}
      title={action?.kind === "payment" ? "Registrar pago" : "Extender prueba"}
      subtitle={action?.shop.name}
      footer={
        <button type="button" onClick={submit} disabled={busy} className="tap btn-primary">
          {busy ? "Guardando…" : action?.kind === "payment" ? "Registrar pago" : "Extender prueba"}
        </button>
      }
    >
      {action?.kind === "payment" ? (
        <div className="flex flex-col gap-4">
          <Segmented
            label="Medio"
            value={method}
            onChange={setMethod}
            options={[
              { value: "transferencia", label: "Transferencia" },
              { value: "efectivo", label: "Efectivo" },
            ]}
          />
          <Field label="Meses" htmlFor="sa-months" hint="Se suman desde el vencimiento (o desde hoy si ya venció).">
            <input id="sa-months" type="number" min={1} max={24} inputMode="numeric" className="field" value={months} onChange={(e) => setMonths(e.target.value)} />
          </Field>
          <Field label="Monto" htmlFor="sa-amount" hint={`Vacío: ${money(suggested)} (precio actual × meses).`}>
            <input id="sa-amount" type="number" min={0} inputMode="numeric" className="field" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Nota" htmlFor="sa-note">
            <input id="sa-note" className="field" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Comprobante, referencia…" />
          </Field>
        </div>
      ) : (
        <Field label="Días" htmlFor="sa-days" hint="Se suman al final de la prueba (o desde hoy si ya terminó).">
          <input id="sa-days" type="number" min={1} max={365} inputMode="numeric" className="field" value={days} onChange={(e) => setDays(e.target.value)} />
        </Field>
      )}
    </Sheet>
  );
}
