import type { Service } from "./types";

/**
 * Suscripción de cada barbería a BarberApp: reglas puras sobre fechas y precios, sin base ni
 * red, para poder probarlas y para que el servidor y las pantallas digan lo mismo.
 *
 * El ciclo es: prueba gratis → al día (pagado) → vencida con días de gracia → suspendida.
 * Suspendida no borra nada: el local deja de operar hasta que pague.
 */

/** Días de prueba gratis de una barbería nueva (lo que la landing anuncia como "1 mes"). */
export const TRIAL_DAYS = 30;
/** Días que se sigue operando con la cuota vencida antes de suspender. */
export const GRACE_DAYS = 7;
/** Piso del precio mensual si no está PLAN_MIN_PRICE. */
export const DEFAULT_PLAN_MIN_PRICE = 10_000;
/** A partir de cuántos días de prueba restantes se le avisa al dueño. */
export const TRIAL_WARNING_DAYS = 7;

const DAY_MS = 86_400_000;

export type BillingStatus = "trial" | "active" | "past_due" | "suspended";

export type BillingMethod = "mercadopago" | "transferencia" | "efectivo";

export interface BillingDates {
  trialEndsAt: string;
  /** Hasta cuándo está paga la suscripción. `null`: nunca pagó. */
  paidUntil: string | null;
}

export const BILLING_STATUS_LABEL: Record<BillingStatus, string> = {
  trial: "Prueba gratis",
  active: "Al día",
  past_due: "Vencida",
  suspended: "Suspendida",
};

export const BILLING_METHOD_LABEL: Record<BillingMethod, string> = {
  mercadopago: "Mercado Pago",
  transferencia: "Transferencia",
  efectivo: "Efectivo",
};

const time = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : 0;
};

/** Hasta cuándo puede operar sin pagar: el final de la prueba o de lo pago, lo que sea más tarde. */
export function coveredUntil(dates: BillingDates): Date {
  return new Date(Math.max(time(dates.trialEndsAt), time(dates.paidUntil)));
}

/**
 * Estado de la suscripción en un momento dado.
 *
 * Mientras dure la prueba se informa `trial` aunque ya haya pagado por adelantado: el pago
 * empieza a correr cuando termina la prueba (ver `extendPaidUntil`).
 */
export function billingStatus(dates: BillingDates, now: Date = new Date()): BillingStatus {
  const t = now.getTime();
  if (time(dates.trialEndsAt) > t) return "trial";
  if (time(dates.paidUntil) > t) return "active";
  if (coveredUntil(dates).getTime() + GRACE_DAYS * DAY_MS > t) return "past_due";
  return "suspended";
}

/** Cuándo se suspende si no paga: lo cubierto más los días de gracia. */
export function suspendsAt(dates: BillingDates): Date {
  return new Date(coveredUntil(dates).getTime() + GRACE_DAYS * DAY_MS);
}

/**
 * Días que le quedan al período actual (prueba o mes pago), redondeando para arriba: con 3 horas
 * restantes queda "1 día", no "0". Negativo si ya venció.
 */
export function daysLeft(dates: BillingDates, now: Date = new Date()): number {
  return Math.ceil((coveredUntil(dates).getTime() - now.getTime()) / DAY_MS);
}

/** Suma meses a una fecha sin desbordar: 31/01 + 1 mes = 28/02 (o 29), no 03/03. */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/**
 * Nuevo "pagado hasta" después de cobrar `months` meses.
 *
 * Arranca desde lo más tarde entre hoy, lo ya pagado y el final de la prueba: pagar antes de
 * tiempo no le hace perder días de prueba ni de lo que ya tenía pago, y pagar con la cuota
 * vencida arranca desde hoy (los días suspendidos no se cobran).
 */
export function extendPaidUntil(dates: BillingDates, months = 1, now: Date = new Date()): Date {
  const from = Math.max(now.getTime(), time(dates.paidUntil), time(dates.trialEndsAt));
  return addMonths(new Date(from), months);
}

/** Próximo cobro de la suscripción automática: cuando se termina lo cubierto. */
export function nextRenewal(dates: BillingDates, now: Date = new Date()): Date {
  const end = coveredUntil(dates);
  return end.getTime() > now.getTime() ? end : now;
}

/** ¿Hay que mostrarle al dueño el aviso de la suscripción? */
export function needsAttention(dates: BillingDates, now: Date = new Date()): boolean {
  const status = billingStatus(dates, now);
  if (status === "past_due" || status === "suspended") return true;
  return status === "trial" && daysLeft(dates, now) <= TRIAL_WARNING_DAYS;
}

/** Piso del precio desde el entorno (PLAN_MIN_PRICE), con el valor por defecto si no es válido. */
export function planMinPrice(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.PLAN_MIN_PRICE);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : DEFAULT_PLAN_MIN_PRICE;
}

/** Servicio que fija el precio del plan, para poder explicarlo ("2 cortes de $X"). */
export function planReferenceService<T extends Pick<Service, "price" | "category" | "active">>(services: T[]): T | undefined {
  const active = services.filter((s) => s.active && s.price > 0);
  const cheapest = (list: T[]) => list.reduce<T | undefined>((min, s) => (!min || s.price < min.price ? s : min), undefined);
  // El más barato: si hay varios cortes, lo justo es tomar el de menor precio.
  return cheapest(active.filter((s) => s.category === "corte")) ?? cheapest(active);
}

/**
 * Precio mensual del plan: "el valor de 2 cortes de tu barbería".
 *
 * 2 × el corte activo más barato; sin cortes, 2 × el servicio activo más barato; nunca menos
 * que el piso. Es el único lugar donde se decide: si cambia la regla comercial, se cambia acá.
 */
export function planPrice(
  services: Pick<Service, "price" | "category" | "active">[],
  minPrice: number = DEFAULT_PLAN_MIN_PRICE,
): number {
  const reference = planReferenceService(services);
  return Math.max(minPrice, reference ? Math.round(reference.price * 2) : 0);
}

// ───────── Lo que viaja a las pantallas ─────────

export interface BillingPayment {
  id: string;
  amount: number;
  method: BillingMethod;
  paidUntil: string;
  note?: string;
  createdAt: string;
}

/** Respuesta de GET /api/billing (solo el dueño). */
export interface BillingInfo {
  status: BillingStatus;
  /** Demo o tests: nunca se suspende. */
  exempt: boolean;
  trialEndsAt: string;
  paidUntil: string | null;
  daysLeft: number;
  suspendsAt: string;
  nextRenewal: string;
  price: number;
  minPrice: number;
  /** Servicio con el que se calculó el precio. `null`: todavía no cargó servicios (rige el piso). */
  reference: { name: string; price: number } | null;
  /** Suscripción automática de Mercado Pago, si alguna vez la inició. */
  subscription: { id: string; status: string } | null;
  /** ¿La instalación puede cobrar suscripciones por Mercado Pago? */
  mercadopagoAvailable: boolean;
  /** Email del dueño para Mercado Pago. `null`: entró con el celular y hay que pedírselo. */
  ownerEmail: string | null;
  payments: BillingPayment[];
}

/** Respuesta de GET /api/billing/status (todo el staff): lo justo para el aviso del panel. */
export interface BillingStatusInfo {
  status: BillingStatus;
  daysLeft: number;
  attention: boolean;
}

/** ¿La suscripción automática está andando? (Mercado Pago la deja `authorized`.) */
export const subscriptionActive = (subscription: BillingInfo["subscription"]) => subscription?.status === "authorized";
