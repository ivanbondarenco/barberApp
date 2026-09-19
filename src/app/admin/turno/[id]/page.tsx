"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ChevronDown, ChevronRight, CircleX, Minus, NotebookPen, Pencil, Phone, Plus, Smartphone, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AppointmentFormSheet } from "@/components/appointments/AppointmentFormSheet";
import { AppointmentTimeline } from "@/components/appointments/AppointmentTimeline";
import { ChargeSheet, type ChargeMode } from "@/components/appointments/ChargeSheet";
import { StatusChip } from "@/components/appointments/StatusChip";
import { ProductVisual } from "@/components/marketplace/ProductVisual";
import { NAV, Page } from "@/components/motion/Page";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState, Section } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { longDate } from "@/lib/dates";
import { money, paymentMethodLabel, whatsappLink } from "@/lib/format";
import { ease, spring } from "@/lib/motion";
import { appointmentTotals } from "@/lib/pricing";
import { addProductToAppointment, cancelAppointment, deleteAppointment, removeProductFromAppointment } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

export default function AdminTurnoPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const appointment = useAppStore((s) => s.appointments.find((a) => a.id === id));
  const barber = useAppStore((s) => s.barbers.find((b) => b.id === appointment?.barberId));
  const products = useAppStore((s) => s.products);
  const cashOpen = useAppStore((s) => s.cashRegister.open);

  const [editOpen, setEditOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [charging, setCharging] = useState<ChargeMode | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);

  if (!appointment) {
    return (
      <Page className="px-5">
        <EmptyState
          icon={CircleX}
          title="Este turno ya no existe"
          action={
            <Link href="/admin/agenda" transitionTypes={[...NAV.back]} className="tap btn-primary px-6">
              Volver a la agenda
            </Link>
          }
        />
      </Page>
    );
  }

  const t = appointmentTotals(appointment);
  const active = appointment.status === "confirmado";
  const depositPaid = appointment.deposit.status === "abonada";

  const openCharge = (mode: ChargeMode) => {
    if (!cashOpen) return toast("Abrí la caja para registrar cobros", "error");
    setCharging(mode);
  };

  return (
    <Page className="pb-28">
      <div className="flex flex-col gap-5 px-5 pt-2">
        <section className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[15px] capitalize text-secondary">{longDate(appointment.date)}</p>
            <p className="text-5xl font-bold tracking-tight tabular-nums">{appointment.time}</p>
            <p className="mt-1 text-lg font-semibold">{appointment.serviceName}</p>
            <p className="text-sm text-secondary">
              {barber?.name} · {appointment.durationMin} min · {appointment.source === "manual" ? "Cargado en el local" : "Reserva online"}
            </p>
          </div>
          <StatusChip appointment={appointment} className="mt-1" />
        </section>

        {/* Cliente */}
        <div className="flex items-center gap-2 rounded-2xl bg-surface-lowest p-2 pl-4 shadow-xs">
          {appointment.clientId ? (
            <Link href={`/admin/clientes/${appointment.clientId}`} transitionTypes={[...NAV.forward]} className="min-w-0 flex-1 py-1">
              <span className="flex items-center gap-1 text-[15px] font-semibold">
                <span className="truncate">{appointment.clientName}</span>
                <ChevronRight size={16} className="shrink-0 text-secondary" aria-hidden />
              </span>
              <span className="block text-[13px] text-secondary">{appointment.clientPhone}</span>
            </Link>
          ) : (
            <span className="min-w-0 flex-1 py-1">
              <span className="block truncate text-[15px] font-semibold">{appointment.clientName}</span>
              <span className="block text-[13px] text-secondary">{appointment.clientPhone}</span>
            </span>
          )}
          <a href={`tel:${appointment.clientPhone.replace(/\s/g, "")}`} aria-label="Llamar" className="icon-btn bg-surface-low text-primary">
            <Phone size={18} />
          </a>
          <a
            href={whatsappLink(appointment.clientPhone, `Hola ${appointment.clientName.split(" ")[0]}, te escribimos de D.S Studio por tu turno de las ${appointment.time}.`)}
            target="_blank"
            rel="noreferrer"
            aria-label="WhatsApp"
            className="icon-btn bg-surface-low text-primary"
          >
            <Smartphone size={18} />
          </a>
        </div>

        {/* Cuenta */}
        <Section title="Cuenta">
          <div className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
            <div className="row">
              <span className="flex-1 text-[15px]">Servicio</span>
              <span className="text-[15px] tabular-nums">{money(t.service)}</span>
            </div>
            <div className="row">
              <span className="flex-1 text-[15px]">
                Seña 50%
                <span className={cn("block text-xs", depositPaid ? "text-mint-ink" : "text-secondary")}>
                  {depositPaid ? `Abonada · ${paymentMethodLabel[appointment.deposit.method]}` : "Pendiente"}
                </span>
              </span>
              <span className="text-[15px] tabular-nums">{depositPaid ? `−${money(t.depositPaid)}` : money(t.deposit)}</span>
            </div>
            <AnimatePresence initial={false}>
              {appointment.products.map((p) => (
                <m.div key={p.productId} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="row">
                  <span className="min-w-0 flex-1 truncate text-[15px]">{p.name}</span>
                  {active && (
                    <span className="flex items-center gap-1.5">
                      <button type="button" aria-label="Quitar" onClick={() => void removeProductFromAppointment(appointment.id, p.productId)} className="tap flex h-10 w-10 items-center justify-center rounded-full bg-surface-low">
                        <Minus size={14} />
                      </button>
                      <span className="w-4 text-center text-sm font-bold tabular-nums">{p.qty}</span>
                      <button type="button" aria-label="Sumar" onClick={() => void addProductToAppointment(appointment.id, p.productId)} className="tap flex h-10 w-10 items-center justify-center rounded-full bg-surface-low">
                        <Plus size={14} />
                      </button>
                    </span>
                  )}
                  <span className="w-20 text-right text-[15px] tabular-nums">{money(p.unitPrice * p.qty)}</span>
                </m.div>
              ))}
            </AnimatePresence>
            {active && (
              <button type="button" onClick={() => setProductsOpen(true)} className="row text-[15px] font-medium text-primary">
                <Plus size={18} aria-hidden /> Agregar producto
              </button>
            )}
            <div className="row bg-surface-low/60">
              <span className="flex-1 text-[15px] font-semibold">{appointment.status === "completado" ? "Cobrado" : "A cobrar"}</span>
              <span className="text-xl font-bold tabular-nums">
                {money(appointment.status === "completado" ? appointment.balancePayment?.amount ?? 0 : t.dueAtChair)}
              </span>
            </div>
          </div>
        </Section>

        {appointment.notes && (
          <p className="flex items-start gap-2 rounded-2xl bg-surface-lowest px-4 py-3 text-[15px] shadow-xs">
            <NotebookPen size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden /> {appointment.notes}
          </p>
        )}

        {active ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setEditOpen(true)} className="tap btn-secondary">
              <Pencil size={16} /> Editar
            </button>
            <button type="button" onClick={() => setConfirm("cancel")} className="tap btn-destructive">
              <CircleX size={16} /> Cancelar
            </button>
          </div>
        ) : (
          appointment.status === "cancelado" && (
            <button type="button" onClick={() => setConfirm("delete")} className="tap btn-destructive">
              <Trash2 size={16} /> Eliminar definitivamente
            </button>
          )
        )}

        <div>
          <button type="button" onClick={() => setActivityOpen((v) => !v)} className="flex min-h-11 w-full items-center justify-between px-1 text-sm font-semibold text-secondary">
            Actividad
            <ChevronDown size={18} className={cn("transition-transform", activityOpen && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {activityOpen && (
              <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: ease.standard }} className="overflow-hidden">
                <div className="rounded-2xl bg-surface-lowest p-4 shadow-xs">
                  <AppointmentTimeline appointment={appointment} />
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Acción principal */}
      {active && (
        <m.div
          initial={{ y: 80 }}
          animate={{ y: 0, transition: spring.sheet }}
          className="sticky bottom-0 z-10 mt-auto border-t border-surface-high bg-surface-lowest/95 px-5 py-3 backdrop-blur-xl"
        >
          <button type="button" onClick={() => openCharge(depositPaid ? "balance" : "deposit")} className="tap btn-primary text-[15px]">
            {depositPaid ? `Cobrar ${money(t.dueAtChair)}` : `Registrar seña ${money(t.deposit)}`}
          </button>
        </m.div>
      )}

      <AppointmentFormSheet open={editOpen} onClose={() => setEditOpen(false)} appointment={appointment} />
      <ChargeSheet appointment={charging ? appointment : null} mode={charging ?? "balance"} onClose={() => setCharging(null)} />

      <Sheet open={productsOpen} onClose={() => setProductsOpen(false)} title="Agregar producto" subtitle="Se suma a la cuenta del turno">
        <ul className="flex flex-col gap-2">
          {products
            .filter((p) => p.active)
            .map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={p.stock === 0}
                  onClick={async () => {
                    const result = await addProductToAppointment(appointment.id, p.id);
                    if (result.ok) {
                      toast(`${p.name} agregado`, "success");
                      setProductsOpen(false);
                    }
                  }}
                  className="tap flex w-full items-center gap-3 rounded-2xl bg-surface-low p-2 pr-4 text-left disabled:opacity-50"
                >
                  <ProductVisual shape={p.shape} className="h-12 w-12 shrink-0 overflow-hidden rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{p.name}</span>
                    <span className="text-[13px] text-secondary">{p.stock === 0 ? "Sin stock" : `Stock ${p.stock}`}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{money(p.price)}</span>
                </button>
              </li>
            ))}
        </ul>
      </Sheet>

      <ConfirmDialog
        open={confirm === "cancel"}
        onClose={() => setConfirm(null)}
        destructive
        title="¿Cancelar este turno?"
        description={depositPaid ? `La seña de ${money(t.depositPaid)} queda como crédito a favor de ${appointment.clientName}.` : "La seña no estaba abonada."}
        confirmLabel="Cancelar turno"
        onConfirm={async () => {
          await cancelAppointment(appointment.id);
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        destructive
        title="¿Eliminar el turno?"
        description="Se borra del historial. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={async () => {
          const result = await deleteAppointment(appointment.id);
          if (result.ok) router.replace("/admin/agenda", { transitionTypes: [...NAV.back] });
        }}
      />
    </Page>
  );
}
