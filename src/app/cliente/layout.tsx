"use client";

import { CalendarCheck, CalendarPlus, Store, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useClientAppointments } from "@/components/appointments/useClientAppointments";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppShell } from "@/components/layout/AppShell";
import type { NavItem } from "@/components/layout/BottomNav";
import { RoleGuard } from "@/components/layout/RoleGuard";

function routeMeta(pathname: string): { title: string; backHref?: string } {
  if (pathname.startsWith("/cliente/turno/")) return { title: "Tu turno", backHref: "/cliente/mis-turnos" };
  if (pathname.startsWith("/cliente/pago/")) return { title: "Reserva", backHref: "/cliente/mis-turnos" };
  if (pathname === "/cliente/historial") return { title: "Historial", backHref: "/cliente/perfil" };
  const titles: Record<string, string> = {
    "/cliente/reservar": "Reservar",
    "/cliente/mis-turnos": "Mis turnos",
    "/cliente/tienda": "Tienda",
    "/cliente/perfil": "Perfil",
  };
  return { title: titles[pathname] ?? "D.S Studio" };
}

function ClientFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { upcoming } = useClientAppointments();
  const meta = routeMeta(pathname);

  const items: NavItem[] = [
    { href: "/cliente/reservar", label: "Reservar", icon: CalendarPlus, match: ["/cliente/pago"] },
    { href: "/cliente/mis-turnos", label: "Turnos", icon: CalendarCheck, badge: upcoming.length, match: ["/cliente/turno"] },
    { href: "/cliente/tienda", label: "Tienda", icon: Store },
    { href: "/cliente/perfil", label: "Perfil", icon: UserRound, match: ["/cliente/historial"] },
  ];

  return (
    <AppShell header={<AppHeader title={meta.title} backHref={meta.backHref} />} items={items}>
      {children}
    </AppShell>
  );
}

export default function ClienteLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard role="cliente">
      <ClientFrame>{children}</ClientFrame>
    </RoleGuard>
  );
}
