"use client";

import { MessageCircle, Printer, ReceiptText, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { NAV, Page } from "@/components/motion/Page";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/States";
import { longDate, shortDate } from "@/lib/dates";
import { money, whatsappLink } from "@/lib/format";
import { commissionLabel } from "@/lib/payroll";
import { deletePayout } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";

const METHOD_LABEL = { efectivo: "Efectivo", transferencia: "Transferencia" } as const;

/**
 * Recibo de una liquidación. Se imprime (o se guarda como PDF) desde el navegador y se le
 * puede mandar el resumen al barbero por WhatsApp. Muestra lo que quedó congelado al liquidar.
 */
export default function ReciboPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const payout = useAppStore((s) => s.payouts.find((p) => p.id === id));
  const barber = useAppStore((s) => s.barbers.find((b) => b.id === payout?.barberId));
  const info = useAppStore((s) => s.businessInfo);
  const isOwner = useAppStore((s) => s.session?.role === "admin");
  const [confirm, setConfirm] = useState(false);

  if (!payout) {
    return (
      <Page className="px-5 pt-6">
        <EmptyState icon={ReceiptText} title="No encontramos el recibo" text="Puede que se haya anulado." />
      </Page>
    );
  }

  const period = `del ${shortDate(payout.from)} al ${shortDate(payout.to)}`;
  const summary = [
    `Recibo #${payout.number} · ${info.name}`,
    `${payout.barberName}, liquidación ${period}`,
    `${payout.items.length} servicios: ${money(payout.gross)}`,
    `Comisión (${commissionLabel(payout.commission)}): ${money(payout.earned)}`,
    payout.advancesTotal ? `Adelantos: −${money(payout.advancesTotal)}` : "",
    `A cobrar: ${money(payout.net)} (${METHOD_LABEL[payout.method].toLowerCase()})`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Page className="gap-4 px-5 pb-6 pt-1">
      <article className="card flex flex-col gap-5 p-5 print:shadow-none" aria-label={`Recibo número ${payout.number}`}>
        <header className="flex items-start justify-between gap-4 border-b border-surface-high pb-4">
          <div>
            <p className="text-lg font-bold">{info.name}</p>
            {info.address && <p className="text-xs text-secondary">{info.address}</p>}
          </div>
          <div className="text-right">
            <p className="label-caps">Recibo</p>
            <p className="text-lg font-bold tabular-nums">#{payout.number}</p>
            <p className="text-xs text-secondary">{longDate(payout.createdAt.slice(0, 10))}</p>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="label-caps">Barbero</dt>
            <dd className="font-semibold">{payout.barberName}</dd>
          </div>
          <div>
            <dt className="label-caps">Período</dt>
            <dd className="font-semibold">
              {shortDate(payout.from)} al {shortDate(payout.to)}
            </dd>
          </div>
          <div>
            <dt className="label-caps">Comisión</dt>
            <dd>{commissionLabel(payout.commission)}</dd>
          </div>
          <div>
            <dt className="label-caps">Pagado en</dt>
            <dd>{METHOD_LABEL[payout.method]}</dd>
          </div>
        </dl>

        <section>
          <h2 className="label-caps mb-2">Servicios</h2>
          {payout.items.length === 0 ? (
            <p className="text-sm text-secondary">Sin servicios en el período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-secondary">
                  <th className="pb-1 font-medium">Fecha</th>
                  <th className="pb-1 font-medium">Servicio</th>
                  <th className="pb-1 text-right font-medium">Precio</th>
                  <th className="pb-1 text-right font-medium">Comisión</th>
                </tr>
              </thead>
              <tbody>
                {payout.items.map((item) => (
                  <tr key={item.appointmentId} className="border-t border-surface-low">
                    <td className="py-1.5 pr-2 text-secondary">{shortDate(item.date)}</td>
                    <td className="py-1.5 pr-2">{item.serviceName}</td>
                    <td className="py-1.5 text-right tabular-nums">{money(item.price)}</td>
                    <td className="py-1.5 text-right tabular-nums">{money(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {payout.advances.length > 0 && (
          <section>
            <h2 className="label-caps mb-2">Adelantos descontados</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {payout.advances.map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span className="text-secondary">
                    {shortDate(a.date)} · {a.note || "Adelanto"}
                  </span>
                  <span className="tabular-nums">−{money(a.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <dl className="flex flex-col gap-1.5 rounded-2xl bg-surface-low p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-secondary">Total de servicios</dt>
            <dd className="tabular-nums">{money(payout.gross)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-secondary">Comisión</dt>
            <dd className="tabular-nums">{money(payout.earned)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-secondary">Adelantos</dt>
            <dd className="tabular-nums">−{money(payout.advancesTotal)}</dd>
          </div>
          <div className="flex justify-between border-t border-surface-high pt-2 text-lg font-bold">
            <dt>A cobrar</dt>
            <dd className="tabular-nums">{money(payout.net)}</dd>
          </div>
        </dl>

        <div className="mt-6 grid grid-cols-2 gap-8 text-center text-xs text-secondary">
          <p className="border-t border-outline pt-2">Firma de {info.name}</p>
          <p className="border-t border-outline pt-2">Recibí conforme · {payout.barberName}</p>
        </div>
      </article>

      <div className="flex flex-col gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className="tap btn-primary">
          <Printer size={17} aria-hidden /> Imprimir o guardar PDF
        </button>
        {isOwner && barber?.phone && (
          <a href={whatsappLink(barber.phone, summary)} target="_blank" rel="noreferrer" className="tap btn-secondary">
            <MessageCircle size={17} aria-hidden /> Mandar resumen por WhatsApp
          </a>
        )}
        {isOwner && (
          <button type="button" onClick={() => setConfirm(true)} className="tap btn-destructive">
            <Trash2 size={16} aria-hidden /> Anular liquidación
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        destructive
        title={`¿Anular el recibo #${payout.number}?`}
        description="Los servicios y los adelantos vuelven a quedar pendientes, para liquidarlos de nuevo."
        confirmLabel="Anular"
        onConfirm={async () => {
          const result = await deletePayout(payout.id);
          if (result.ok) router.replace("/admin/sueldos", { transitionTypes: [...NAV.back] });
        }}
      />
    </Page>
  );
}
