"use client";

import { ChevronRight, CreditCard, MessageCircle, Scissors, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { NAV } from "@/components/motion/Page";
import { whatsappLink } from "@/lib/format";
import type { SetupTask } from "@/lib/notifications";
import { SUPPORT_WHATSAPP } from "@/lib/plan";

const ICONS = { mercadopago: CreditCard, whatsapp: MessageCircle, servicios: Scissors } as const;

/**
 * Configuración que le falta al dueño, con el link a donde se resuelve y el WhatsApp de
 * soporte para las dudas. Aparece en la agenda y en la campana de notificaciones.
 */
export function SetupChecklist({ tasks, shopName, onNavigate }: { tasks: SetupTask[]; shopName?: string; onNavigate?: () => void }) {
  if (!tasks.length) return null;

  const names = tasks
    .filter((t) => t.id !== "servicios")
    .map((t) => (t.id === "mercadopago" ? "Mercado Pago" : "WhatsApp"));
  const summary = names.length ? `Tenés pendiente conectar ${names.join(" y ")}.` : "Te falta terminar de configurar tu barbería.";

  return (
    <section aria-label="Configuración pendiente" className="flex flex-col gap-3 rounded-2xl bg-amber-container p-4 text-amber-ink">
      <p className="flex items-start gap-2 text-sm font-semibold">
        <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
        {summary}
      </p>
      <ul className="overflow-hidden rounded-xl bg-surface-lowest text-ink">
        {tasks.map((task) => {
          const Icon = ICONS[task.id];
          return (
            <li key={task.id} className="border-b border-surface-high last:border-0">
              <Link href={task.href} transitionTypes={[...NAV.forward]} onClick={onNavigate} className="row hover:bg-surface-low">
                <Icon size={18} className="shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{task.title}</span>
                  <span className="block text-xs text-secondary">{task.body}</span>
                </span>
                <ChevronRight size={17} className="text-secondary" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-xs">
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
    </section>
  );
}
