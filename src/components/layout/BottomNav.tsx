"use client";

import type { LucideIcon } from "lucide-react";
import * as m from "motion/react-m";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/components/motion/Page";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  /** Prefijos de rutas hijas que también marcan la pestaña como activa. */
  match?: string[];
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      style={{ viewTransitionName: "app-nav" }}
      className="pb-safe z-40 shrink-0 border-t border-surface-high bg-surface-lowest/95 backdrop-blur-xl"
    >
      <ul className="flex h-16 items-stretch justify-around px-2">
        {items.map(({ href, label, icon: Icon, badge, match = [] }) => {
          const active = [href, ...match].some((p) => pathname === p || pathname.startsWith(`${p}/`));
          return (
            <li key={href} className="flex flex-1">
              <Link
                href={href}
                transitionTypes={active ? undefined : [...NAV.tab]}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-secondary",
                )}
              >
                <span className="relative flex h-8 w-14 items-center justify-center">
                  {active && (
                    <m.span
                      layoutId="nav-indicator"
                      transition={spring.layout}
                      className="absolute inset-0 rounded-full bg-primary-fixed"
                      aria-hidden
                    />
                  )}
                  <Icon size={21} strokeWidth={active ? 2.3 : 1.8} className="relative" aria-hidden />
                  {!!badge && (
                    <m.span
                      key={badge}
                      initial={{ scale: 0.4 }}
                      animate={{ scale: 1 }}
                      transition={spring.pop}
                      className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-on-primary ring-2 ring-surface-lowest"
                    >
                      {badge}
                    </m.span>
                  )}
                </span>
                <span className={cn(active && "font-semibold")}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
