"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useClientAppointments } from "@/components/appointments/useClientAppointments";
import { ProductVisual } from "@/components/marketplace/ProductVisual";
import { NAV, Page } from "@/components/motion/Page";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";
import { dayNumber, dayShort } from "@/lib/dates";
import { money } from "@/lib/format";
import { listItem, spring } from "@/lib/motion";
import { productsTotal } from "@/lib/pricing";
import type { Appointment, ProductCategory } from "@/lib/types";
import { addProductToAppointment, removeProductFromAppointment } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

const CATEGORIES: { value: ProductCategory | "todos"; label: string }[] = [
  { value: "todos", label: "Todo" },
  { value: "ceras", label: "Ceras" },
  { value: "barba", label: "Barba" },
  { value: "afeitado", label: "Afeitado" },
  { value: "cuidado", label: "Cuidado" },
];

/** "vie 14 · 10:30" */
const turnoLabel = (a: Appointment) => `${dayShort(a.date)} ${dayNumber(a.date)} · ${a.time}`;

export default function TiendaPage() {
  const products = useAppStore((s) => s.products);
  const { upcoming, next } = useClientAppointments();
  const [category, setCategory] = useState<ProductCategory | "todos">("todos");
  const [bagOpen, setBagOpen] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);

  // Con varios turnos por delante, el cliente elige a cuál van los productos (por defecto, el próximo).
  const target = upcoming.find((a) => a.id === chosenId) ?? next;

  const visible = useMemo(
    () => products.filter((p) => p.active && (category === "todos" || p.category === category)),
    [products, category],
  );
  const qtyOf = (id: string) => target?.products.find((p) => p.productId === id)?.qty ?? 0;
  const bagCount = target?.products.reduce((n, p) => n + p.qty, 0) ?? 0;

  const add = async (productId: string) => {
    if (!target) return;
    const wasEmpty = bagCount === 0;
    const result = await addProductToAppointment(target.id, productId);
    // Solo el primero: confirma a qué turno fue sin llenar de avisos cada "+".
    if (result.ok && wasEmpty) toast(`Agregado a tu turno del ${turnoLabel(target)}`, "success");
  };
  const remove = (productId: string) => target && void removeProductFromAppointment(target.id, productId);

  return (
    <Page className="pb-24 lg:pb-28">
      <div className="px-5 pt-2">
        {upcoming.length > 1 && target ? (
          <div role="group" aria-label="Turno al que van los productos">
            <p className="text-[15px] text-secondary">¿En qué turno te los entregamos?</p>
            <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5">
              {upcoming.map((a) => {
                const active = a.id === target.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setChosenId(a.id)}
                    className={cn(
                      "tap min-h-11 shrink-0 rounded-xl border px-3 text-left text-sm font-medium",
                      active ? "border-primary bg-primary-fixed text-primary" : "border-surface-high bg-surface-lowest text-secondary",
                    )}
                  >
                    <span className="capitalize">{turnoLabel(a)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-[15px] text-secondary">
            {target ? (
              <>
                Se entregan en tu turno del <strong className="font-semibold text-ink">{turnoLabel(target)}</strong>
              </>
            ) : (
              <>
                Para sumar productos necesitás un turno.{" "}
                <Link href="/cliente/reservar" transitionTypes={[...NAV.tab]} className="font-semibold text-primary">
                  Reservar
                </Link>
              </>
            )}
          </p>
        )}
      </div>

      <div role="group" aria-label="Categorías" className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-4">
        {CATEGORIES.map((c) => {
          const active = category === c.value;
          return (
            <button
              key={c.value}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(c.value)}
              className={cn(
                "relative min-h-11 shrink-0 rounded-full px-4 text-sm font-medium",
                active ? "text-on-primary" : "bg-surface-lowest text-secondary shadow-xs",
              )}
            >
              {active && <m.span layoutId="shop-cat" transition={spring.layout} className="absolute inset-0 rounded-full bg-primary" aria-hidden />}
              <span className="relative">{c.label}</span>
            </button>
          );
        })}
      </div>

      <m.ul layout className="grid grid-cols-2 gap-3 px-5 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence mode="popLayout" initial={false}>
          {visible.map((p, i) => {
            const qty = qtyOf(p.id);
            return (
              <m.li
                key={p.id}
                layout
                custom={i}
                variants={listItem}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col overflow-hidden rounded-2xl bg-surface-lowest shadow-xs"
              >
                <ProductVisual shape={p.shape} className="aspect-[4/3] w-full" />
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="text-[13px] text-secondary">{p.size}</p>
                  </div>
                  {qty > 0 && target ? (
                    <div className="mt-auto flex flex-col gap-1.5">
                      <span className="text-[15px] font-bold tabular-nums">{money(p.price)}</span>
                      <span className="flex items-center justify-between rounded-full bg-surface-low">
                        <button
                          type="button"
                          aria-label={`Quitar ${p.name}`}
                          onClick={() => remove(p.id)}
                          className="tap flex h-11 w-11 items-center justify-center rounded-full"
                        >
                          <Minus size={16} />
                        </button>
                        <m.span key={qty} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="text-center text-sm font-bold tabular-nums">
                          {qty}
                        </m.span>
                        <button
                          type="button"
                          aria-label={`Sumar ${p.name}`}
                          disabled={p.stock === 0}
                          onClick={() => void add(p.id)}
                          className="tap flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary disabled:bg-surface-highest"
                        >
                          <Plus size={16} />
                        </button>
                      </span>
                    </div>
                  ) : (
                    <div className="mt-auto flex items-center justify-between gap-1">
                      <span className="text-[15px] font-bold tabular-nums">{money(p.price)}</span>
                      <button
                        type="button"
                        aria-label={`Agregar ${p.name}`}
                        disabled={!target || p.stock === 0}
                        onClick={() => void add(p.id)}
                        className="tap flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary shadow-cta disabled:bg-surface-highest disabled:text-secondary disabled:shadow-none"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  )}
                  {p.stock <= 3 && <p className="text-xs font-medium text-error">{p.stock === 0 ? "Sin stock" : `Quedan ${p.stock}`}</p>}
                </div>
              </m.li>
            );
          })}
        </AnimatePresence>
      </m.ul>

      <AnimatePresence>
        {target && bagCount > 0 && (
          <m.button
            type="button"
            onClick={() => setBagOpen(true)}
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: spring.sheet }}
            exit={{ y: 90, opacity: 0 }}
            // Celular: sobre la barra inferior. Escritorio: abajo, centrada en la columna de contenido
            // (a la derecha de la navegación lateral de 240px).
            className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] left-1/2 z-30 flex w-[calc(100%-2.5rem)] max-w-[440px] -translate-x-1/2 items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-on-primary shadow-md lg:bottom-6 lg:left-[calc(50%+120px)] lg:w-[440px]"
          >
            <span className="relative">
              <ShoppingBag size={20} aria-hidden />
              <m.span
                key={bagCount}
                initial={{ scale: 0.4 }}
                animate={{ scale: 1 }}
                transition={spring.pop}
                className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold"
              >
                {bagCount}
              </m.span>
            </span>
            <span className="flex-1 text-left text-sm font-medium">
              Ver bolsa
              {upcoming.length > 1 && <span className="block text-xs font-normal capitalize opacity-80">{turnoLabel(target)}</span>}
            </span>
            <span className="font-bold tabular-nums">{money(productsTotal(target))}</span>
          </m.button>
        )}
      </AnimatePresence>

      <Sheet
        open={bagOpen && !!target}
        onClose={() => setBagOpen(false)}
        title="Tu bolsa"
        subtitle={target ? `Para tu turno del ${turnoLabel(target)} · se paga con el saldo en el sillón` : undefined}
      >
        {target && (
          <>
            <ul className="divide-y divide-surface-high">
              <AnimatePresence initial={false}>
                {target.products.map((item) => (
                  <m.li key={item.productId} layout exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{item.name}</span>
                      <span className="text-[13px] text-secondary tabular-nums">{money(item.unitPrice)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Quitar ${item.name}`}
                        onClick={() => remove(item.productId)}
                        className="tap flex h-11 w-11 items-center justify-center rounded-full bg-surface-low"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-5 text-center font-bold tabular-nums">{item.qty}</span>
                      <button
                        type="button"
                        aria-label={`Sumar ${item.name}`}
                        onClick={() => void add(item.productId)}
                        className="tap flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary"
                      >
                        <Plus size={16} />
                      </button>
                    </span>
                  </m.li>
                ))}
              </AnimatePresence>
            </ul>
            <div className="mt-2 flex items-center justify-between border-t border-surface-high pt-3">
              <span className="text-[15px] font-semibold">Total productos</span>
              <span className="text-lg font-bold tabular-nums">{money(productsTotal(target))}</span>
            </div>
          </>
        )}
      </Sheet>
    </Page>
  );
}
