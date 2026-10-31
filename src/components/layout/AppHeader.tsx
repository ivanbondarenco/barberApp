"use client";

import {
  ArrowLeft,
  BellRing,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CloudOff,
  Contact,
  ExternalLink,
  FileText,
  MessageCircle,
  ReceiptText,
  History,
  LogOut,
  type LucideIcon,
  Settings,
  Store,
  UserRound,
  Users,
  Check,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { NAV } from "@/components/motion/Page";
import { CLIENT_SHOPS_PATH } from "@/components/layout/RoleGuard";
import { Sheet } from "@/components/ui/Sheet";
import { initials, whatsappLink } from "@/lib/format";
import { SUPPORT_WHATSAPP } from "@/lib/plan";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";
import { BrandMark } from "./Logo";
import { NotificationBell } from "./NotificationBell";

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
  { href: CLIENT_SHOPS_PATH, label: "Mis barberías", icon: Store },
  { href: "/politicas", label: "Políticas de seña", icon: FileText },
  { href: "/ayuda", label: "Ayuda", icon: CircleHelp },
];

const OWNER_LINKS: MenuLink[] = [
  { href: "/admin/clientes", label: "Clientes", icon: Contact },
  { href: "/admin/recordatorios", label: "Recordatorios", icon: BellRing },
  { href: "/admin/equipo", label: "Equipo", icon: Users },
  { href: "/admin/sueldos", label: "Sueldos y adelantos", icon: ReceiptText },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

/** El barbero no maneja el equipo ni la configuración del local. */
const BARBER_LINKS: MenuLink[] = [
  { href: "/admin/clientes", label: "Clientes", icon: Contact },
  { href: "/admin/recordatorios", label: "Recordatorios", icon: BellRing },
  { href: "/admin/sueldos", label: "Mis ganancias", icon: ReceiptText },
  { href: "/ayuda", label: "Ayuda", icon: CircleHelp },
];

export function AppHeader({ title, backHref, right }: AppHeaderProps) {
  const router = useRouter();
  const session = useAppStore((s) => s.session);
  const offline = useAppStore((s) => s.offline);
  const logout = useAppStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);

  const links = session?.role === "admin" ? OWNER_LINKS : session?.role === "barbero" ? BARBER_LINKS : CLIENT_LINKS;
  const isStaffSession = session?.role === "admin" || session?.role === "barbero";
  const roleLabel = session?.role === "admin" ? "Dueño del local" : session?.role === "barbero" ? "Barbero" : "Cliente";

  return (
    <header
      style={{ viewTransitionName: "app-header" }}
      className="pt-safe z-40 shrink-0 bg-surface/90 backdrop-blur-xl lg:border-b lg:border-surface-high"
    >
      <div className="mx-auto flex h-14 w-full items-center gap-2 px-2 lg:h-16 lg:max-w-[900px] lg:px-4">
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
          <BrandMark className="ml-2 h-8 w-8 rounded-lg lg:hidden" />
        )}
        <h1 className="min-w-0 flex-1 truncate px-1 text-[17px] font-semibold tracking-tight lg:text-xl">{title}</h1>
        {offline && (
          <span className="chip bg-error-container text-error" title="Sin conexión">
            <CloudOff size={12} /> Offline
          </span>
        )}
        {right}
        {session?.role === "cliente" && session.shop && <ShopSwitcher />}
        {isStaffSession && <NotificationBell />}
        {/* Se ve como botón: avatar, nombre y flecha. En el celular, avatar y flecha. */}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú de cuenta"
          aria-haspopup="dialog"
          className="tap mr-1 flex min-h-11 items-center gap-2 rounded-full border border-surface-high bg-surface-lowest py-1 pl-1 pr-2.5 shadow-xs transition-colors hover:border-primary-fixed hover:bg-surface-low"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">
            {initials(session?.name ?? "DS")}
          </span>
          <span className="hidden min-w-0 max-w-40 text-left leading-tight lg:block">
            <span className="block truncate text-sm font-semibold">{session?.name ?? "Mi cuenta"}</span>
            <span className="block text-[11px] text-secondary">{roleLabel}</span>
          </span>
          <ChevronDown size={16} className="shrink-0 text-secondary" aria-hidden />
        </button>
      </div>

      <Sheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={session?.name ?? "Mi cuenta"}
        subtitle={session?.role === "admin" ? "Dueño del local" : session?.role === "barbero" ? "Barbero" : session?.identifier}
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
          {(session?.role === "admin" || session?.role === "barbero") && (
            <a
              href={whatsappLink(
                SUPPORT_WHATSAPP,
                `Hola, soy ${session.name}${session.shop ? ` de ${session.shop.name}` : ""}. Necesito ayuda con BarberApp.`,
              )}
              target="_blank"
              rel="noreferrer"
              onClick={() => setMenuOpen(false)}
              className="row rounded-2xl bg-mint font-semibold text-mint-ink"
            >
              <MessageCircle size={19} aria-hidden />
              <span className="flex-1">
                Soporte por WhatsApp
                <span className="block text-xs font-medium">Escribinos ante cualquier duda</span>
              </span>
              <ExternalLink size={16} aria-hidden />
            </a>
          )}
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

/**
 * Barbería activa del cliente. Si se atiende en varias, desde acá pasa de una a otra:
 * cada una tiene sus turnos, su tienda y su seña.
 */
function ShopSwitcher() {
  const router = useRouter();
  const shop = useAppStore((s) => s.session?.shop);
  const shops = useAppStore((s) => s.session?.shops ?? []);
  const membership = useAppStore((s) => s.membership);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (!shop) return null;

  const select = async (id: string) => {
    if (id === shop.id) return setOpen(false);
    setBusy(id);
    const result = await membership(id, "select");
    setBusy(null);
    if (!result.ok) return toast(result.error, "error");
    setOpen(false);
    router.replace("/cliente/reservar");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Barbería activa: ${shop.name}`}
        className="tap chip min-h-10 max-w-[40%] bg-surface-lowest text-primary shadow-xs"
      >
        <Store size={13} aria-hidden /> <span className="truncate">{shop.name}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Tus barberías" subtitle="Elegí en cuál querés reservar">
        <div className="flex flex-col gap-3 pb-2">
          <ul className="overflow-hidden rounded-2xl bg-surface-low">
            {shops.map((s) => (
              <li key={s.id} className="border-b border-surface-high last:border-0">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void select(s.id)}
                  aria-current={s.id === shop.id ? "true" : undefined}
                  className="row w-full text-left font-medium hover:bg-surface-container"
                >
                  <Store size={19} className="text-primary" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  {s.id === shop.id ? (
                    <Check size={18} className="text-primary" aria-label="Activa" />
                  ) : busy === s.id ? (
                    <span className="text-[13px] text-secondary">…</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <Link
            href={CLIENT_SHOPS_PATH}
            transitionTypes={[...NAV.forward]}
            onClick={() => setOpen(false)}
            className="tap btn-secondary"
          >
            <Plus size={17} /> Sumar otra barbería
          </Link>
        </div>
      </Sheet>
    </>
  );
}
