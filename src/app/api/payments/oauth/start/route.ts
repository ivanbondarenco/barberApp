import { cookies, headers } from "next/headers";
import { getCurrentUser } from "@/server/auth";
import { publicBaseUrl } from "@/server/http";
import { authorizationUrl, newAuthorization, oauthApp, oauthRedirectUri } from "@/server/mercadopago";
import { OAUTH_COOKIE, settingsUrl } from "../shared";

export const dynamic = "force-dynamic";

/**
 * "Conectar con Mercado Pago": manda al dueño a autorizar la app en Mercado Pago.
 *
 * El `state` y el verificador PKCE quedan en una cookie httpOnly que solo vuelve a esta ruta;
 * el callback los compara antes de canjear el código. Dura 10 minutos, lo mismo que el código.
 */
export async function GET(request: Request) {
  const base = publicBaseUrl(request);
  const current = await getCurrentUser();
  if (current?.actor.role !== "admin") return Response.redirect(`${base}/auth/login`, 303);

  const app = oauthApp();
  if (!app) return Response.redirect(settingsUrl(base, "no-disponible"), 303);

  const auth = newAuthorization();
  const forwardedProto = (await headers()).get("x-forwarded-proto");
  (await cookies()).set(
    OAUTH_COOKIE,
    JSON.stringify({
      state: auth.state,
      verifier: auth.verifier,
      shopId: current.actor.shopId,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: forwardedProto === "https",
      path: "/api/payments/oauth",
      maxAge: 600,
    },
  );
  return Response.redirect(
    authorizationUrl(app, {
      state: auth.state,
      challenge: auth.challenge,
      redirectUri: oauthRedirectUri(base),
    }),
    303,
  );
}
