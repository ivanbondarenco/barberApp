import "server-only";
import { z } from "zod";
import { DomainError } from "@/lib/commands";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof DomainError) return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError) return json({ error: error.issues[0]?.message ?? "Datos inválidos" }, 422);
  console.error(error);
  return json({ error: "Error inesperado. Probá de nuevo." }, 500);
}

export async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new DomainError("Cuerpo de la solicitud inválido", 400);
  }
  return schema.parse(raw);
}

export const phoneSchema = z
  .string()
  .trim()
  .refine((v) => {
    const d = v.replace(/\D/g, "");
    return d.length >= 10 && d.length <= 13;
  }, "Celular inválido");
