import type { Instrumentation } from "next";

/**
 * Corre una vez al levantar el servidor, antes de atender pedidos: si la configuración de
 * producción es insegura, la app no arranca (ver `src/server/startup.ts`).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkProductionConfig } = await import("./server/startup");
  checkProductionConfig();
  // Recordatorios del día anterior por WhatsApp. Sin EVOLUTION_URL no hace nada.
  const { startReminderWorker } = await import("./server/reminder-worker");
  startReminderWorker();
  // Respaldo del webhook de Mercado Pago: acredita señas cuya notificación se perdió.
  const { startOrderReconciler } = await import("./server/mp-orders");
  startOrderReconciler();
  // Avisos de la suscripción. `DISABLE_WORKERS=1` los apaga (por ejemplo, en una segunda
  // instancia mientras la base no tenga candados).
  if (process.env.DISABLE_WORKERS !== "1") {
    const { startWorkers } = await import("./server/workers");
    startWorkers();
  }
}

/** Errores que Next captura por su cuenta (render, rutas): también avisan. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("./server/monitor");
  // Solo el camino, sin la query: puede traer tokens o datos personales.
  await reportError("next", error, { path: request.path.split("?")[0], route: context.routePath, type: context.routeType });
};
