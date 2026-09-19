import { getCurrentUser } from "@/server/auth";
import { errorResponse, json } from "@/server/http";
import { loadState } from "@/server/repository";
import { stateForActor } from "@/server/visibility";

export const dynamic = "force-dynamic";

/** Estado visible para la sesión actual. `?v=<versión>` responde `unchanged` si no hubo cambios. */
export async function GET(request: Request) {
  try {
    const current = await getCurrentUser();
    const { state, version } = await loadState();
    const known = Number(new URL(request.url).searchParams.get("v"));
    if (known && known === version) {
      return json({ unchanged: true, version, session: current?.session ?? null });
    }
    return json({ version, session: current?.session ?? null, state: stateForActor(state, current?.actor ?? null) });
  } catch (error) {
    return errorResponse(error);
  }
}
