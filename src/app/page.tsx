"use client";

import * as m from "motion/react-m";
import { ChevronRight, Plus, Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogoSeal } from "@/components/layout/Logo";
import { homeFor, ScreenLoader } from "@/components/layout/RoleGuard";
import { NAV } from "@/components/motion/Page";
import { fadeUp, listItem } from "@/lib/motion";
import { useAppStore, useHydrated } from "@/store/useAppStore";

/**
 * Punto de entrada. Manda a donde corresponda según quién sea y en qué barbería esté.
 *
 * Cuando la instalación tiene varias barberías y el visitante no eligió ninguna (no entró por
 * el link /b/<slug>), se le muestra la lista para que elija.
 */
export default function Home() {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useAppStore((s) => s.session);
  const shop = useAppStore((s) => s.shop);
  const shops = useAppStore((s) => s.shops);
  const synced = useAppStore((s) => s.synced);

  useEffect(() => {
    void useAppStore.getState().refresh(true);
  }, []);

  const ready = hydrated && synced;
  const needsPick = ready && !session && !shop;

  useEffect(() => {
    if (!ready || needsPick) return;
    router.replace(session ? homeFor(session.role) : "/local");
  }, [ready, needsPick, session, router]);

  if (!needsPick) return <ScreenLoader />;

  return (
    <div className="flex min-h-dvh w-full justify-center lg:items-center lg:p-8">
      <div className="flex h-dvh w-full max-w-[480px] flex-col bg-surface px-6 pb-[max(env(safe-area-inset-bottom),16px)] pt-[max(env(safe-area-inset-top),16px)] shadow-md lg:h-auto lg:max-w-[520px] lg:rounded-3xl lg:px-10 lg:py-10">
        <main className="no-scrollbar flex flex-1 flex-col justify-center overflow-y-auto py-4">
          <m.div variants={fadeUp} initial="hidden" animate="show" className="mb-8 flex flex-col items-center text-center">
            <LogoSeal className="h-20 w-20 drop-shadow-md" />
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Elegí tu barbería</h1>
            <p className="text-[15px] text-secondary">
              {shops.length ? "Tocá la tuya para reservar o entrar a tu cuenta." : "Todavía no hay barberías publicadas."}
            </p>
          </m.div>

          {shops.length > 0 && (
            <ul className="flex flex-col gap-2">
              {shops.map((s, i) => (
                <m.li key={s.id} custom={i} variants={listItem} initial="hidden" animate="show">
                  {/* Navegación completa a propósito: /b/<slug> es un Route Handler que fija
                      la cookie de la barbería, no una pantalla de la app. */}
                  <a
                    href={`/b/${s.slug}`}
                    className="tap flex w-full items-center gap-3 rounded-2xl bg-surface-lowest px-4 py-3.5 text-left shadow-xs"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
                      <Store size={20} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{s.name}</span>
                      <span className="block truncate text-[13px] text-secondary">/{s.slug}</span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-secondary" aria-hidden />
                  </a>
                </m.li>
              ))}
            </ul>
          )}
        </main>

        <footer className="shrink-0 pt-4">
          <Link href="/auth/nueva-barberia" transitionTypes={[...NAV.forward]} className="tap btn-secondary">
            <Plus size={17} /> Registrar mi barbería
          </Link>
        </footer>
      </div>
    </div>
  );
}
