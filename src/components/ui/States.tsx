"use client";

import type { LucideIcon } from "lucide-react";
import * as m from "motion/react-m";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { fadeUp } from "@/lib/motion";

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <m.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className={cn("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}
    >
      <span className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
        <Icon size={26} aria-hidden />
      </span>
      <p className="text-base font-semibold">{title}</p>
      {text && <p className="max-w-72 text-sm text-secondary">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </m.div>
  );
}

/** Placeholder de carga con brillo. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4" role="status" aria-label="Cargando">
      <div className="skeleton h-7 w-40" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-16 w-full" />
      ))}
    </div>
  );
}

/** Sección con título pequeño y tarjeta de filas. */
export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between px-1">
          {title && <h2 className="section-title">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
