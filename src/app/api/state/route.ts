import { getAccount, visitorShop } from "@/server/auth";
import { errorResponse, json } from "@/server/http";
import { listShops, loadState } from "@/server/repository";
import { stateForActor } from "@/server/visibility";

export const dynamic = "force-dynamic";

/**
 * Estado visible para la sesión actual, siempre acotado a una barbería.
 * `?v=<versión>` responde `unchanged` si esa barbería no cambió.
 *
 * `shops` (todas las barberías publicadas) va cuando hay que elegir: sin barbería activa, o
 * para un cliente, que puede sumarse a más.
 */
export async function GET(request: Request) {
  try {
    const account = await getAccount();
    const shop = account ? account.session.shop : await visitorShop();
    const shops = !shop || account?.user.role === "cliente" ? await listShops() : undefined;
    if (!shop) return json({ version: 0, session: account?.session ?? null, shop: null, shops });

    const { state, version } = await loadState(shop.id);
    const known = Number(new URL(request.url).searchParams.get("v"));
    if (known && known === version) {
      return json({ unchanged: true, version, session: account?.session ?? null, shop, shops });
    }
    return json({
      version,
      session: account?.session ?? null,
      shop,
      shops,
      state: stateForActor(state, account?.actor ?? null),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
