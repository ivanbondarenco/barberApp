"use client";

import { CalendarDays, Scissors, Store, Wallet } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppShell } from "@/components/layout/AppShell";
import type { NavItem } from "@/components/layout/BottomNav";
import { RoleGuard } from "@/components/layout/RoleGuard";

function routeMeta(pathname: string): { title: string; backHref?: string } {
  if (pathname.startsWith("/admin/turno/")) return { title: "Turno", backHref: "/admin/agenda" };
  if (pathname.startsWith("/admin/clientes/")) return { title: "Cliente", backHref: "/admin/clientes" };
  if (pathname === "/admin/finanzas/cierre") return { title: "Cierre de caja", backHref: "/admin/finanzas" };
  if (pathname === "/admin/clientes") return { title: "Clientes", backHref: "/admin/agenda" };
  if (pathname === "/admin/equipo") return { title: "Equipo", backHref: "/admin/agenda" };
  if (pathname === "/admin/configuracion") return { title: "Configuración", backHref: "/admin/agenda" };
  const titles: Record<string, string> = {
    "/admin/agenda": "Agenda",
    "/admin/finanzas": "Finanzas",
    "/admin/servicios": "Catálogo",
    "/admin/tienda": "Tienda",
  };
  return { title: titles[pathname] ?? "D.S Studio" };
}

const NAV: NavItem[] = [
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays, match: ["/admin/turno", "/admin/clientes", "/admin/equipo", "/admin/configuracion"] },
  { href: "/admin/finanzas", label: "Finanzas", icon: Wallet },
  { href: "/admin/servicios", label: "Catálogo", icon: Scissors },
  { href: "/admin/tienda", label: "Tienda", icon: Store },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const meta = routeMeta(pathname);
  return (
    <RoleGuard role="admin">
      <AppShell header={<AppHeader title={meta.title} backHref={meta.backHref} />} items={NAV}>
        {children}
      </AppShell>
    </RoleGuard>
  );
}
