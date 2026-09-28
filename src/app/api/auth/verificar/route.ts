import { redirect } from "next/navigation";
import { getAccount } from "@/server/auth";
import { verifyEmailEmail } from "@/server/emails";
import { errorResponse, json } from "@/server/http";
import { mailReady, sendMail } from "@/server/mail";
import { consumeEmailVerification, emailOf, issueEmailVerification } from "@/server/notify";

export const dynamic = "force-dynamic";

/**
 * Link del mail de confirmación. No pide sesión: el que tiene el token es el que recibió
 * el mail. Sirve una sola vez y vence a las 48 horas.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const ok = token ? await consumeEmailVerification(token) : false;
  redirect(ok ? "/?email=confirmado" : "/?email=vencido");
}

/** Reenvía el mail de confirmación a la casilla de la cuenta. */
export async function POST() {
  try {
    const account = await getAccount();
    if (!account) return json({ error: "Tu sesión expiró" }, 401);
    if (account.session.emailVerified) return json({ ok: true, alreadyVerified: true });
    const to = emailOf(account.user.identifier);
    if (!to) return json({ error: "Tu cuenta no tiene un email para confirmar" }, 422);
    if (!mailReady()) return json({ error: "Los mails todavía no están configurados. Escribile a tu barbería." }, 503);

    const link = await issueEmailVerification(account.user.id);
    await sendMail({ to, ...verifyEmailEmail(account.user.name, link) });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
