import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { DomainError } from "@/lib/commands";
import { getCurrentUser } from "@/server/auth";
import { publicBaseUrl } from "@/server/http";
import { connectAccount, oauthApp, oauthRedirectUri } from "@/server/mercadopago";
import { reportError } from "@/server/monitor";
import { OAUTH_COOKIE, settingsUrl } from "../shared";

export const dynamic = "force-dynamic";

const sameText = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Vuelta de Mercado Pago después de que el dueño autorizó (o no) la app.
 *
 * Solo se acepta si el `state` coincide con el de la cookie y quien vuelve es el mismo dueño de
 * la misma barbería que empezó: si no, alguien podría colgarle su cuenta de Mercado Pago a otro
 * local y quedarse con sus señas.
 */
export async function GET(request: Request) {
  const base = publicBaseUrl(request);
  const url = new URL(request.url);
  const store = await cookies();
  const raw = store.get(OAUTH_COOKIE)?.value;
  store.delete({ name: OAUTH_COOKIE, path: "/api/payments/oauth" });

  // El dueño tocó "Cancelar" en Mercado Pago.
  if (url.searchParams.get("error")) return Response.redirect(settingsUrl(base, "cancelado"), 303);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const app = oauthApp();
  let saved: { state?: string; verifier?: string; shopId?: string } = {};
  try {
    saved = raw ? JSON.parse(raw) : {};
  } catch {
    saved = {};
  }

  const current = await getCurrentUser();
  const valid =
    app &&
    code &&
    state &&
    saved.state &&
    saved.verifier &&
    sameText(state, saved.state) &&
    current?.actor.role === "admin" &&
    current.actor.shopId === saved.shopId;
  if (!valid) return Response.redirect(settingsUrl(base, "error"), 303);

  try {
    await connectAccount(current.actor.shopId, app, {
      code,
      verifier: saved.verifier!,
      redirectUri: oauthRedirectUri(base),
    });
  } catch (error) {
    // connectAccount ya reportó el detalle de Mercado Pago; esto cubre lo demás.
    if (!(error instanceof DomainError)) await reportError("mercadopago.oauth", error);
    return Response.redirect(settingsUrl(base, "error"), 303);
  }
  return Response.redirect(settingsUrl(base, "conectado"), 303);
}
