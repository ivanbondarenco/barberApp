/**
 * Nombre y celular que dejó alguien al reservar sin cuenta, guardados en su teléfono.
 * Sirven para no pedírselos de nuevo: en la próxima reserva y al crear la cuenta.
 */
export interface GuestContact {
  name: string;
  phone: string;
}

const KEY = "ds-guest-contact";

export function readGuestContact(): GuestContact {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as { name?: unknown; phone?: unknown };
    return { name: typeof raw.name === "string" ? raw.name : "", phone: typeof raw.phone === "string" ? raw.phone : "" };
  } catch {
    return { name: "", phone: "" };
  }
}

export function saveGuestContact(contact: GuestContact): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(contact));
  } catch {
    // Sin almacenamiento la próxima vez lo vuelve a escribir, nada más.
  }
}

/**
 * La última reserva sin cuenta, para poder volver a verla. Sin sesión, el token del link es lo
 * único que identifica el turno: si solo vive en la URL del resultado, cerrar la pestaña lo pierde.
 */
export interface GuestBookingRef {
  id: string;
  token: string;
  /** Día y hora del turno (ISO y HH:mm): para no mostrarla una vez que pasó. */
  date: string;
  time: string;
  /** "jue 12 nov · 10:30 hs", listo para mostrar. */
  label: string;
}

const BOOKING_KEY = "ds-guest-booking";

export function guestBookingPath(ref: Pick<GuestBookingRef, "id" | "token">, estado = "pendiente"): string {
  return `/reserva/${estado}?turno=${encodeURIComponent(ref.id)}&t=${encodeURIComponent(ref.token)}`;
}

export function saveGuestBooking(ref: GuestBookingRef): void {
  try {
    localStorage.setItem(BOOKING_KEY, JSON.stringify(ref));
  } catch {
    // Sin almacenamiento le queda el link de la reserva, nada más.
  }
}

export function forgetGuestBooking(id?: string): void {
  try {
    if (id && readGuestBooking(new Date(0))?.id !== id) return;
    localStorage.removeItem(BOOKING_KEY);
  } catch {
    // Nada que borrar.
  }
}

/** La reserva guardada, solo si el turno todavía no pasó. */
export function readGuestBooking(now = new Date()): GuestBookingRef | null {
  try {
    const raw = JSON.parse(localStorage.getItem(BOOKING_KEY) ?? "null") as Partial<GuestBookingRef> | null;
    if (!raw || typeof raw.id !== "string" || typeof raw.token !== "string") return null;
    if (typeof raw.date !== "string" || typeof raw.time !== "string" || typeof raw.label !== "string") return null;
    const [y, mo, d] = raw.date.split("-").map(Number);
    const [h, mi] = raw.time.split(":").map(Number);
    if (new Date(y, mo - 1, d, h, mi).getTime() <= now.getTime()) return null;
    return { id: raw.id, token: raw.token, date: raw.date, time: raw.time, label: raw.label };
  } catch {
    return null;
  }
}
