"use client";

import * as m from "motion/react-m";
import { ArrowRight, Check, Plus, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Page } from "@/components/motion/Page";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/cn";
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
  const membership = useAppStore((s) => s.membership);
  const [busy, setBusy] = useState<string | null>(null);

  const joined = new Set(mine.map((s) => s.id));
  // Se fija al entrar: si llegó sin barberías es la bienvenida, aunque ya se haya sumado a una.
  const [firstTime] = useState(() => mine.length === 0);

  const toggle = async (shopId: string, name: string) => {
    const leaving = joined.has(shopId);
    setBusy(shopId);
    const result = await membership(shopId, leaving ? "leave" : "join");
    setBusy(null);
    if (!result.ok) return toast(result.error, "error");
    toast(leaving ? `Dejaste ${name}` : `Te sumaste a ${name}`, "success");
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
                <button
                  type="button"
                  disabled={!!busy}
                  aria-pressed={isMine}
                  onClick={() => void toggle(s.id, s.name)}
                  className={cn(
                    "tap flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left shadow-xs",
                    isMine ? "bg-primary-fixed" : "bg-surface-lowest",
                  )}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-lowest text-primary">
                    <Store size={20} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{s.name}</span>
                    <span className="block truncate text-[13px] text-secondary">
                      {busy === s.id ? "Guardando…" : isMine ? "Te atendés acá · tocá para dejarla" : "Tocá para sumarte"}
                    </span>
                  </span>
                  {isMine ? (
                    <Check size={20} className="shrink-0 text-primary" aria-hidden />
                  ) : (
                    <Plus size={20} className="shrink-0 text-secondary" aria-hidden />
                  )}
                </button>
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
    </Page>
  );
}
