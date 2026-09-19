export type Role = "cliente" | "admin";

/** "credito": seña cubierta con crédito a favor por una cancelación en término. */
export type PaymentMethod = "mercadopago" | "transferencia" | "efectivo" | "credito";

/** Cómo elige el cliente abonar la seña al reservar. */
export type DepositChoice = "digital" | "efectivo" | "credito";

export interface Session {
  role: Role;
  name: string;
  identifier: string;
  clientId?: string;
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
    promos: boolean;
  };
  /** Crédito a favor (ARS) generado por cancelaciones en término. */
  credit: number;
  /** Nota interna del local (solo visible para el staff). */
  internalNotes?: string;
  /** true si el cliente tiene cuenta con PIN (lo informa el servidor). */
  hasAccount?: boolean;
  createdAt: string;
}

export interface Barber {
  id: string;
  name: string;
  initials: string;
  title: string;
  chair: number;
  rating: number;
  reviews: number;
  phone?: string;
  active: boolean;
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

export type AppointmentStatus = "confirmado" | "completado" | "cancelado";

export interface Deposit {
  amount: number;
  status: "abonada" | "pendiente";
  method: PaymentMethod;
  paidAt?: string;
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
}

export interface CashRegister {
  open: boolean;
  openedAt?: string;
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

export interface CashClosure {
  id: string;
  date: string;
  openedAt?: string;
  closedAt: string;
  expectedCash: number;
  countedCash: number;
  digital: number;
  total: number;
  notes?: string;
}
