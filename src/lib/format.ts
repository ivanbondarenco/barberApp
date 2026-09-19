import type { PaymentMethod } from "./types";

const ars = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** $11.000 */
export function money(value: number): string {
  return `$${ars.format(value)}`;
}

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  mercadopago: "Mercado Pago",
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  credito: "Crédito a favor",
};

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Últimos 10 dígitos: identifica un celular sin importar el formato (+54 9 11 …). */
export function phoneKey(value: string): string {
  return onlyDigits(value).slice(-10);
}

export function whatsappLink(phone: string, text?: string): string {
  const digits = onlyDigits(phone);
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function initials(name: string): string {
  return name
    .replace(/["“”]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
