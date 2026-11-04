import "server-only";
import { DomainError } from "@/lib/commands";
import type { Appointment, BusinessInfo, Shop } from "@/lib/types";
import { newToken, sha256 } from "./crypto";
import { queryOne } from "./db";
import { createDepositOrder, type CheckoutOutcome } from "./mercadopago";
import { ensureSeeded, loadState, mutate } from "./repository";

/**
 * Reservas sin cuenta, por el link del local.
 *
 * Al reservar, el invitado recibe un token que solo sirve para ESE turno: ver cómo quedó y
 * reintentar el pago de la seña. Viaja en la URL de la pantalla de resultado (y en la vuelta de
 * Mercado Pago); en la base se guarda únicamente su hash.
 */

/** Pantalla de resultado del invitado, con lo necesario para volver a encontrar el turno. */
export const guestResultPath = (outcome: CheckoutOutcome, appointmentId: string, token: string) =>
  `/reserva/${outcome}?turno=${encodeURIComponent(appointmentId)}&t=${encodeURIComponent(token)}`;

export async function issueGuestToken(shopId: string, appointmentId: string): Promise<string> {
  const token = newToken();
  await mutate((db) =>
    db.run("INSERT INTO guest_bookings (token_hash, shop_id, appointment_id, created_at) VALUES (?, ?, ?, ?)", [
      sha256(token),
      shopId,
      appointmentId,
      new Date().toISOString(),
    ]),
  );
  return token;
}

/** Turno al que da acceso el token, con los datos del local que lo atiende. */
export async function guestAppointment(
  appointmentId: string,
  token: string,
): Promise<{ shopId: string; appointment: Appointment; info: BusinessInfo }> {
  const db = await ensureSeeded();
  const row = queryOne<{ shop_id: string }>(db, "SELECT shop_id FROM guest_bookings WHERE token_hash = ? AND appointment_id = ?", [
    sha256(token),
    appointmentId,
  ]);
  if (!row) throw new DomainError("No encontramos esta reserva", 404);
  const { state } = await loadState(row.shop_id);
  const appointment = state.appointments.find((a) => a.id === appointmentId);
  if (!appointment) throw new DomainError("No encontramos esta reserva", 404);
  return { shopId: row.shop_id, appointment, info: state.businessInfo };
}

/** Abre el checkout de Mercado Pago (API de Orders) por la seña de un turno de invitado. */
export async function guestCheckout(
  shopId: string,
  appointment: Appointment,
  info: BusinessInfo,
  baseUrl: string,
  token: string,
): Promise<string> {
  if (appointment.status !== "confirmado") throw new DomainError("El turno no está activo");
  if (appointment.deposit.status === "abonada") throw new DomainError("La seña ya está abonada");
  const order = await createDepositOrder(shopId, appointment, info, baseUrl, (outcome) =>
    guestResultPath(outcome, appointment.id, token),
  );
  return order.initPoint;
}

/** Lo que ve el invitado de su turno: nada de la ficha ni del resto de la agenda. */
export function guestView(appointment: Appointment, info: BusinessInfo, shop: Pick<Shop, "name" | "slug"> | null) {
  return {
    appointment: {
      id: appointment.id,
      clientName: appointment.clientName,
      barberId: appointment.barberId,
      serviceName: appointment.serviceName,
      servicePrice: appointment.servicePrice,
      durationMin: appointment.durationMin,
      date: appointment.date,
      time: appointment.time,
      status: appointment.status,
      deposit: appointment.deposit,
      holdUntil: appointment.holdUntil,
    },
    info,
    shop,
  };
}

/**
 * Tope de reservas sin cuenta por IP, para que el link público no se pueda usar para llenar
 * la agenda de turnos falsos. En memoria: alcanza para un solo proceso, que es como corre la app.
 */
const RATE_WINDOW_MS = 60 * 60_000;
const RATE_MAX = 6;
const attempts = new Map<string, number[]>();

export function assertGuestRate(ip: string): void {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    throw new DomainError("Hiciste muchas reservas seguidas. Probá más tarde o escribile al local.", 429);
  }
  recent.push(now);
  attempts.set(ip, recent);
  // Que el mapa no crezca sin límite con IPs que no vuelven.
  if (attempts.size > 5000) {
    for (const [key, times] of attempts) if (!times.some((t) => now - t < RATE_WINDOW_MS)) attempts.delete(key);
  }
}
