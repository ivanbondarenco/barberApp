import { getAccount, visitorShop } from "@/server/auth";
import { errorResponse, json } from "@/server/http";
import { shopBillingStatus } from "@/server/billing-access";
import { ensureSeeded, listShops, loadState } from "@/server/repository";
import { stateForActor } from "@/server/visibility";

export const dynamic = "force-dynamic";

/**
 * Estado visible para la sesión actual, siempre acotado a una barbería.
 * `?v=<versión>` responde `unchanged` si esa barbería no cambió.
 *
 * `shops` (todas las barberías publicadas) va cuando hay que elegir: sin barbería activa, o
 * para un cliente, que puede sumarse a más.
 *
 * `billing.suspended` dice si el local tiene la suscripción suspendida: así las pantallas de
 * reserva pueden avisarlo de entrada en vez de fallar al confirmar. Va fuera del estado de
 * dominio, igual que la sesión.
 */
export async function GET(request: Request) {
  try {
    const account = await getAccount();
    const shop = account ? account.session.shop : await visitorShop();
    const shops = !shop || account?.user.role === "cliente" ? await listShops() : undefined;
    if (!shop) return json({ version: 0, session: account?.session ?? null, shop: null, shops });

    const { state, version } = await loadState(shop.id);
    const billing = { suspended: shopBillingStatus(await ensureSeeded(), shop.id) === "suspended" };
    const known = Number(new URL(request.url).searchParams.get("v"));
    if (known && known === version) {
      return json({ unchanged: true, version, session: account?.session ?? null, shop, shops, billing });
    }
    return json({
      version,
      session: account?.session ?? null,
      shop,
      shops,
      billing,
      state: stateForActor(state, account?.actor ?? null),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
