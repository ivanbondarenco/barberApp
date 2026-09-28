"use client";

import * as m from "motion/react-m";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { NAV } from "@/components/motion/Page";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import type { NavItem } from "./BottomNav";
import { BrandMark } from "./Logo";

/** Navegación lateral de escritorio: reemplaza a la barra inferior desde 1024px. */
export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // El panel es de un local: se muestra su nombre, no el de la app.
  const shopName = useAppStore((s) => s.session?.shop?.name ?? "BarberApp");

  return (
    <aside
      aria-label="Navegación principal"
      className="hidden w-60 shrink-0 flex-col border-r border-surface-high bg-surface-lowest lg:flex"
    >
      <div className="flex h-16 items-center gap-2.5 px-5">
        <BrandMark className="h-9 w-9 rounded-lg" />
        <span className="truncate text-[15px] font-bold tracking-tight">{shopName}</span>
      </div>
      <nav className="flex-1 px-3 py-2">
        <ul className="flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon, badge, match = [] }) => {
            const active = [href, ...match].some((p) => pathname === p || pathname.startsWith(`${p}/`));
            return (
              <li key={href}>
                <Link
                  href={href}
                  transitionTypes={active ? undefined : [...NAV.tab]}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm transition-colors",
                    active ? "text-primary" : "text-secondary hover:bg-surface-low hover:text-ink",
                  )}
                >
                  {active && (
                    <m.span
                      layoutId="side-nav-indicator"
                      transition={spring.layout}
                      className="absolute inset-0 rounded-2xl bg-primary-fixed"
                      aria-hidden
                    />
                  )}
                  <Icon size={19} strokeWidth={active ? 2.3 : 1.8} className="relative shrink-0" aria-hidden />
                  <span className={cn("relative flex-1 truncate", active ? "font-semibold" : "font-medium")}>{label}</span>
                  {!!badge && (
                    <m.span
                      key={badge}
                      initial={{ scale: 0.4 }}
                      animate={{ scale: 1 }}
                      transition={spring.pop}
                      className="relative flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary"
                    >
                      {badge}
                    </m.span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
