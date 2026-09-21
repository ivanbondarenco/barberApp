import { z } from "zod";
import { DomainError } from "@/lib/commands";
import { phoneKey, uid } from "@/lib/format";
import type { ClientProfile } from "@/lib/types";
import { startSession, visitorShop } from "@/server/auth";
import { hashPin, normalizeIdentifier } from "@/server/crypto";
import { queryAll, queryOne } from "@/server/db";
import { errorResponse, json, phoneSchema, pinSchema, readBody } from "@/server/http";
import { consumeOtp, issueOtp } from "@/server/otp";
import { ensureSeeded, mutate } from "@/server/repository";

const schema = z.object({
  name: z.string().trim().min(3, "Ingresá nombre y apellido"),
  phone: phoneSchema,
  email: z.union([z.literal(""), z.email("Email inválido")]).optional(),
  pin: pinSchema,
  /** Sin código se envía uno por WhatsApp; con código se crea la cuenta. */
  code: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const input = await readBody(request, schema);
    const shop = await visitorShop();
    if (!shop) return json({ error: "Abrí el link de tu barbería para registrarte." }, 400);

    const identifier = normalizeIdentifier(input.phone);
    const db = await ensureSeeded();

    // El celular ya tomado se avisa antes de gastar un envío de WhatsApp.
    if (queryOne(db, "SELECT id FROM users WHERE shop_id = ? AND identifier = ?", [shop.id, identifier])) {
      return json({ error: "Ya existe una cuenta con este celular. Iniciá sesión." }, 409);
    }

    if (!input.code) {
      const issued = await issueOtp(shop.id, identifier, "registro", input.phone);
      return json({ sent: true, ...issued });
    }

    await consumeOtp(shop.id, identifier, "registro", input.code);

    const now = new Date().toISOString();
    const userId = await mutate(
      (d) => {
        // Se vuelve a controlar dentro de la transacción: entre el código y el alta pudo
        // registrarse otro con el mismo celular.
        if (queryOne(d, "SELECT id FROM users WHERE shop_id = ? AND identifier = ?", [shop.id, identifier])) {
          throw new DomainError("Ya existe una cuenta con este celular. Iniciá sesión.", 409);
        }
        // Si el local ya lo cargó como cliente (por ejemplo, un turno manual), se vincula ese perfil.
        const existing = queryAll<{ id: string; data: string }>(d, "SELECT id, data FROM clients WHERE shop_id = ?", [
          shop.id,
        ]).find((row) => phoneKey((JSON.parse(row.data) as ClientProfile).phone) === phoneKey(input.phone));
        const clientId = existing?.id ?? uid("c");
        const profile: ClientProfile = existing
          ? { ...(JSON.parse(existing.data) as ClientProfile), name: input.name, email: input.email || undefined }
          : {
              id: clientId,
              name: input.name,
              phone: input.phone,
              email: input.email || undefined,
              notifications: { reminder24h: true, whatsapp: true },
              credit: 0,
              createdAt: now,
            };
        d.run(
          `INSERT INTO clients (shop_id, id, data, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(shop_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
          [shop.id, clientId, JSON.stringify(profile), now],
        );
        const id = uid("u");
        d.run(
          `INSERT INTO users (id, shop_id, role, identifier, name, client_id, pin_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, shop.id, "cliente", identifier, input.name, clientId, hashPin(input.pin), now],
        );
        return id;
      },
      { touchesState: shop.id },
    );

    await startSession(userId);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
