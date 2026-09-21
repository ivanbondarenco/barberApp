"use client";

import * as m from "motion/react-m";
import { Lock, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Page } from "@/components/motion/Page";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Section } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { dayNumber, dayShort, longDate, monthShort, todayISO } from "@/lib/dates";
import { firstOpenDay } from "@/lib/schedule";
import { daySummary } from "@/lib/finance";
import { money } from "@/lib/format";
import { listItem, spring } from "@/lib/motion";
import { closeCash, openCash } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";

export default function CierrePage() {
  const appointments = useAppStore((s) => s.appointments);
  const cashRegister = useAppStore((s) => s.cashRegister);
  const closures = useAppStore((s) => s.cashClosures);
  const hours = useAppStore((s) => s.businessHours);
  // El mismo día que muestran la agenda y finanzas: si hoy el local está cerrado, el próximo
  // día abierto. Cerrar la caja de un día que no existe no tendría sentido.
  const today = useMemo(() => firstOpenDay(todayISO(), hours), [hours]);
  const summary = useMemo(() => daySummary(appointments, today), [appointments, today]);

  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const countedValue = counted === "" ? null : Number(counted);
  const difference = countedValue === null ? null : countedValue - summary.cash;

  return (
    <Page className="gap-5 px-5 pb-6 pt-2">
      <section className="rounded-3xl bg-surface-lowest p-5 shadow-xs">
        <p className="text-[13px] capitalize text-secondary">{longDate(today)}</p>
        <p className="text-4xl font-bold tracking-tight tabular-nums">{money(summary.total)}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-surface-high pt-4 text-center">
          <div>
            <p className="text-[11px] text-secondary">Efectivo</p>
            <p className="font-bold tabular-nums">{money(summary.cash)}</p>
          </div>
          <div>
            <p className="text-[11px] text-secondary">Mercado Pago</p>
            <p className="font-bold tabular-nums">{money(summary.byMethod.mercadopago)}</p>
          </div>
          <div>
            <p className="text-[11px] text-secondary">Transferencia</p>
            <p className="font-bold tabular-nums">{money(summary.byMethod.transferencia)}</p>
          </div>
        </div>
        {summary.pendingCount > 0 && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-error-container/60 px-3 py-2 text-[13px] text-error">
            <TriangleAlert size={16} aria-hidden /> {summary.pendingCount} turnos sin cobrar · {money(summary.pending)}
          </p>
        )}
      </section>

      {cashRegister.open ? (
        <Section title="Arqueo de efectivo">
          <div className="flex flex-col gap-3 rounded-2xl bg-surface-lowest p-4 shadow-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface-low px-3 py-2.5">
                <p className="text-xs text-secondary">Esperado</p>
                <p className="text-xl font-bold tabular-nums">{money(summary.cash)}</p>
              </div>
              <Field label="Contado" htmlFor="counted">
                <input id="counted" inputMode="numeric" placeholder={String(summary.cash)} value={counted} onChange={(e) => setCounted(e.target.value.replace(/\D/g, ""))} className="field text-right text-lg font-bold" />
              </Field>
            </div>
            {difference !== null && (
              <m.p
                key={Math.sign(difference)}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, transition: spring.pop }}
                className={cn("flex justify-between rounded-xl px-3 py-2 text-sm font-semibold", difference === 0 ? "bg-mint text-mint-ink" : "bg-error-container text-error")}
              >
                <span>{difference === 0 ? "Sin diferencias" : difference > 0 ? "Sobrante" : "Faltante"}</span>
                <span className="tabular-nums">{money(Math.abs(difference))}</span>
              </m.p>
            )}
            <input aria-label="Observaciones" placeholder="Observaciones (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={120} className="field" />
            <button type="button" onClick={() => setConfirmOpen(true)} className="tap btn-primary">
              <Lock size={16} /> Cerrar caja
            </button>
          </div>
        </Section>
      ) : (
        <div className="flex items-center justify-between rounded-2xl bg-surface-lowest px-4 py-3 shadow-xs">
          <span className="text-[15px] font-medium">La caja está cerrada</span>
          <button type="button" onClick={() => void openCash()} className="tap rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
            Abrir caja
          </button>
        </div>
      )}

      <Section title="Cierres anteriores">
        <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
          {closures.length === 0 && <li className="row text-sm text-secondary">Todavía no hay cierres.</li>}
          {closures.slice(0, 10).map((c, i) => {
            const diff = c.countedCash - c.expectedCash;
            return (
              <m.li key={c.id} custom={i} variants={listItem} initial="hidden" animate="show" className="row">
                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-low leading-none">
                  <span className="text-[10px] uppercase text-secondary">{dayShort(c.date)}</span>
                  <span className="text-base font-bold">{dayNumber(c.date)}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium tabular-nums">{money(c.total)}</span>
                  <span className="block truncate text-[13px] text-secondary">
                    {monthShort(c.date)} · efectivo {money(c.countedCash)}
                  </span>
                </span>
                <span className={cn("chip", diff === 0 ? "bg-mint text-mint-ink" : "bg-error-container text-error")}>
                  {diff === 0 ? "OK" : `${diff > 0 ? "+" : "−"}${money(Math.abs(diff))}`}
                </span>
              </m.li>
            );
          })}
        </ul>
      </Section>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="¿Cerrar la caja?"
        description={`Total ${money(summary.total)} · efectivo contado ${money(countedValue ?? summary.cash)}. No se podrán registrar cobros hasta reabrirla.`}
        confirmLabel="Cerrar caja"
        onConfirm={async () => {
          const result = await closeCash({
            date: today,
            expectedCash: summary.cash,
            countedCash: countedValue ?? summary.cash,
            digital: summary.digital,
            total: summary.total,
            notes: notes.trim() || undefined,
          });
          if (result.ok) {
            setCounted("");
            setNotes("");
          }
        }}
      />
    </Page>
  );
}
