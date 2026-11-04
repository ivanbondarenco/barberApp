import { redirect } from "next/navigation";
import { getAccount, rememberShop, setSessionShop } from "@/server/auth";
import { shopBySlug } from "@/server/repository";

export const dynamic = "force-dynamic";

/**
 * Link público de cada barbería: /b/<slug>.
 *
 * Deja la barbería elegida en una cookie y lleva a operar en ella. Es lo que el local comparte
 * con sus clientes, así que el destino es siempre la app de esa barbería: sin sesión, la reserva
 * rápida (servicio, barbero, horario, nombre y celular, sin crear cuenta); con sesión, directo a
 * reservar desde la app.
 */
export async function GET(_request: Request, ctx: RouteContext<"/b/[slug]">) {
  const { slug } = await ctx.params;
  const shop = await shopBySlug(slug);
  if (!shop) redirect("/auth/login?local=desconocido");
  await rememberShop(shop.slug);

  const account = await getAccount();
  // Sin sesión: a reservar sin cuenta, ya parado en esta barbería.
  if (!account) redirect("/reservar");

  // El staff no entra como cliente por el link de un local: va a su panel.
  if (account.user.role !== "cliente") redirect("/admin/agenda");

  // Ya se atiende acá: la barbería del link pasa a ser la activa.
  if (account.session.shops?.some((s) => s.id === shop.id)) {
    if (account.session.shop?.id !== shop.id) await setSessionShop(shop);
    redirect("/cliente/reservar");
  }

  // Tiene cuenta pero todavía no se atiende en esta barbería: a sumarse.
  redirect("/cliente/barberias");
}
