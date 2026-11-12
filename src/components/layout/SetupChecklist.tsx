"use client";

import { ChevronDown, ChevronRight, CreditCard, MessageCircle, Scissors, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { NAV } from "@/components/motion/Page";
import { cn } from "@/lib/cn";
import { whatsappLink } from "@/lib/format";
import type { SetupTask } from "@/lib/notifications";
import { SUPPORT_WHATSAPP } from "@/lib/plan";

const ICONS = { mercadopago: CreditCard, whatsapp: MessageCircle, servicios: Scissors } as const;

/**
 * WhatsApp Cloud API es configuración de desarrollador (tokens de Meta, plantillas aprobadas):
 * la barbería funciona sin eso. Se ofrece como opcional, nunca como advertencia.
 */
const OPTIONAL: SetupTask["id"][] = ["whatsapp"];
const isOptional = (t: SetupTask) => OPTIONAL.includes(t.id);

/** Pasos pendientes que sí hacen falta para trabajar (lo opcional no cuenta). */
export function requiredSetupTasks(tasks: SetupTask[]): SetupTask[] {
  return tasks.filter((t) => !isOptional(t));
}

const DISMISS_KEY = "barberapp:setup-banner";

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

function writeDismissed(signature: string) {
  try {
    localStorage.setItem(DISMISS_KEY, signature);
  } catch {
    // Sin almacenamiento el aviso vuelve a aparecer en la próxima visita: no es grave.
  }
}

/**
 * Configuración que le falta al dueño, con el link a donde se resuelve y el WhatsApp de
 * soporte para las dudas.
 *
 * - `full` (por defecto): la lista completa. La usa la campana de notificaciones.
 * - `banner`: una línea ("2 pasos pendientes · Ver") que se despliega. En la agenda se puede
 *   descartar (se recuerda hasta que cambien los pasos pendientes); en Configuración queda fija
 *   para que siempre haya dónde retomarlo.
 */
export function SetupChecklist({
  tasks,
  shopName,
  onNavigate,
  variant = "full",
  dismissible = false,
  className,
}: {
  tasks: SetupTask[];
  shopName?: string;
  onNavigate?: () => void;
  variant?: "full" | "banner";
  dismissible?: boolean;
  className?: string;
}) {
  const required = requiredSetupTasks(tasks);
  const optional = tasks.filter(isOptional);
  const signature = required.map((t) => t.id).join(",");
  const [expanded, setExpanded] = useState(false);
  // Arranca descartado hasta leer el almacenamiento: así no parpadea un aviso que el dueño ya cerró.
  const [dismissed, setDismissed] = useState(dismissible);

  useEffect(() => {
    if (dismissible) setDismissed(readDismissed() === signature);
  }, [dismissible, signature]);

  if (variant === "banner") {
    if (!required.length || (dismissible && dismissed)) return null;
    const count = required.length;
    return (
      <section aria-label="Configuración pendiente" className={cn("overflow-hidden rounded-2xl bg-amber-container text-amber-ink", className)}>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-2 pl-4 pr-2 text-left text-[13px] font-semibold"
          >
            <TriangleAlert size={16} className="shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              {count === 1 ? "1 paso pendiente" : `${count} pasos pendientes`} · <span className="underline underline-offset-2">{expanded ? "Ocultar" : "Ver"}</span>
            </span>
            <ChevronDown size={16} className={cn("shrink-0 transition-transform", expanded && "rotate-180")} aria-hidden />
          </button>
          {dismissible && (
            <button
              type="button"
              onClick={() => {
                writeDismissed(signature);
                setDismissed(true);
              }}
              aria-label="Ocultar aviso. Lo encontrás en Configuración"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-amber-ink/10"
            >
              <X size={16} aria-hidden />
            </button>
          )}
        </div>
        {expanded && (
          <div className="px-3 pb-3">
            <TaskList tasks={required} onNavigate={onNavigate} />
            <SupportLine shopName={shopName} className="mt-2 px-1" />
          </div>
        )}
      </section>
    );
  }

  if (!tasks.length) return null;
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {required.length > 0 && (
        <section aria-label="Configuración pendiente" className="flex flex-col gap-3 rounded-2xl bg-amber-container p-4 text-amber-ink">
          <p className="flex items-start gap-2 text-sm font-semibold">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
            {summaryOf(required)}
          </p>
          <TaskList tasks={required} onNavigate={onNavigate} />
          <SupportLine shopName={shopName} />
        </section>
      )}
      {optional.length > 0 && (
        <section aria-label="Opcional" className="flex flex-col gap-2">
          <p className="px-1 text-xs font-semibold text-secondary">Opcional · avanzado</p>
          <TaskList tasks={optional} onNavigate={onNavigate} muted />
        </section>
      )}
    </div>
  );
}

function summaryOf(required: SetupTask[]): string {
  if (required.some((t) => t.id === "servicios")) return "Te falta terminar de configurar tu barbería.";
  return "Tenés pendiente conectar Mercado Pago.";
}

function TaskList({ tasks, onNavigate, muted }: { tasks: SetupTask[]; onNavigate?: () => void; muted?: boolean }) {
  return (
    <ul className={cn("overflow-hidden rounded-xl text-ink", muted ? "bg-surface-low" : "bg-surface-lowest")}>
      {tasks.map((task) => {
        const Icon = ICONS[task.id];
        return (
          <li key={task.id} className="border-b border-surface-high last:border-0">
            <Link href={task.href} transitionTypes={[...NAV.forward]} onClick={onNavigate} className="row hover:bg-surface-low">
              <Icon size={18} className={cn("shrink-0", muted ? "text-secondary" : "text-primary")} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{task.title}</span>
                <span className="block text-xs text-secondary">
                  {isOptional(task) ? "Requiere una cuenta de desarrollador de Meta. La app funciona sin esto." : task.body}
                </span>
              </span>
              <ChevronRight size={17} className="text-secondary" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SupportLine({ shopName, className }: { shopName?: string; className?: string }) {
  return (
    <p className={cn("text-xs", className)}>
      Si tenés alguna duda, escribinos por WhatsApp al{" "}
      <a
        href={whatsappLink(SUPPORT_WHATSAPP, `Hola${shopName ? `, soy de ${shopName}` : ""}. Necesito ayuda para configurar BarberApp.`)}
        target="_blank"
        rel="noreferrer"
        className="font-semibold underline"
      >
        {SUPPORT_WHATSAPP}
      </a>
      .
    </p>
  );
}
