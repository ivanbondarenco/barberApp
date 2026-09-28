import { z } from "zod";
import { DomainError } from "@/lib/commands";
import { todayISO } from "@/lib/dates";
import { clientShops, getAccount, setSessionShop } from "@/server/auth";
import { queryOne } from "@/server/db";
import { errorResponse, json, readBody } from "@/server/http";
import { clientContact, ensureSeeded, joinShopTx, mutate, shopRow } from "@/server/repository";

const schema = z.object({
  shopId: z.string().min(1),
  /** join: se suma · leave: deja de atenderse ahí · select: pasa a operar en esa. */
  action: z.enum(["join", "leave", "select"]),
});

/** Barberías de un cliente: sumarse a una, dejarla o cambiar la activa. */
export async function POST(request: Request) {
  try {
    const account = await getAccount();
    if (!account) return json({ error: "Tu sesión expiró. Volvé a ingresar." }, 401);
    if (account.user.role !== "cliente") return json({ error: "Solo para clientes" }, 403);

    const { shopId, action } = await readBody(request, schema);
    const db = await ensureSeeded();
    const shop = shopRow(db, shopId);
    if (!shop) return json({ error: "La barbería no existe" }, 404);
    const userId = account.user.id;
    const isMember = () => clientShops(db, userId).some((s) => s.id === shopId);

    if (action === "join") {
      const contact = clientContact(db, userId);
      if (!contact?.phone) throw new DomainError("Completá tu celular en el perfil para sumarte a una barbería", 422);
      const wasMember = isMember();
      await mutate((d) => joinShopTx(d, userId, shopId, contact, new Date().toISOString()));
      // La primera barbería queda activa; si ya tenía otras, sigue en la que estaba.
      if (!wasMember && !account.session.shop) await setSessionShop(shop);
    } else if (action === "leave") {
      // La ficha y los turnos quedan en el local: solo se corta el vínculo con la cuenta.
      if (
        queryOne(
          db,
          `SELECT a.id FROM appointments a JOIN memberships m ON m.shop_id = a.shop_id AND m.client_id = a.client_id
            WHERE m.user_id = ? AND a.shop_id = ? AND a.status = 'confirmado' AND a.date >= ?`,
          [userId, shopId, todayISO()],
        )
      ) {
        throw new DomainError("Tenés turnos por delante en esta barbería. Cancelalos antes de dejarla.", 409);
      }
      await mutate((d) => d.run("DELETE FROM memberships WHERE user_id = ? AND shop_id = ?", [userId, shopId]), {
        touchesState: shopId,
      });
    } else {
      if (!isMember()) return json({ error: "Primero sumate a esta barbería" }, 403);
      await setSessionShop(shop);
    }

    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
