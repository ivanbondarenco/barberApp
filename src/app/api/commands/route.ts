import { z } from "zod";
import type { Command } from "@/lib/commands";
import { getCurrentUser } from "@/server/auth";
import { errorResponse, json, readBody } from "@/server/http";
import { executeCommand } from "@/server/repository";
import { stateForActor } from "@/server/visibility";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  command: z.looseObject({ type: z.string().min(1) }),
});

export async function POST(request: Request) {
  try {
    const current = await getCurrentUser();
    if (!current) return json({ error: "Tu sesión expiró. Volvé a ingresar." }, 401);
    const { command } = await readBody(request, bodySchema);
    const { state, version } = await executeCommand(current.actor, command as unknown as Command);
    return json({ version, session: current.session, state: stateForActor(state, current.actor) });
  } catch (error) {
    return errorResponse(error);
  }
}
