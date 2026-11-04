"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { PublicShell } from "@/components/layout/PublicShell";
import { homeFor, ScreenLoader } from "@/components/layout/RoleGuard";
import { NAV } from "@/components/motion/Page";
import { useAppStore, useHydrated } from "@/store/useAppStore";

/**
 * Reserva sin cuenta: adonde lleva el link del local (/b/<slug>) a quien no tiene sesión.
 * Elige servicio, barbero y horario, y al final deja nombre y celular. Nada más.
 */
export default function ReservarSinCuentaPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const synced = useAppStore((s) => s.synced);
  const session = useAppStore((s) => s.session);
  const shop = useAppStore((s) => s.shop);

  // Confirma con el servidor la sesión y la barbería del link antes de decidir qué mostrar.
  useEffect(() => {
    void useAppStore.getState().refresh(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !synced) return;
    // Con sesión se reserva desde la app; sin barbería elegida no hay dónde reservar.
    if (session) router.replace(homeFor(session));
    else if (!shop) router.replace("/auth/login");
  }, [hydrated, synced, session, shop, router]);

  if (!hydrated || !synced || session || !shop) return <ScreenLoader />;

  return (
    <PublicShell title={shop.name} fallbackHref="/local">
      <Suspense>
        <BookingFlow guest />
      </Suspense>
      <p className="px-5 pb-6 text-center text-[13px] text-secondary">
        ¿Tenés cuenta?{" "}
        <Link href="/auth/login?tipo=cliente" transitionTypes={[...NAV.forward]} className="text-link">
          Ingresá
        </Link>
      </p>
    </PublicShell>
  );
}
