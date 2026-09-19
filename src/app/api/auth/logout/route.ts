import { endSession } from "@/server/auth";
import { errorResponse, json } from "@/server/http";

export async function POST() {
  try {
    await endSession();
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
