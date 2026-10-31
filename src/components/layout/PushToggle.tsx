"use client";

import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/store/useToast";

type Status = "loading" | "hidden" | "unsupported" | "denied" | "off" | "on";

/** La clave VAPID viaja en base64url; `subscribe` la pide en bytes. */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  return navigator.serviceWorker.getRegistration("/");
}

/**
 * Avisos de turnos nuevos en este celular. Es por dispositivo: cada barbero lo activa en el
 * suyo. En iPhone solo funciona con la app instalada en la pantalla de inicio.
 */
export function PushToggle() {
  const [status, setStatus] = useState<Status>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/push", { credentials: "same-origin" }).catch(() => null);
      const data = res?.ok ? ((await res.json()) as { publicKey: string | null }) : null;
      // Sin claves en el servidor no hay nada que ofrecer.
      if (!data?.publicKey) return !cancelled && setStatus("hidden");
      setPublicKey(data.publicKey);
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return !cancelled && setStatus("unsupported");
      }
      if (Notification.permission === "denied") return !cancelled && setStatus("denied");
      const sub = await (await registration())?.pushManager.getSubscription();
      if (!cancelled) setStatus(sub ? "on" : "off");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await registration();
      if (!reg) return toast("Recargá la app e intentá de nuevo", "error");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        await sub.unsubscribe();
        return toast("No pudimos activar los avisos", "error");
      }
      setStatus("on");
      toast("Listo: te avisamos cuando entre un turno", "success");
    } catch {
      toast("No pudimos activar los avisos en este dispositivo", "error");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const sub = await (await registration())?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading" || status === "hidden") return null;

  const hint =
    status === "unsupported"
      ? "En iPhone, primero instalá la app: Compartir → Agregar a inicio."
      : status === "denied"
        ? "Bloqueaste las notificaciones. Habilitalas en los ajustes del navegador."
        : "Turnos nuevos, cancelados o reprogramados, en este celular.";

  return (
    <label className="flex items-center gap-3 rounded-2xl bg-surface-low px-4 py-3">
      <BellRing size={19} className="shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Avisos de turnos</span>
        <span className="block text-xs text-secondary">{hint}</span>
      </span>
      {(status === "on" || status === "off") && (
        <Switch
          checked={status === "on"}
          locked={busy}
          onChange={(v) => void (v ? enable() : disable())}
          label="Avisos de turnos"
        />
      )}
    </label>
  );
}
