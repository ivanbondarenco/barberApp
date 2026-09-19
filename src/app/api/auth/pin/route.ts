import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { hashPin, verifyPin } from "@/server/crypto";
import { errorResponse, json, pinSchema, readBody } from "@/server/http";
import { mutate } from "@/server/repository";

const schema = z.object({ currentPin: pinSchema, newPin: pinSchema });

export async function POST(request: Request) {
  try {
    const current = await getCurrentUser();
    if (!current) return json({ error: "Tu sesión expiró" }, 401);
    const { currentPin, newPin } = await readBody(request, schema);
    if (!verifyPin(currentPin, current.user.pin_hash)) return json({ error: "El PIN actual no es correcto" }, 401);
    if (currentPin === newPin) return json({ error: "El nuevo PIN debe ser distinto" }, 422);
    await mutate((db) => db.run("UPDATE users SET pin_hash = ? WHERE id = ?", [hashPin(newPin), current.user.id]));
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
