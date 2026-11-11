import "server-only";
import { arLocalDigits, AR_LOCAL_DIGITS } from "@/lib/phone";
import { reportError } from "./monitor";

/**
 * Avisos por WhatsApp desde el número único de BarberApp, a través de Evolution API
 * (ver deploy/WHATSAPP.md). No es la API oficial de Meta: no cobra por mensaje, pero el
 * número puede ser bloqueado si se abusa. Por eso:
 *  - todo es "mejor esfuerzo": si falta la configuración o falla el envío, no rompe nada;
 *  - los mensajes salen de a uno, con una pausa al azar entre cada uno (ritmo humano).
 *
 * Es otra cosa que `whatsapp.ts`, que manda los códigos de verificación por la Cloud API de
 * cada local.
 */

interface EvolutionConfig {
  url: string;
  apiKey: string;
  instance: string;
}

export function evolutionConfig(env: Record<string, string | undefined> = process.env): EvolutionConfig | undefined {
  const url = env.EVOLUTION_URL?.trim().replace(/\/+$/, "");
  const apiKey = env.EVOLUTION_API_KEY?.trim();
  if (!url || !apiKey) return undefined;
  return { url, apiKey, instance: env.EVOLUTION_INSTANCE?.trim() || "barberapp" };
}

/** Número en el formato que pide WhatsApp para celulares argentinos: 549 + 10 dígitos. */
export function waNumber(phone: string): string | undefined {
  const local = arLocalDigits(phone);
  return local.length === AR_LOCAL_DIGITS ? `549${local}` : undefined;
}

const MIN_GAP_MS = 4_000;
const MAX_GAP_MS = 9_000;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Cola en memoria: cada envío espera al anterior y a la pausa. Alcanza para un solo número. */
let queue: Promise<unknown> = Promise.resolve();

/** Manda un texto. Devuelve si salió; nunca tira error. */
export function sendWhatsappText(phone: string, text: string): Promise<boolean> {
  const config = evolutionConfig();
  const number = waNumber(phone);
  // Lo que no se va a mandar no hace cola ni espera la pausa.
  if (!config || !number) return Promise.resolve(false);
  const run = queue.then(() => deliver(config, number, text));
  queue = run.then(() => wait(MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS)));
  return run;
}

async function deliver(config: EvolutionConfig, number: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${config.url}/message/sendText/${encodeURIComponent(config.instance)}`, {
      method: "POST",
      cache: "no-store",
      headers: { apikey: config.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ number, text }),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) return true;
    const detail = await res.text().catch(() => "");
    await reportError("whatsapp-notify", new Error(`Evolution → ${res.status}`), { detail: detail.slice(0, 300) });
    return false;
  } catch (error) {
    await reportError("whatsapp-notify", error);
    return false;
  }
}
