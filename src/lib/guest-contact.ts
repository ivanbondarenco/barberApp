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
