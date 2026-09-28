export type Role = "cliente" | "barbero" | "admin";

/** Roles que operan el local. `admin` es dueño: además maneja catálogo, equipo y configuración. */
export type StaffRole = Extract<Role, "barbero" | "admin">;

export const isStaff = (role: Role): role is StaffRole => role === "admin" || role === "barbero";

/** "credito": seña cubierta con crédito a favor por una cancelación en término. */
export type PaymentMethod = "mercadopago" | "transferencia" | "efectivo" | "credito";

/** Cómo elige el cliente abonar la seña al reservar. */
export type DepositChoice = "digital" | "efectivo" | "credito";

/** Una barbería. Cada una tiene sus datos, su equipo y su plata, aisladas del resto. */
export interface Shop {
  id: string;
  /** URL pública del local: /b/<slug> */
  slug: string;
  name: string;
}

export interface Session {
  role: Role;
  name: string;
  identifier: string;
  clientId?: string;
  /** Solo rol `barbero`: sillón que opera. Acota su agenda y sus cobros. */
  barberId?: string;
  /**
   * Barbería sobre la que opera la sesión. El staff siempre tiene la suya; un cliente, la que
   * eligió entre las suyas, o `null` si todavía no se sumó a ninguna.
   */
  shop: Shop | null;
  /** Solo clientes: las barberías en las que se atiende. */
  shops?: Shop[];
  /** Ya confirmó su email desde el link que le mandamos. */
  emailVerified?: boolean;
}

export interface ClientProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  preferences?: string;
  notifications: {
    reminder24h: boolean;
    whatsapp: boolean;
  };
  /** Crédito a favor (ARS) generado por cancelaciones en término. */
  credit: number;
  /** Nota interna del local (solo visible para el staff). */
  internalNotes?: string;
  /** true si el cliente tiene cuenta en la app (lo informa el servidor). */
  hasAccount?: boolean;
  createdAt: string;
}

export interface Barber {
  id: string;
  name: string;
  initials: string;
  title: string;
  chair: number;
  /** Promedio de las reseñas reales de sus turnos. Lo deriva el servidor; no se guarda. */
  rating?: number;
  /** Cantidad de reseñas recibidas. Derivado, igual que `rating`. */
  reviews?: number;
  phone?: string;
  active: boolean;
  /** true si el barbero tiene cuenta para entrar a la app (lo informa el servidor). */
  hasAccount?: boolean;
  /** Usuario con el que entra (email o celular), informado por el servidor. */
  accountIdentifier?: string;
}

export type ServiceCategory = "corte" | "barba" | "combo" | "tratamiento";

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  durationMin: number;
  category: ServiceCategory;
  tag?: string;
  featured?: boolean;
  active: boolean;
}

export type ProductCategory = "ceras" | "barba" | "afeitado" | "cuidado";

export type ProductShape = "jar" | "dropper" | "bottle" | "tube";

export interface Product {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  size: string;
  stock: number;
  category: ProductCategory;
  shape: ProductShape;
  active: boolean;
}

export interface AppointmentProduct {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
}

export type AppointmentStatus = "confirmado" | "completado" | "cancelado" | "no_show";

/**
 * `pendiente`: todavía no entró la plata.
 * `en_revision`: el cliente declaró una transferencia; la confirma el staff al ver el comprobante.
 * `abonada`: confirmada por el webhook de Mercado Pago, por el staff o por crédito a favor.
 */
export type DepositStatus = "pendiente" | "en_revision" | "abonada";

export interface Deposit {
  amount: number;
  status: DepositStatus;
  method: PaymentMethod;
  paidAt?: string;
  /** Momento en que el cliente declaró la transferencia (status `en_revision`). */
  declaredAt?: string;
  /** Id del pago en la pasarela o número de comprobante de la transferencia. */
  reference?: string;
}

export interface BalancePayment {
  amount: number;
  method: PaymentMethod;
  paidAt: string;
}

export interface Appointment {
  id: string;
  clientId?: string;
  clientName: string;
  clientPhone: string;
  verified: boolean;
  barberId: string;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  durationMin: number;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  time: string;
  notes?: string;
  deposit: Deposit;
  products: AppointmentProduct[];
  status: AppointmentStatus;
  balancePayment?: BalancePayment;
  source: "app" | "manual";
  createdAt: string;
  rescheduledFrom?: { date: string; time: string; at: string };
  cancelledAt?: string;
  /** Seña devuelta como crédito a favor al cancelar. */
  creditIssued?: number;
  /**
   * Reserva digital sin pagar: retiene el horario hasta este instante (ISO).
   * Vencido, el turno se libera solo. Se borra al acreditarse la seña.
   */
  holdUntil?: string;
  /** El horario se liberó porque venció el plazo de pago. */
  holdExpired?: boolean;
  /** El cliente no se presentó: la seña queda para el local. */
  noShowAt?: string;
  /** Seña retenida por ausencia (no vuelve como crédito). */
  depositForfeited?: number;
  /** Momento en que se envió el recordatorio previo al turno. */
  reminderSentAt?: string;
  /** Estrellas que le puso el cliente al turno terminado (1 a 5). Se califica una sola vez. */
  rating?: number;
}

export interface TimeBlock {
  id: string;
  barberId: string;
  date: string;
  start: string;
  end: string;
  reason: string;
}

export interface DepositSettings {
  /** Seña presencial en efectivo habilitada. */
  allowCash: boolean;
  /** Porcentaje del servicio que se pide como seña (0 = sin seña). Lo decide cada barbería. */
  rate: number;
}

/**
 * Qué integraciones tiene enchufadas esta barbería. Se deriva en el servidor y las
 * credenciales nunca salen de él: acá solo viaja si cada cosa está disponible o no.
 */
export interface IntegrationSettings {
  /** Hay credenciales de Mercado Pago: el cliente puede pagar la seña online. */
  mercadopagoReady: boolean;
  /** Hay credenciales de WhatsApp: se pueden enviar códigos de verificación. */
  whatsappReady: boolean;
}

export interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

/** Índice 0 = Domingo … 6 = Sábado */
export type BusinessHours = DayHours[];

export interface BusinessInfo {
  name: string;
  address: string;
  neighborhood: string;
  whatsapp: string;
  email: string;
  instagram: string;
  transferAlias: string;
  transferCbu: string;
}
