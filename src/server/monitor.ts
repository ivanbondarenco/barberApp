import "server-only";

/**
 * Aviso de errores del servidor.
 *
 * Todo error se loguea. Si hay ALERT_WEBHOOK_URL, además se manda como POST JSON a esa URL: sirve
 * un webhook entrante de Slack (`text`), de Discord (`content`) o cualquier servicio que reciba
 * JSON. Así un webhook de pago que falla, o un mail que no sale, no pasan en silencio.
 *
 * Nunca viaja el cuerpo del pedido ni datos de clientes: solo qué falló, dónde y el stack.
 */

/** Un mismo error no se vuelve a avisar hasta pasado este tiempo: evita inundar el canal. */
const DEDUPE_MS = 10 * 60_000;
const sent = new Map<string, number>();

export interface ErrorContext {
  [key: string]: string | number | undefined;
}

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: error.message, stack: error.stack };
  return { message: typeof error === "string" ? error : JSON.stringify(error) };
}

/**
 * Registra el error y, si corresponde, lo avisa. No lanza nunca: un canal de alertas caído no
 * puede tirar abajo el pedido que estaba fallando.
 */
export async function reportError(where: string, error: unknown, context: ErrorContext = {}): Promise<void> {
  const { message, stack } = describe(error);
  console.error(`[${where}] ${message}`, context, stack ?? "");

  const url = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!url) return;

  const fingerprint = `${where}:${message}`;
  const now = Date.now();
  const last = sent.get(fingerprint);
  if (last !== undefined && now - last < DEDUPE_MS) return;
  sent.set(fingerprint, now);
  // El mapa no crece sin límite: se olvida lo viejo.
  for (const [key, at] of sent) if (now - at > DEDUPE_MS) sent.delete(key);

  const app = process.env.APP_URL?.trim() || "BarberApp";
  const extra = Object.entries(context)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
  const text = `🔴 ${app} — ${where}: ${message}${extra ? `\n${extra}` : ""}`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content: text, where, message, context, stack: stack?.slice(0, 1500) }),
      signal: AbortSignal.timeout(3_000),
    });
  } catch (alertError) {
    console.error("[monitor] no se pudo mandar el aviso:", describe(alertError).message);
  }
}

/** Solo para tests: olvida los avisos ya mandados. */
export function resetAlertsForTests(): void {
  sent.clear();
}
