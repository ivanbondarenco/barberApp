"use client";

import * as m from "motion/react-m";
import { ArrowRight, Check, Plus, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useClientAppointments } from "@/components/appointments/useClientAppointments";
import { NAV, Page } from "@/components/motion/Page";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/States";
import { listItem } from "@/lib/motion";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

/**
 * Barberías en las que se atiende el cliente. Una sola cuenta sirve para todas: acá se suma
 * a las que quiera y deja las que ya no usa.
 */
export default function MisBarberiasPage() {
  const router = useRouter();
  const all = useAppStore((s) => s.shops);
  const mine = useAppStore((s) => s.session?.shops ?? []);
  const activeShopId = useAppStore((s) => s.session?.shop?.id);
  const membership = useAppStore((s) => s.membership);
  const { upcoming } = useClientAppointments();
  const [busy, setBusy] = useState<string | null>(null);
  // El destino queda guardado al cerrar, para que el diálogo no cambie de texto mientras sale.
  const [leaving, setLeaving] = useState<{ id: string; name: string } | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const joined = new Set(mine.map((s) => s.id));
  // Se fija al entrar: si llegó sin barberías es la bienvenida, aunque ya se haya sumado a una.
  const [firstTime] = useState(() => mine.length === 0);

  // Solo se conocen los turnos de la barbería activa; en las demás, el servidor frena la baja si hay.
  const pendingThere = leaving && leaving.id === activeShopId ? upcoming.length : 0;

  const join = async (shopId: string, name: string) => {
    setBusy(shopId);
    const result = await membership(shopId, "join");
    setBusy(null);
    if (!result.ok) return toast(result.error, "error");
    toast(`Te sumaste a ${name}`, "success");
  };

  const leave = async () => {
    if (!leaving) return;
    if (pendingThere > 0) {
      router.push("/cliente/mis-turnos", { transitionTypes: [...NAV.tab] });
      return;
    }
    const result = await membership(leaving.id, "leave");
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(`Dejaste ${leaving.name}`, "success");
  };

  return (
    <Page className="gap-4 px-5 pb-8 pt-4">
      <p className="text-[15px] text-secondary">
        {firstTime
          ? "Elegí dónde te atendés. Podés sumarte a más de una barbería con la misma cuenta."
          : "Sumate a otras barberías o dejá las que ya no usás. Tus turnos de cada una quedan en esa barbería."}
      </p>

      {all.length === 0 ? (
        <EmptyState icon={Store} title="Todavía no hay barberías" text="Cuando tu barbería se registre, vas a poder sumarte desde acá." />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Barberías">
          {all.map((s, i) => {
            const isMine = joined.has(s.id);
            return (
              <m.li key={s.id} custom={i} variants={listItem} initial="hidden" animate="show">
                {isMine ? (
                  // Ya se atiende acá: dejarla es una acción aparte y con confirmación, no un toque al pasar.
                  <div className="flex w-full items-center gap-3 rounded-2xl bg-primary-fixed py-2.5 pl-4 pr-2.5 shadow-xs">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-lowest text-primary">
                      <Store size={20} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{s.name}</span>
                      <span className="flex items-center gap-1 text-[13px] text-secondary">
                        <Check size={14} className="shrink-0 text-primary" aria-hidden />
                        {s.id === activeShopId ? "Te atendés acá · activa" : "Te atendés acá"}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => {
                        setLeaving({ id: s.id, name: s.name });
                        setLeaveOpen(true);
                      }}
                      aria-label={`Dejar ${s.name}`}
                      className="tap min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold text-error hover:bg-error-container"
                    >
                      Dejar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void join(s.id, s.name)}
                    aria-label={`Sumarme a ${s.name}`}
                    className="tap flex w-full items-center gap-3 rounded-2xl bg-surface-lowest px-4 py-3.5 text-left shadow-xs"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-low text-primary">
                      <Store size={20} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{s.name}</span>
                      <span className="block truncate text-[13px] text-secondary">{busy === s.id ? "Guardando…" : "Tocá para sumarte"}</span>
                    </span>
                    <Plus size={20} className="shrink-0 text-secondary" aria-hidden />
                  </button>
                )}
              </m.li>
            );
          })}
        </ul>
      )}

      {mine.length > 0 && (
        <button type="button" onClick={() => router.replace("/cliente/reservar")} className="tap btn-primary mt-2">
          {firstTime ? "Continuar" : "Ir a reservar"} <ArrowRight size={17} />
        </button>
      )}

      <ConfirmDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        destructive={pendingThere === 0}
        title={pendingThere > 0 ? "Tenés turnos por delante" : `¿Dejar ${leaving?.name ?? "esta barbería"}?`}
        description={
          pendingThere > 0
            ? `Tenés ${pendingThere} ${pendingThere === 1 ? "turno" : "turnos"} en ${leaving?.name}. Cancelalos antes de dejarla.`
            : "Dejás de verla en la app. Tu ficha y tus turnos pasados quedan en el local, y podés volver a sumarte cuando quieras. Si tenés turnos por delante ahí, primero cancelalos."
        }
        confirmLabel={pendingThere > 0 ? "Ver mis turnos" : "Dejar barbería"}
        busyLabel="Saliendo…"
        onConfirm={leave}
      />
    </Page>
  );
}
