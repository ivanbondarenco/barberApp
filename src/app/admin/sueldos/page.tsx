"use client";

import { ChevronLeft, ChevronRight, HandCoins, Percent, ReceiptText, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { NAV, Page } from "@/components/motion/Page";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState, Section } from "@/components/ui/States";
import { addMonths, dayNumber, monthRange, monthYear, shortDate, todayISO } from "@/lib/dates";
import { money } from "@/lib/format";
import { commissionLabel, payrollPreview, type PayrollPreview } from "@/lib/payroll";
import type { Advance, Barber, PayoutMethod } from "@/lib/types";
import { createAdvance, createPayout, deleteAdvance } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";

type Half = "mes" | "primera" | "segunda";

/** Período a liquidar: el mes entero o una de sus quincenas. */
function periodOf(month: string, half: Half): { from: string; to: string } {
  const { from, to } = monthRange(month);
  if (half === "primera") return { from, to: `${from.slice(0, 8)}15` };
  if (half === "segunda") return { from: `${from.slice(0, 8)}16`, to };
  return { from, to };
}

/**
 * Sueldos del equipo: lo que lleva ganado cada barbero por comisión, sus adelantos y las
 * liquidaciones. El dueño liquida y registra adelantos; el barbero ve solo lo suyo.
 */
export default function SueldosPage() {
  const session = useAppStore((s) => s.session);
  const barbers = useAppStore((s) => s.barbers);
  const appointments = useAppStore((s) => s.appointments);
  const advances = useAppStore((s) => s.advances);
  const payouts = useAppStore((s) => s.payouts);
  const isOwner = session?.role === "admin";

  const [month, setMonth] = useState(() => todayISO());
  const [half, setHalf] = useState<Half>(() => (Number(todayISO().slice(8)) <= 15 ? "primera" : "segunda"));
  const range = periodOf(month, half);

  const team = useMemo(
    () => barbers.filter((b) => (isOwner ? true : b.id === session?.barberId)).sort((a, b) => a.chair - b.chair),
    [barbers, isOwner, session?.barberId],
  );

  const [advanceFor, setAdvanceFor] = useState<Barber | null>(null);
  const [payFor, setPayFor] = useState<{ barber: Barber; preview: PayrollPreview } | null>(null);

  const receipts = useMemo(() => [...payouts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [payouts]);

  return (
    <Page className="gap-5 px-5 pb-6 pt-1">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold capitalize">{monthYear(month)}</p>
        <div className="flex items-center">
          <button type="button" aria-label="Mes anterior" onClick={() => setMonth((m) => addMonths(m, -1))} className="icon-btn h-10 w-10 text-secondary">
            <ChevronLeft size={19} />
          </button>
          <button type="button" aria-label="Mes siguiente" onClick={() => setMonth((m) => addMonths(m, 1))} className="icon-btn h-10 w-10 text-secondary">
            <ChevronRight size={19} />
          </button>
        </div>
      </div>
      <Segmented
        label="Período"
        value={half}
        onChange={setHalf}
        options={[
          { value: "primera", label: "1 al 15" },
          { value: "segunda", label: `16 al ${dayNumber(monthRange(month).to)}` },
          { value: "mes", label: "Mes completo" },
        ]}
      />

      {team.length === 0 ? (
        <EmptyState icon={HandCoins} title="Todavía no hay barberos" text="Sumalos desde Equipo para liquidarles sus comisiones." />
      ) : (
        <div className="flex flex-col gap-3">
          {team.map((barber) => (
            <BarberCard
              key={barber.id}
              barber={barber}
              preview={payrollPreview({
                barberId: barber.id,
                commission: barber.commission,
                from: range.from,
                to: range.to,
                appointments,
                advances,
                payouts,
              })}
              isOwner={isOwner}
              onAdvance={() => setAdvanceFor(barber)}
              onPay={(preview) => setPayFor({ barber, preview })}
            />
          ))}
        </div>
      )}

      <Section title={isOwner ? "Recibos" : "Mis recibos"}>
        {receipts.length === 0 ? (
          <p className="rounded-2xl bg-surface-low px-4 py-3 text-sm text-secondary">Todavía no hay liquidaciones.</p>
        ) : (
          <ul className="card overflow-hidden">
            {receipts.map((p) => (
              <li key={p.id} className="border-b border-surface-high last:border-0">
                <Link href={`/admin/sueldos/recibo/${p.id}`} transitionTypes={[...NAV.forward]} className="row hover:bg-surface-low">
                  <ReceiptText size={19} className="shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      #{p.number} · {p.barberName}
                    </span>
                    <span className="block text-xs text-secondary">
                      {shortDate(p.from)} al {shortDate(p.to)} · {p.items.length} servicios
                    </span>
                  </span>
                  <span className="text-sm font-bold tabular-nums">{money(p.net)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <AdvanceSheet barber={advanceFor} onClose={() => setAdvanceFor(null)} />
      <PaySheet target={payFor} range={range} onClose={() => setPayFor(null)} />
    </Page>
  );
}

function BarberCard({
  barber,
  preview,
  isOwner,
  onAdvance,
  onPay,
}: {
  barber: Barber;
  preview: PayrollPreview;
  isOwner: boolean;
  onAdvance: () => void;
  onPay: (preview: PayrollPreview) => void;
}) {
  const [removing, setRemoving] = useState<Advance | null>(null);
  const nothing = !preview.items.length && !preview.advances.length;

  return (
    <article className="card flex flex-col gap-3 p-4" aria-label={`Sueldo de ${barber.name}`}>
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-sm font-bold text-primary">
          {barber.initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{barber.name}</span>
          <span className="flex items-center gap-1 text-xs text-secondary">
            <Percent size={12} aria-hidden /> {commissionLabel(barber.commission)}
          </span>
        </span>
      </header>

      {!barber.commission && isOwner && (
        <p className="rounded-xl bg-amber-container px-3 py-2 text-xs text-amber-ink">
          Definí su comisión en{" "}
          <Link href="/admin/equipo" className="font-semibold underline">
            Equipo
          </Link>{" "}
          para calcular lo que lleva ganado.
        </p>
      )}

      <dl className="flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-secondary">{preview.items.length} servicios sin liquidar</dt>
          <dd className="tabular-nums">{money(preview.gross)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-secondary">Comisión</dt>
          <dd className="tabular-nums">{money(preview.earned)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-secondary">Adelantos</dt>
          <dd className="tabular-nums text-error">{preview.advancesTotal ? `−${money(preview.advancesTotal)}` : money(0)}</dd>
        </div>
        <div className="flex justify-between border-t border-surface-high pt-2 text-base font-bold">
          <dt>A cobrar</dt>
          <dd className="tabular-nums text-primary">{money(preview.net)}</dd>
        </div>
      </dl>

      {preview.advances.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-xl bg-surface-low p-2 text-xs">
          {preview.advances.map((a) => (
            <li key={a.id} className="flex items-center gap-2 px-1">
              <span className="text-secondary">{shortDate(a.date)}</span>
              <span className="min-w-0 flex-1 truncate">{a.note || "Adelanto"}</span>
              <span className="font-semibold tabular-nums">{money(a.amount)}</span>
              {isOwner && (
                <button type="button" aria-label="Eliminar adelanto" onClick={() => setRemoving(a)} className="icon-btn h-8 w-8 text-secondary">
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isOwner && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onAdvance} className="tap btn-secondary min-h-11">
            <HandCoins size={16} aria-hidden /> Adelanto
          </button>
          <button type="button" disabled={nothing} onClick={() => onPay(preview)} className="tap btn-primary min-h-11 shadow-none">
            <ReceiptText size={16} aria-hidden /> Liquidar
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        destructive
        title="¿Eliminar el adelanto?"
        description={removing ? `${money(removing.amount)} del ${shortDate(removing.date)}. Deja de descontarse.` : ""}
        confirmLabel="Eliminar"
        onConfirm={async () => {
          if (removing) await deleteAdvance(removing.id);
        }}
      />
    </article>
  );
}

function AdvanceSheet({ barber, onClose }: { barber: Barber | null; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setAmount("");
    setNote("");
    setDate(todayISO());
    setError(null);
    onClose();
  };

  const submit = async () => {
    const value = Number(amount.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return setError("Ingresá el monto");
    if (!barber) return;
    setBusy(true);
    const result = await createAdvance({ barberId: barber.id, amount: value, date, note: note || undefined });
    setBusy(false);
    if (result.ok) close();
  };

  return (
    <Sheet
      open={!!barber}
      onClose={close}
      title="Registrar adelanto"
      subtitle={barber ? `Se descuenta en la próxima liquidación de ${barber.name}` : undefined}
      footer={
        <button type="button" disabled={busy} onClick={() => void submit()} className="tap btn-primary">
          {busy ? "Guardando…" : "Registrar adelanto"}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Monto" htmlFor="adv-amount" error={error ?? undefined}>
          <div className="field flex items-center gap-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
            <span className="text-secondary">$</span>
            <input
              id="adv-amount"
              inputMode="numeric"
              className="min-w-0 flex-1 bg-transparent outline-none"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
            />
          </div>
        </Field>
        <Field label="Fecha" htmlFor="adv-date">
          <input id="adv-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
        </Field>
        <Field label="Detalle" htmlFor="adv-note" hint="Opcional">
          <input id="adv-note" className="field" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

function PaySheet({
  target,
  range,
  onClose,
}: {
  target: { barber: Barber; preview: PayrollPreview } | null;
  range: { from: string; to: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PayoutMethod>("efectivo");
  const [busy, setBusy] = useState(false);
  const preview = target?.preview;

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    const result = await createPayout({ barberId: target.barber.id, from: range.from, to: range.to, method });
    setBusy(false);
    if (!result.ok) return;
    onClose();
    router.push(`/admin/sueldos/recibo/${result.id}`, { transitionTypes: [...NAV.forward] });
  };

  return (
    <Sheet
      open={!!target}
      onClose={onClose}
      title={target ? `Liquidar a ${target.barber.name}` : "Liquidar"}
      subtitle={`Del ${shortDate(range.from)} al ${shortDate(range.to)}`}
      footer={
        <button type="button" disabled={busy} onClick={() => void submit()} className="tap btn-primary">
          {busy ? "Liquidando…" : `Pagar ${money(preview?.net ?? 0)} y generar recibo`}
        </button>
      }
    >
      {preview && (
        <div className="flex flex-col gap-4">
          <dl className="flex flex-col gap-1.5 rounded-2xl bg-surface-low p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-secondary">{preview.items.length} servicios</dt>
              <dd className="tabular-nums">{money(preview.gross)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-secondary">Comisión</dt>
              <dd className="tabular-nums">{money(preview.earned)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-secondary">{preview.advances.length} adelantos</dt>
              <dd className="tabular-nums text-error">−{money(preview.advancesTotal)}</dd>
            </div>
            <div className="flex justify-between border-t border-surface-high pt-2 text-base font-bold">
              <dt>A cobrar</dt>
              <dd className="tabular-nums">{money(preview.net)}</dd>
            </div>
          </dl>
          {preview.net < 0 && (
            <p className="rounded-xl bg-amber-container px-3 py-2 text-xs text-amber-ink">
              Los adelantos superan lo ganado: el recibo queda con saldo a favor del local.
            </p>
          )}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">¿Cómo le pagás?</p>
            <Segmented
              label="Medio de pago"
              value={method}
              onChange={setMethod}
              options={[
                { value: "efectivo", label: "Efectivo" },
                { value: "transferencia", label: "Transferencia" },
              ]}
            />
          </div>
        </div>
      )}
    </Sheet>
  );
}
