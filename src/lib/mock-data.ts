import { addDays, isSunday, todayISO } from "./dates";
import { phoneKey } from "./format";
import { splitDeposit } from "./pricing";
import type {
  Appointment,
  AppointmentProduct,
  Barber,
  BusinessInfo,
  CashClosure,
  ClientProfile,
  PaymentMethod,
  Product,
  Service,
  TimeBlock,
} from "./types";

export const DEMO_CLIENT = {
  id: "c-demo",
  name: "Tomás Ferreyra",
  phone: "+54 9 11 5555-0192",
  email: "tomas.ferreyra@gmail.com",
};

export const DEMO_ADMIN = {
  name: "Diego Sosa",
  identifier: "admin@dsstudio.com.ar",
};

export const seedBusinessInfo: BusinessInfo = {
  name: "D.S Studio Barbería",
  address: "Honduras 4820",
  neighborhood: "Palermo Soho, CABA",
  whatsapp: "+54 9 11 4000-2244",
  email: "hola@dsstudio.com.ar",
  instagram: "@ds.studio.barberia",
  transferAlias: "D.S.BARBERIA",
  transferCbu: "0000003100092837465019",
};

export const barbers: Barber[] = [
  {
    id: "b-nico",
    name: "Nico “Blade” R.",
    initials: "NR",
    title: "D.S Master Specialist",
    chair: 2,
    rating: 4.97,
    reviews: 312,
    phone: "+54 9 11 3100-2020",
    active: true,
  },
  {
    id: "b-diego",
    name: "Diego S.",
    initials: "DS",
    title: "Barber Master",
    chair: 1,
    rating: 4.92,
    reviews: 268,
    phone: "+54 9 11 3100-1010",
    active: true,
  },
];

export const seedServices: Service[] = [
  {
    id: "s-skin-fade",
    name: "Corte Skin Fade Urbano",
    description: "Degradado con máquina de precisión, acabado a navaja y perfilado.",
    price: 11000,
    durationMin: 45,
    category: "corte",
    tag: "Top Elección",
    featured: true,
    active: true,
  },
  {
    id: "s-combo-barba",
    name: "Combo Corte + Barba Clásica",
    description: "Vaporizador calmante, toalla caliente perfumada, aceites y cera mate.",
    price: 16000,
    durationMin: 60,
    category: "combo",
    tag: "Ritual Completo",
    active: true,
  },
  {
    id: "s-signature",
    name: "Corte Signature Fade",
    description: "Fade a medida con diseño de contornos y styling final.",
    price: 12000,
    durationMin: 45,
    category: "corte",
    tag: "Top",
    active: true,
  },
  {
    id: "s-tijera",
    name: "Corte Clásico Tijera",
    description: "Corte tradicional a tijera con lavado y peinado.",
    price: 9500,
    durationMin: 30,
    category: "corte",
    active: true,
  },
  {
    id: "s-barboterapia",
    name: "Barboterapia & Toalla Tibia",
    description: "Perfilado de barba, toalla tibia y aceites esenciales.",
    price: 7500,
    durationMin: 30,
    category: "barba",
    active: true,
  },
];

export const seedProducts: Product[] = [
  {
    id: "p-clay",
    name: "Matte Styling Clay",
    subtitle: "Acabado seco y fijación alta",
    price: 9800,
    size: "100g",
    stock: 14,
    category: "ceras",
    shape: "jar",
    active: true,
  },
  {
    id: "p-elixir",
    name: "Beard Elixir Cedro",
    subtitle: "Nutrición, aroma & brillo",
    price: 8200,
    size: "30ml",
    stock: 3,
    category: "barba",
    shape: "dropper",
    active: true,
  },
  {
    id: "p-pomade",
    name: "Pomada Brillo Clásico",
    subtitle: "Fijación media, efecto wet",
    price: 8900,
    size: "90g",
    stock: 9,
    category: "ceras",
    shape: "jar",
    active: true,
  },
  {
    id: "p-aftershave",
    name: "After Shave Bálsamo",
    subtitle: "Calma e hidrata sin ardor",
    price: 7600,
    size: "100ml",
    stock: 6,
    category: "afeitado",
    shape: "bottle",
    active: true,
  },
  {
    id: "p-shampoo",
    name: "Shampoo Barba & Pelo",
    subtitle: "Limpieza suave de uso diario",
    price: 6900,
    size: "250ml",
    stock: 11,
    category: "cuidado",
    shape: "tube",
    active: true,
  },
];

/** PIN de las cuentas demo (cliente y admin). */
export const DEMO_PIN = "1234";

const WALK_IN_CLIENTS = [
  { id: "c-mateo", name: "Mateo Rossi", phone: "+54 9 11 4321-8890", internalNotes: "Cliente frecuente, prefiere turno de mañana." },
  { id: "c-lucas", name: "Lucas Gómez", phone: "+54 9 11 6120-4471" },
  { id: "c-julian", name: "Julián Pérez", phone: "+54 9 11 3988-2210" },
  { id: "c-santiago", name: "Santiago Díaz", phone: "+54 9 11 5877-0034", internalNotes: "Piel sensible." },
  { id: "c-martin", name: "Martín López", phone: "+54 9 11 4402-7715" },
];

const CLIENT_ID_BY_PHONE = new Map(
  [{ id: DEMO_CLIENT.id, phone: DEMO_CLIENT.phone }, ...WALK_IN_CLIENTS].map((c) => [phoneKey(c.phone), c.id]),
);

export function buildSeedClients(): ClientProfile[] {
  const created = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  return [
    {
      id: DEMO_CLIENT.id,
      name: DEMO_CLIENT.name,
      phone: DEMO_CLIENT.phone,
      email: DEMO_CLIENT.email,
      preferences: "Fade bien comprimido, largo arriba. Sin cera brillante.",
      notifications: { reminder24h: true, whatsapp: true },
      credit: 0,
      createdAt: created(180),
    },
    ...WALK_IN_CLIENTS.map((c, i) => ({
      ...c,
      notifications: { reminder24h: true, whatsapp: true },
      credit: 0,
      createdAt: created(120 - i * 15),
    })),
  ];
}

function nextOpenDay(from: string, offset: number): string {
  let day = addDays(from, offset);
  while (isSunday(day)) day = addDays(day, 1);
  return day;
}

/** Día hábil anterior (para historial). */
function pastOpenDay(from: string, daysBack: number): string {
  let day = addDays(from, -daysBack);
  while (isSunday(day)) day = addDays(day, -1);
  return day;
}

function product(id: string, qty = 1): AppointmentProduct {
  const p = seedProducts.find((x) => x.id === id)!;
  return { productId: p.id, name: p.name, unitPrice: p.price, qty };
}

interface SeedInput {
  id: string;
  clientName: string;
  clientPhone: string;
  clientId?: string;
  verified?: boolean;
  barberId: string;
  serviceId: string;
  date: string;
  time: string;
  notes?: string;
  depositMethod: PaymentMethod;
  depositPaid: boolean;
  products?: AppointmentProduct[];
  source?: Appointment["source"];
  /** Turno pasado ya cobrado. */
  completedWith?: PaymentMethod;
  cancelled?: boolean;
}

function appointment(input: SeedInput): Appointment {
  const service = seedServices.find((s) => s.id === input.serviceId)!;
  const { deposit, balance } = splitDeposit(service.price);
  const products = input.products ?? [];
  const productsTotal = products.reduce((n, p) => n + p.unitPrice * p.qty, 0);
  const stamp = `${input.date}T${input.time}:00`;
  return {
    id: input.id,
    clientId: input.clientId ?? CLIENT_ID_BY_PHONE.get(phoneKey(input.clientPhone)),
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    verified: input.verified ?? false,
    barberId: input.barberId,
    serviceId: service.id,
    serviceName: service.name,
    servicePrice: service.price,
    durationMin: service.durationMin,
    date: input.date,
    time: input.time,
    notes: input.notes,
    deposit: {
      amount: deposit,
      method: input.depositMethod,
      status: input.depositPaid ? "abonada" : "pendiente",
      paidAt: input.depositPaid ? new Date().toISOString() : undefined,
    },
    products: input.cancelled ? [] : products,
    status: input.cancelled ? "cancelado" : input.completedWith ? "completado" : "confirmado",
    balancePayment: input.completedWith
      ? { amount: balance + productsTotal, method: input.completedWith, paidAt: new Date(stamp).toISOString() }
      : undefined,
    cancelledAt: input.cancelled ? new Date(stamp).toISOString() : undefined,
    source: input.source ?? "app",
    createdAt: new Date().toISOString(),
  };
}

/** Datos demo relativos a la fecha actual para que la agenda siempre tenga contenido. */
export function buildSeedAppointments(): Appointment[] {
  const today = isSunday(todayISO()) ? nextOpenDay(todayISO(), 1) : todayISO();
  const clientDay = nextOpenDay(today, 2);

  const mateo = { clientName: "Mateo Rossi", clientPhone: "+54 9 11 4321-8890", verified: true };
  const lucas = { clientName: "Lucas Gómez", clientPhone: "+54 9 11 6120-4471" };
  const tomas = {
    clientId: DEMO_CLIENT.id,
    clientName: DEMO_CLIENT.name,
    clientPhone: DEMO_CLIENT.phone,
    verified: true,
  };

  return [
    // ── Hoy ──
    appointment({
      id: "a-mateo",
      ...mateo,
      barberId: "b-diego",
      serviceId: "s-signature",
      date: today,
      time: "10:30",
      notes: "Degradé bien alto, navaja con toalla tibia.",
      depositMethod: "efectivo",
      depositPaid: true,
    }),
    appointment({
      id: "a-lucas",
      ...lucas,
      barberId: "b-diego",
      serviceId: "s-tijera",
      date: today,
      time: "11:30",
      notes: "Sensibilidad en nuca al rasurar.",
      depositMethod: "mercadopago",
      depositPaid: true,
      products: [product("p-clay")],
    }),
    appointment({
      id: "a-julian",
      clientName: "Julián Pérez",
      clientPhone: "+54 9 11 3988-2210",
      barberId: "b-nico",
      serviceId: "s-barboterapia",
      date: today,
      time: "12:30",
      notes: "Primera visita, prefiere barba corta y prolija.",
      depositMethod: "efectivo",
      depositPaid: false,
    }),
    appointment({
      id: "a-santiago",
      clientName: "Santiago Díaz",
      clientPhone: "+54 9 11 5877-0034",
      verified: true,
      barberId: "b-nico",
      serviceId: "s-combo-barba",
      date: today,
      time: "15:30",
      notes: "Piel sensible: usar bálsamo sin alcohol.",
      depositMethod: "transferencia",
      depositPaid: true,
      products: [product("p-elixir")],
    }),
    appointment({
      id: "a-martin",
      clientName: "Martín López",
      clientPhone: "+54 9 11 4402-7715",
      barberId: "b-diego",
      serviceId: "s-skin-fade",
      date: today,
      time: "17:00",
      depositMethod: "mercadopago",
      depositPaid: true,
      source: "manual",
    }),
    // ── Próximo turno del cliente demo ──
    appointment({
      id: "a-demo-client",
      ...tomas,
      barberId: "b-diego",
      serviceId: "s-signature",
      date: clientDay,
      time: "11:00",
      notes: "Mantener largo arriba, fade bien comprimido.",
      depositMethod: "mercadopago",
      depositPaid: true,
    }),
    // ── Historial ──
    appointment({
      id: "a-hist-tomas-1",
      ...tomas,
      barberId: "b-diego",
      serviceId: "s-signature",
      date: pastOpenDay(today, 21),
      time: "18:00",
      notes: "Fade medio, nuca redondeada.",
      depositMethod: "mercadopago",
      depositPaid: true,
      products: [product("p-clay")],
      completedWith: "efectivo",
    }),
    appointment({
      id: "a-hist-tomas-2",
      ...tomas,
      barberId: "b-nico",
      serviceId: "s-combo-barba",
      date: pastOpenDay(today, 42),
      time: "12:00",
      depositMethod: "mercadopago",
      depositPaid: true,
      completedWith: "mercadopago",
    }),
    appointment({
      id: "a-hist-tomas-3",
      ...tomas,
      barberId: "b-diego",
      serviceId: "s-skin-fade",
      date: pastOpenDay(today, 56),
      time: "10:00",
      depositMethod: "transferencia",
      depositPaid: true,
      cancelled: true,
    }),
    appointment({
      id: "a-hist-mateo-1",
      ...mateo,
      barberId: "b-diego",
      serviceId: "s-signature",
      date: pastOpenDay(today, 14),
      time: "10:30",
      notes: "Degradé alto.",
      depositMethod: "efectivo",
      depositPaid: true,
      completedWith: "efectivo",
    }),
    appointment({
      id: "a-hist-lucas-1",
      ...lucas,
      barberId: "b-nico",
      serviceId: "s-tijera",
      date: pastOpenDay(today, 7),
      time: "16:00",
      depositMethod: "mercadopago",
      depositPaid: true,
      products: [product("p-shampoo")],
      completedWith: "transferencia",
    }),
    appointment({
      id: "a-hist-lucas-2",
      ...lucas,
      barberId: "b-diego",
      serviceId: "s-barboterapia",
      date: pastOpenDay(today, 1),
      time: "19:00",
      depositMethod: "efectivo",
      depositPaid: true,
      completedWith: "efectivo",
    }),
  ];
}

export function buildSeedBlocks(): TimeBlock[] {
  const today = isSunday(todayISO()) ? nextOpenDay(todayISO(), 1) : todayISO();
  return [
    {
      id: "blk-almuerzo",
      barberId: "b-diego",
      date: today,
      start: "13:00",
      end: "14:00",
      reason: "Almuerzo",
    },
  ];
}

export function buildSeedClosures(): CashClosure[] {
  const yesterday = pastOpenDay(todayISO(), 1);
  return [
    {
      id: "cc-ayer",
      date: yesterday,
      openedAt: "08:30",
      closedAt: new Date(`${yesterday}T20:15:00`).toISOString(),
      expectedCash: 7500,
      countedCash: 7500,
      digital: 0,
      total: 7500,
      notes: "Sin diferencias.",
    },
  ];
}
