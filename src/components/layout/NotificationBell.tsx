"use client";

import {
  Bell,
  BellRing,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  ChevronRight,
  Clock,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { NAV } from "@/components/motion/Page";
import { Sheet } from "@/components/ui/Sheet";
import { staffActivity, setupTasks, unreadCount, type NotificationKind } from "@/lib/notifications";
import { useAppStore } from "@/store/useAppStore";
import { PushToggle } from "./PushToggle";
import { SetupChecklist } from "./SetupChecklist";

const ICONS: Record<NotificationKind, LucideIcon> = {
  reserva: CalendarPlus,
  cancelacion: CalendarX,
  vencida: Clock,
  reprogramacion: CalendarClock,
  transferencia: Landmark,
  recordatorios: BellRing,
};

/** Hace cuánto pasó, corto: "hace 5 min", "hace 3 h", "hace 2 días". */
function ago(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ayer" : `hace ${days} días`;
}

const seenKey = (identifier: string) => `ds-notif-seen:${identifier}`;

function readSeen(identifier: string): string | null {
  try {
    return localStorage.getItem(seenKey(identifier));
  } catch {
    return null;
  }
}

/**
 * Campana del staff: actividad de los turnos y configuración pendiente. El número cuenta lo
 * nuevo desde la última vez que se abrió en este dispositivo, más lo que espera una acción.
 */
export function NotificationBell() {
  const session = useAppStore((s) => s.session);
  const appointments = useAppStore((s) => s.appointments);
  const clients = useAppStore((s) => s.clients);
  const integrations = useAppStore((s) => s.integrations);
  const services = useAppStore((s) => s.services);
  const synced = useAppStore((s) => s.synced);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const identifier = session?.identifier ?? "";
  useEffect(() => setLastSeen(readSeen(identifier)), [identifier]);

  const role = session?.role ?? "cliente";
  const activity = useMemo(
    () => staffActivity({ appointments, clients }, { role, barberId: session?.barberId }, new Date(now)),
    [appointments, clients, role, session?.barberId, now],
  );
  // Hasta que llega el estado real no se sabe qué está conectado: no se avisa de más.
  const tasks = useMemo(() => (synced ? setupTasks({ integrations, services }, role) : []), [synced, integrations, services, role]);
  const unread = unreadCount(activity, tasks, lastSeen);

  const show = () => {
    setNow(Date.now());
    setOpen(true);
    const stamp = new Date().toISOString();
    try {
      localStorage.setItem(seenKey(identifier), stamp);
    } catch {
      // Sin almacenamiento la campana muestra todo como nuevo: no es grave.
    }
  };

  const close = () => {
    setOpen(false);
    setLastSeen(readSeen(identifier));
  };

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label={unread ? `Notificaciones, ${unread} nuevas` : "Notificaciones"}
        className="tap relative flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-surface-low"
      >
        <Bell size={21} aria-hidden />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[11px] font-bold text-on-primary ring-2 ring-surface"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <Sheet open={open} onClose={close} title="Notificaciones" subtitle="Lo último de tu agenda">
        <div className="flex flex-col gap-4 pb-2">
          <SetupChecklist tasks={tasks} shopName={session?.shop?.name} onNavigate={close} />

          {activity.length === 0 ? (
            <p className="rounded-2xl bg-surface-low px-4 py-6 text-center text-sm text-secondary">
              Todavía no hay novedades. Acá vas a ver los turnos nuevos, cancelados y reprogramados.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-2xl bg-surface-low">
              {activity.map((item) => {
                const Icon = ICONS[item.kind];
                const fresh = !lastSeen || item.at > lastSeen;
                return (
                  <li key={item.id} className="border-b border-surface-high last:border-0">
                    <Link href={item.href} transitionTypes={[...NAV.forward]} onClick={close} className="row hover:bg-surface-container">
                      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-lowest text-primary">
                        <Icon size={17} aria-hidden />
                        {fresh && (
                          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-surface-low">
                            <span className="sr-only">Nueva</span>
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-semibold">{item.title}</span>
                          <span className="shrink-0 text-[11px] text-secondary">{ago(item.at, now)}</span>
                        </span>
                        <span className="block truncate text-xs text-secondary">{item.body}</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-secondary" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <PushToggle />
        </div>
      </Sheet>
    </>
  );
}
