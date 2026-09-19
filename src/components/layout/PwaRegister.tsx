"use client";

import { useEffect } from "react";
import { toast } from "@/store/useToast";

/** Registra el Service Worker solo en producción (en dev interfiere con HMR). */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* sin SW la app sigue funcionando online */
    });

    const onOffline = () => toast("Sin conexión: mostrando datos guardados", "info");
    const onOnline = () => toast("Conexión restablecida", "success");
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
