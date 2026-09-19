"use client";

import {
  ArrowLeft,
  ChevronRight,
  CircleHelp,
  CloudOff,
  Contact,
  FileText,
  History,
  LogOut,
  type LucideIcon,
  Receipt,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { NAV } from "@/components/motion/Page";
import { Sheet } from "@/components/ui/Sheet";
import { initials } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";
import { BrandMark } from "./Logo";

interface AppHeaderProps {
  title: string;
  /** Muestra flecha atrás en lugar de la marca. */
  backHref?: string;
  right?: ReactNode;
}

interface MenuLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const CLIENT_LINKS: MenuLink[] = [
  { href: "/cliente/perfil", label: "Mi perfil", icon: UserRound },
  { href: "/cliente/historial", label: "Historial de turnos", icon: History },
  { href: "/politicas", label: "Políticas de seña", icon: FileText },
  { href: "/ayuda", label: "Ayuda", icon: CircleHelp },
];

const ADMIN_LINKS: MenuLink[] = [
  { href: "/admin/clientes", label: "Clientes", icon: Contact },
  { href: "/admin/equipo", label: "Equipo", icon: Users },
  { href: "/admin/finanzas/cierre", label: "Cierre de caja", icon: Receipt },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

export function AppHeader({ title, backHref, right }: AppHeaderProps) {
  const router = useRouter();
  const session = useAppStore((s) => s.session);
  const offline = useAppStore((s) => s.offline);
  const logout = useAppStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);

  const links = session?.role === "admin" ? ADMIN_LINKS : CLIENT_LINKS;

  return (
    <header
      style={{ viewTransitionName: "app-header" }}
      className="pt-safe z-40 shrink-0 bg-surface/90 backdrop-blur-xl"
    >
      <div className="flex h-14 items-center gap-2 px-2">
        {backHref ? (
          <button
            type="button"
            onClick={() => router.push(backHref, { transitionTypes: [...NAV.back] })}
            aria-label="Volver"
            className="icon-btn"
          >
            <ArrowLeft size={22} />
          </button>
        ) : (
          <BrandMark className="ml-2 h-8 w-8 rounded-lg" />
        )}
        <h1 className="min-w-0 flex-1 truncate px-1 text-[17px] font-semibold tracking-tight">{title}</h1>
        {offline && (
          <span className="chip bg-error-container text-error" title="Sin conexión">
            <CloudOff size={12} /> Offline
          </span>
        )}
        {right}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú de cuenta"
          className="tap mr-1 flex h-11 w-11 items-center justify-center rounded-full"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-fixed text-xs font-bold text-primary">
            {initials(session?.name ?? "DS")}
          </span>
        </button>
      </div>

      <Sheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={session?.name ?? "Mi cuenta"}
        subtitle={session?.role === "admin" ? "Barbero / Admin" : session?.identifier}
      >
        <nav className="flex flex-col gap-3 pb-2" aria-label="Menú de cuenta">
          <ul className="overflow-hidden rounded-2xl bg-surface-low">
            {links.map(({ href, label, icon: Icon }) => (
              <li key={href} className="border-b border-surface-high last:border-0">
                <Link
                  href={href}
                  transitionTypes={[...NAV.forward]}
                  onClick={() => setMenuOpen(false)}
                  className="row font-medium hover:bg-surface-container"
                >
                  <Icon size={19} className="text-primary" aria-hidden />
                  <span className="flex-1">{label}</span>
                  <ChevronRight size={17} className="text-secondary" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="tap btn-destructive"
            onClick={async () => {
              setMenuOpen(false);
              await logout();
              router.replace("/auth/login");
            }}
          >
            <LogOut size={17} /> Cerrar sesión
          </button>
        </nav>
      </Sheet>
    </header>
  );
}
