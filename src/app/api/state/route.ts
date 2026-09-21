import { getCurrentUser, visitorShop } from "@/server/auth";
import { errorResponse, json } from "@/server/http";
import { listShops, loadState } from "@/server/repository";
import { stateForActor } from "@/server/visibility";

export const dynamic = "force-dynamic";

/**
 * Estado visible para la sesión actual, siempre acotado a una barbería.
 * `?v=<versión>` responde `unchanged` si esa barbería no cambió.
 *
 * Sin sesión y sin barbería elegida se devuelve la lista para que el visitante elija.
 */
export async function GET(request: Request) {
  try {
    const current = await getCurrentUser();
    const shop = current?.session.shop ?? (await visitorShop());
    if (!shop) return json({ version: 0, session: null, shops: await listShops() });

    const { state, version } = await loadState(shop.id);
    const known = Number(new URL(request.url).searchParams.get("v"));
    if (known && known === version) {
      return json({ unchanged: true, version, session: current?.session ?? null, shop });
    }
    return json({
      version,
      session: current?.session ?? null,
      shop,
      state: stateForActor(state, current?.actor ?? null),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
