"use client";

import * as m from "motion/react-m";
import { ChevronRight, PackageCheck, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { ProductVisual } from "@/components/marketplace/ProductVisual";
import { NAV, Page } from "@/components/motion/Page";
import { EmptyState, Section } from "@/components/ui/States";
import { dayNumber, dayShort, timeToMinutes, todayISO } from "@/lib/dates";
import { money } from "@/lib/format";
import { listItem } from "@/lib/motion";
import { productsTotal } from "@/lib/pricing";
import { adjustStock } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";

export default function AdminTiendaPage() {
  const appointments = useAppStore((s) => s.appointments);
  const products = useAppStore((s) => s.products);
  const today = todayISO();

  const orders = useMemo(
    () =>
      appointments
        .filter((a) => a.status === "confirmado" && a.products.length > 0 && a.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || timeToMinutes(a.time) - timeToMinutes(b.time)),
    [appointments, today],
  );
  const reserved = orders.reduce((n, o) => n + productsTotal(o), 0);
  const lowStock = products.filter((p) => p.active && p.stock <= 3);

  return (
    <Page className="gap-5 px-5 pb-6 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface-lowest p-4 shadow-xs">
          <p className="text-[13px] text-secondary">Para entregar</p>
          <p className="text-2xl font-bold tabular-nums">{orders.reduce((n, o) => n + o.products.reduce((q, p) => q + p.qty, 0), 0)}</p>
        </div>
        <div className="rounded-2xl bg-surface-lowest p-4 shadow-xs">
          <p className="text-[13px] text-secondary">Valor reservado</p>
          <p className="text-2xl font-bold tabular-nums">{money(reserved)}</p>
        </div>
      </div>

      <Section title="Entregas en el sillón">
        {orders.length === 0 ? (
          <EmptyState icon={PackageCheck} title="Nada pendiente" text="Cuando un cliente sume productos a su turno, aparece acá." className="py-6" />
        ) : (
          <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
            {orders.map((o, i) => (
              <m.li key={o.id} custom={i} variants={listItem} initial="hidden" animate="show">
                <Link href={`/admin/turno/${o.id}`} transitionTypes={[...NAV.forward]} className="row">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{o.clientName}</span>
                    <span className="block truncate text-[13px] text-secondary">
                      {o.date === today ? "Hoy" : `${dayShort(o.date)} ${dayNumber(o.date)}`} {o.time} · {o.products.map((p) => `${p.name}${p.qty > 1 ? ` ×${p.qty}` : ""}`).join(", ")}
                    </span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums">{money(productsTotal(o))}</span>
                  <ChevronRight size={18} className="text-secondary" aria-hidden />
                </Link>
              </m.li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Reponer stock">
        {lowStock.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="Stock al día" className="py-6" />
        ) : (
          <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
            {lowStock.map((p) => (
              <li key={p.id} className="row">
                <ProductVisual shape={p.shape} className="h-10 w-10 shrink-0 overflow-hidden rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{p.name}</span>
                  <span className="text-[13px] font-semibold text-error">{p.stock === 0 ? "Sin stock" : `Quedan ${p.stock}`}</span>
                </span>
                <button type="button" onClick={() => void adjustStock(p.id, 5)} className="tap chip bg-primary-fixed py-1.5 text-primary">
                  +5
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Page>
  );
}
