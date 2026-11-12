"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ChevronRight, Package, Percent, Scissors, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductFormSheet } from "@/components/admin/ProductFormSheet";
import { ServiceFormSheet } from "@/components/admin/ServiceFormSheet";
import { ProductVisual } from "@/components/marketplace/ProductVisual";
import { NAV, Page } from "@/components/motion/Page";
import { Fab } from "@/components/ui/Fab";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/States";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { ease, listItem } from "@/lib/motion";
import { appointmentTotals, depositPercent, serviceDepositRate, splitDeposit } from "@/lib/pricing";
import type { Product, Service } from "@/lib/types";
import { saveProduct, saveService } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";

type Tab = "servicios" | "productos";

export default function CatalogoPage() {
  const services = useAppStore((s) => s.services);
  const products = useAppStore((s) => s.products);
  const depositRate = useAppStore((s) => s.depositSettings.rate);
  const appointments = useAppStore((s) => s.appointments);
  const [tab, setTab] = useState<Tab>("servicios");
  const [serviceSheet, setServiceSheet] = useState<{ open: boolean; service?: Service }>({ open: false });
  const [productSheet, setProductSheet] = useState<{ open: boolean; product?: Product }>({ open: false });

  // Desde otras pantallas (?nuevo=servicio) se llega directo al alta.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("nuevo") !== "servicio") return;
    setServiceSheet({ open: true });
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const ticket = useMemo(() => {
    const done = appointments.filter((a) => a.status === "completado");
    return done.length ? Math.round(done.reduce((n, a) => n + appointmentTotals(a).grandTotal, 0) / done.length) : 0;
  }, [appointments]);

  return (
    <Page className="gap-4 px-5 pb-28 pt-1">
      <Segmented
        label="Sección"
        value={tab}
        onChange={setTab}
        options={[
          { value: "servicios", label: "Servicios", count: services.length },
          { value: "productos", label: "Productos", count: products.length },
        ]}
      />

      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: ease.enter } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          className="flex flex-col gap-4"
        >
          {tab === "servicios" && (
            <>
              {services.length > 0 && (
                <p className="px-1 text-sm text-secondary">
                  Ticket promedio <strong className="font-semibold text-ink">{money(ticket)}</strong> · {services.filter((s) => s.active).length} visibles
                </p>
              )}
              {services.length === 0 ? (
                <EmptyState
                  icon={Scissors}
                  title="Todavía no cargaste tus servicios"
                  text="Cargá los que hacés en tu local, con tu precio y tu duración. Son tuyos: no los comparte ninguna otra barbería."
                  action={
                    <button type="button" onClick={() => setServiceSheet({ open: true })} className="tap btn-primary px-6">
                      Crear mi primer servicio
                    </button>
                  }
                />
              ) : (
                <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
                  <AnimatePresence initial={false}>
                    {services.map((s, i) => (
                      <m.li key={s.id} layout custom={i} variants={listItem} initial="hidden" animate="show" exit="exit" className={cn("flex items-center", !s.active && "opacity-60")}>
                        <button type="button" onClick={() => setServiceSheet({ open: true, service: s })} className="row min-w-0 flex-1 pr-2">
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-[15px] font-medium">{s.name}</span>
                              {s.featured && <Star size={13} className="shrink-0 fill-primary text-primary" aria-label="Destacado" />}
                            </span>
                            <span className="block text-[13px] text-secondary tabular-nums">
                              {money(s.price)} · {s.durationMin} min{serviceDepositRate(s, depositRate) > 0 ? ` · seña ${money(splitDeposit(s.price, serviceDepositRate(s, depositRate)).deposit)}` : ""}
                            </span>
                          </span>
                        </button>
                        <span className="pr-4">
                          <Switch checked={s.active} onChange={(active) => void saveService({ ...s, active }, false)} label={`${s.name} visible`} />
                        </span>
                      </m.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
              {/* La seña se configura en un solo lugar: Configuración › Señas. */}
              <Link href="/admin/configuracion?tab=senas" transitionTypes={[...NAV.forward]} className="tap row card">
                <Percent size={18} className="shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">Configurar seña</span>
                  <span className="block text-[13px] text-secondary">
                    {depositRate > 0 ? `Pedís el ${depositPercent(depositRate)} del precio al reservar` : "Hoy los turnos se reservan sin seña"}
                  </span>
                </span>
                <ChevronRight size={17} className="text-secondary" aria-hidden />
              </Link>
            </>
          )}

          {tab === "productos" && (
            <>
              <p className="px-1 text-sm text-secondary">
                Valor en stock <strong className="font-semibold text-ink">{money(products.reduce((n, p) => n + p.price * p.stock, 0))}</strong>
              </p>
              {products.length === 0 ? (
                <EmptyState icon={Package} title="Sin productos" text="Agregá productos para vender en el sillón." />
              ) : (
                <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
                  <AnimatePresence initial={false}>
                    {products.map((p, i) => (
                      <m.li key={p.id} layout custom={i} variants={listItem} initial="hidden" animate="show" exit="exit" className={cn("flex items-center", !p.active && "opacity-60")}>
                        <button type="button" onClick={() => setProductSheet({ open: true, product: p })} className="row min-w-0 flex-1 pr-2">
                          <ProductVisual shape={p.shape} className="h-11 w-11 shrink-0 overflow-hidden rounded-xl" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-medium">{p.name}</span>
                            <span className="block text-[13px] tabular-nums">
                              <span className="text-secondary">{money(p.price)} · </span>
                              <span className={p.stock <= 3 ? "font-semibold text-error" : "text-secondary"}>stock {p.stock}</span>
                            </span>
                          </span>
                        </button>
                        <span className="pr-4">
                          <Switch checked={p.active} onChange={(active) => void saveProduct({ ...p, active }, false)} label={`${p.name} publicado`} />
                        </span>
                      </m.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </>
          )}

        </m.div>
      </AnimatePresence>

      <Fab
        label={tab === "servicios" ? "Servicio" : "Producto"}
        onClick={() => (tab === "servicios" ? setServiceSheet({ open: true }) : setProductSheet({ open: true }))}
      />

      <ServiceFormSheet open={serviceSheet.open} service={serviceSheet.service} onClose={() => setServiceSheet({ open: false })} />
      <ProductFormSheet open={productSheet.open} product={productSheet.product} onClose={() => setProductSheet({ open: false })} />
    </Page>
  );
}

