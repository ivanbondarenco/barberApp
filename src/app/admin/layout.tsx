"use client";

import { BellRing, CalendarDays, Scissors, Store, Users, Wallet } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { BillingBanner } from "@/components/billing/BillingBanner";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppShell } from "@/components/layout/AppShell";
import type { NavItem } from "@/components/layout/BottomNav";
import type { Role } from "@/lib/types";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { pendingReminders } from "@/lib/reminders";
import { useAppStore } from "@/store/useAppStore";

function routeMeta(pathname: string, role?: Role): { title: string; backHref?: string } {
  if (pathname.startsWith("/admin/turno/")) return { title: "Turno", backHref: "/admin/agenda" };
  if (pathname.startsWith("/admin/clientes/")) return { title: "Cliente", backHref: "/admin/clientes" };
  // Para el dueño, Clientes es una pestaña de la barra: no tiene "atrás".
  if (pathname === "/admin/clientes") return { title: "Clientes", backHref: role === "admin" ? undefined : "/admin/agenda" };
  if (pathname === "/admin/equipo") return { title: "Equipo", backHref: "/admin/agenda" };
  if (pathname === "/admin/configuracion") return { title: "Configuración", backHref: "/admin/agenda" };
  if (pathname === "/admin/recordatorios") return { title: "Recordatorios", backHref: "/admin/agenda" };
  if (pathname.startsWith("/admin/sueldos/recibo/")) return { title: "Recibo", backHref: "/admin/sueldos" };
  if (pathname === "/admin/sueldos") return { title: "Sueldos", backHref: "/admin/agenda" };
  if (pathname === "/admin/contenido") return { title: "Contenido", backHref: "/admin/agenda" };
  if (pathname === "/admin/suscripcion") return { title: "Suscripción", backHref: "/admin/agenda" };
  const titles: Record<string, string> = {
    "/admin/agenda": "Agenda",
    "/admin/finanzas": "Finanzas",
    "/admin/servicios": "Catálogo",
    "/admin/tienda": "Tienda",
  };
  return { title: titles[pathname] ?? "BarberApp" };
}

const AGENDA_CHILDREN = [
  "/admin/turno",
  "/admin/clientes",
  "/admin/equipo",
  "/admin/configuracion",
  "/admin/recordatorios",
  "/admin/sueldos",
  "/admin/contenido",
  "/admin/suscripcion",
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const role = useAppStore((s) => s.session?.role);
  const meta = routeMeta(pathname, role);
  const appointments = useAppStore((s) => s.appointments);
  const clients = useAppStore((s) => s.clients);

  const reminders = useMemo(() => pendingReminders(appointments, clients).length, [appointments, clients]);

  // El barbero solo opera su agenda: finanzas, catálogo y tienda son del dueño.
  const items: NavItem[] =
    role === "barbero"
      ? [
          { href: "/admin/agenda", label: "Agenda", icon: CalendarDays, match: AGENDA_CHILDREN },
          // Mismo nombre que el título de la pantalla a la que lleva.
          { href: "/admin/recordatorios", label: "Recordatorios", icon: BellRing, badge: reminders },
        ]
      : [
          { href: "/admin/agenda", label: "Agenda", icon: CalendarDays, match: AGENDA_CHILDREN.filter((p) => p !== "/admin/clientes") },
          { href: "/admin/clientes", label: "Clientes", icon: Users },
          { href: "/admin/finanzas", label: "Finanzas", icon: Wallet },
          { href: "/admin/servicios", label: "Catálogo", icon: Scissors },
          { href: "/admin/tienda", label: "Tienda", icon: Store },
        ];

  return (
    <RoleGuard role={STAFF_ROLES}>
      <AppShell header={<AppHeader title={meta.title} backHref={meta.backHref} />} items={items}>
        <BillingBanner role={role} />
        {children}
      </AppShell>
    </RoleGuard>
  );
}

const STAFF_ROLES: Role[] = ["admin", "barbero"];
