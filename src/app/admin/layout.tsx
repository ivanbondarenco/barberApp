"use client";

import { BellRing, CalendarDays, Scissors, Store, Wallet } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppShell } from "@/components/layout/AppShell";
import type { NavItem } from "@/components/layout/BottomNav";
import type { Role } from "@/lib/types";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { pendingReminders } from "@/lib/reminders";
import { useAppStore } from "@/store/useAppStore";

function routeMeta(pathname: string): { title: string; backHref?: string } {
  if (pathname.startsWith("/admin/turno/")) return { title: "Turno", backHref: "/admin/agenda" };
  if (pathname.startsWith("/admin/clientes/")) return { title: "Cliente", backHref: "/admin/clientes" };
  if (pathname === "/admin/finanzas/cierre") return { title: "Cierre de caja", backHref: "/admin/finanzas" };
  if (pathname === "/admin/clientes") return { title: "Clientes", backHref: "/admin/agenda" };
  if (pathname === "/admin/equipo") return { title: "Equipo", backHref: "/admin/agenda" };
  if (pathname === "/admin/configuracion") return { title: "Configuración", backHref: "/admin/agenda" };
  if (pathname === "/admin/recordatorios") return { title: "Recordatorios", backHref: "/admin/agenda" };
  const titles: Record<string, string> = {
    "/admin/agenda": "Agenda",
    "/admin/finanzas": "Finanzas",
    "/admin/servicios": "Catálogo",
    "/admin/tienda": "Tienda",
  };
  return { title: titles[pathname] ?? "D.S Studio" };
}

const AGENDA_CHILDREN = ["/admin/turno", "/admin/clientes", "/admin/equipo", "/admin/configuracion", "/admin/recordatorios"];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const meta = routeMeta(pathname);
  const role = useAppStore((s) => s.session?.role);
  const appointments = useAppStore((s) => s.appointments);
  const clients = useAppStore((s) => s.clients);

  const reminders = useMemo(() => pendingReminders(appointments, clients).length, [appointments, clients]);

  // El barbero solo opera su agenda: finanzas, catálogo y tienda son del dueño.
  const items: NavItem[] =
    role === "barbero"
      ? [
          { href: "/admin/agenda", label: "Agenda", icon: CalendarDays, match: AGENDA_CHILDREN },
          { href: "/admin/recordatorios", label: "Avisos", icon: BellRing, badge: reminders },
        ]
      : [
          { href: "/admin/agenda", label: "Agenda", icon: CalendarDays, match: AGENDA_CHILDREN },
          { href: "/admin/finanzas", label: "Finanzas", icon: Wallet },
          { href: "/admin/servicios", label: "Catálogo", icon: Scissors },
          { href: "/admin/tienda", label: "Tienda", icon: Store },
        ];

  return (
    <RoleGuard role={STAFF_ROLES}>
      <AppShell header={<AppHeader title={meta.title} backHref={meta.backHref} />} items={items}>
        {children}
      </AppShell>
    </RoleGuard>
  );
}

const STAFF_ROLES: Role[] = ["admin", "barbero"];
