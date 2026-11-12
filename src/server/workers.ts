import "server-only";
import { reportError } from "./monitor";

/**
 * Tareas periódicas del servidor propias de la suscripción: los avisos de cobro (cada hora).
 * Corren dentro del mismo proceso de Next, sin cron externo. Los recordatorios de WhatsApp
 * viven aparte, en `reminder-worker.ts`.
 *
 * Supone UNA sola instancia de la app (como hoy, con la base en un archivo). El día que haya
 * varias, cada tick tiene que tomar un candado en la base (en Postgres, `pg_try_advisory_lock`)
 * para que dos instancias no repitan el barrido.
 */
const BILLING_EVERY_MS = 60 * 60_000;

const globalForWorkers = globalThis as unknown as { __dsWorkers?: boolean };

async function billingTick(): Promise<void> {
  try {
    const { runBillingSweep } = await import("./billing");
    await runBillingSweep(new Date());
  } catch (error) {
    await reportError("workers.billing", error);
  }
}

/** Arranca las tareas una sola vez por proceso. Lo llama `instrumentation.ts` al levantar. */
export function startWorkers(): void {
  if (globalForWorkers.__dsWorkers) return;
  globalForWorkers.__dsWorkers = true;
  // `unref`: los timers no impiden que el proceso termine (tests, apagado limpio).
  setTimeout(() => void billingTick(), 60_000).unref();
  setInterval(() => void billingTick(), BILLING_EVERY_MS).unref();
}
