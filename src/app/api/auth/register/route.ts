import { z } from "zod";
import { DomainError } from "@/lib/commands";
import { phoneKey, uid } from "@/lib/format";
import { DEMO_OTP } from "@/lib/mock-data";
import type { ClientProfile } from "@/lib/types";
import { startSession } from "@/server/auth";
import { hashPin, normalizeIdentifier } from "@/server/crypto";
import { queryAll, queryOne } from "@/server/db";
import { errorResponse, json, phoneSchema, pinSchema, readBody } from "@/server/http";
import { mutate } from "@/server/repository";

const schema = z.object({
  name: z.string().trim().min(3, "Ingresá nombre y apellido"),
  phone: phoneSchema,
  email: z.union([z.literal(""), z.email("Email inválido")]).optional(),
  pin: pinSchema,
  code: z.string(),
});

export async function POST(request: Request) {
  try {
    const input = await readBody(request, schema);
    if (input.code !== DEMO_OTP) return json({ error: "Código de verificación incorrecto" }, 401);
    const identifier = normalizeIdentifier(input.phone);
    const now = new Date().toISOString();

    const userId = await mutate(
      (db) => {
        if (queryOne(db, "SELECT id FROM users WHERE identifier = ?", [identifier])) {
          throw new DomainError("Ya existe una cuenta con este celular. Iniciá sesión.", 409);
        }
        // Si el local ya lo cargó como cliente (por ejemplo, un turno manual), se vincula ese perfil.
        const existing = queryAll<{ id: string; data: string }>(db, "SELECT id, data FROM clients").find(
          (row) => phoneKey((JSON.parse(row.data) as ClientProfile).phone) === phoneKey(input.phone),
        );
        const clientId = existing?.id ?? uid("c");
        const profile: ClientProfile = existing
          ? { ...(JSON.parse(existing.data) as ClientProfile), name: input.name, email: input.email || undefined }
          : {
              id: clientId,
              name: input.name,
              phone: input.phone,
              email: input.email || undefined,
              notifications: { reminder24h: true, whatsapp: true, promos: false },
              credit: 0,
              createdAt: now,
            };
        db.run(
          `INSERT INTO clients (id, data, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
          [clientId, JSON.stringify(profile), now],
        );
        const id = uid("u");
        db.run(
          "INSERT INTO users (id, role, identifier, name, client_id, pin_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [id, "cliente", identifier, input.name, clientId, hashPin(input.pin), now],
        );
        return id;
      },
      { touchesState: true },
    );

    await startSession(userId);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
