import { redirect } from "next/navigation";
import { rememberShop } from "@/server/auth";
import { shopBySlug } from "@/server/repository";

export const dynamic = "force-dynamic";

/**
 * Link público de cada barbería: /b/<slug>.
 *
 * Deja la barbería elegida en una cookie y manda a la app. Es lo que el local comparte con
 * sus clientes, y lo que permite que un visitante sin sesión sepa en qué barbería está.
 */
export async function GET(_request: Request, ctx: RouteContext<"/b/[slug]">) {
  const { slug } = await ctx.params;
  const shop = await shopBySlug(slug);
  if (!shop) redirect("/?local=desconocido");
  await rememberShop(shop.slug);
  // A la carta pública: el cliente ve servicios, precios y horarios antes de que le pidamos
  // crear una cuenta.
  redirect("/local");
}
