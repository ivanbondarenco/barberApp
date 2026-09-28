"use client";

import { CalendarCheck, CalendarPlus, Store, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useClientAppointments } from "@/components/appointments/useClientAppointments";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppShell } from "@/components/layout/AppShell";
import type { NavItem } from "@/components/layout/BottomNav";
import { CLIENT_SHOPS_PATH, RoleGuard } from "@/components/layout/RoleGuard";
import { useAppStore } from "@/store/useAppStore";

function routeMeta(pathname: string, hasShop: boolean): { title: string; backHref?: string } {
  if (pathname.startsWith("/cliente/turno/")) return { title: "Tu turno", backHref: "/cliente/mis-turnos" };
  if (pathname.startsWith("/cliente/pago/")) return { title: "Reserva", backHref: "/cliente/mis-turnos" };
  if (pathname === "/cliente/historial") return { title: "Historial", backHref: "/cliente/perfil" };
  if (pathname === CLIENT_SHOPS_PATH) return { title: "Mis barberías", backHref: hasShop ? "/cliente/perfil" : undefined };
  const titles: Record<string, string> = {
    "/cliente/reservar": "Reservar",
    "/cliente/mis-turnos": "Mis turnos",
    "/cliente/tienda": "Tienda",
    "/cliente/perfil": "Perfil",
  };
  return { title: titles[pathname] ?? "BarberApp" };
}

function ClientFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hasShop = useAppStore((s) => !!s.session?.shop);
  const { upcoming } = useClientAppointments();
  const meta = routeMeta(pathname, hasShop);

  // Sin barbería no hay nada que reservar ni comprar: solo la pantalla para elegir.
  const items: NavItem[] | undefined = hasShop
    ? [
        { href: "/cliente/reservar", label: "Reservar", icon: CalendarPlus, match: ["/cliente/pago"] },
        { href: "/cliente/mis-turnos", label: "Turnos", icon: CalendarCheck, badge: upcoming.length, match: ["/cliente/turno"] },
        { href: "/cliente/tienda", label: "Tienda", icon: Store },
        { href: "/cliente/perfil", label: "Perfil", icon: UserRound, match: ["/cliente/historial", CLIENT_SHOPS_PATH] },
      ]
    : undefined;

  return (
    <AppShell header={<AppHeader title={meta.title} backHref={meta.backHref} />} items={items}>
      {children}
    </AppShell>
  );
}

export default function ClienteLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <RoleGuard role="cliente" needsShop={pathname !== CLIENT_SHOPS_PATH}>
      <ClientFrame>{children}</ClientFrame>
    </RoleGuard>
  );
}
