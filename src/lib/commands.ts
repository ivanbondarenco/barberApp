/**
 * Reglas de negocio compartidas entre cliente (actualización optimista) y servidor (fuente de verdad).
 * Cada alta, baja o modificación es un `Command` que se aplica con `applyCommand`.
 */
import { fromISODate, hoursUntil, nowTime } from "./dates";
import { initials, phoneKey } from "./format";
import { CASH_DEPOSIT_DEADLINE_HOURS, FREE_CANCELLATION_HOURS, appointmentTotals, splitDeposit } from "./pricing";
import { buildSlots, cashDepositDeadline } from "./schedule";
import type {
  Appointment,
  Barber,
  BusinessHours,
  BusinessInfo,
  CashClosure,
  CashRegister,
  ClientProfile,
  DayHours,
  DepositSettings,
  PaymentMethod,
  Product,
  Service,
  TimeBlock,
} from "./types";

export interface DomainState {
  clients: ClientProfile[];
  barbers: Barber[];
  services: Service[];
  products: Product[];
  appointments: Appointment[];
  blocks: TimeBlock[];
  depositSettings: DepositSettings;
  cashRegister: CashRegister;
  cashClosures: CashClosure[];
  businessHours: BusinessHours;
  businessInfo: BusinessInfo;
}

export type Actor = { role: "admin" } | { role: "cliente"; clientId: string };

export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export interface BookPayload {
  id: string;
  /** Solo turnos manuales: id a usar si el cliente todavía no existe. */
  newClientId?: string;
  clientName: string;
  clientPhone: string;
  barberId: string;
  serviceId: string;
  date: string;
  time: string;
  notes?: string;
  depositMethod: PaymentMethod;
  depositPaid: boolean;
}

export interface AppointmentPatch {
  serviceId?: string;
  barberId?: string;
  date?: string;
  time?: string;
  notes?: string;
}

export type Command =
  | { type: "appointment.book"; payload: BookPayload }
  | { type: "appointment.update"; id: string; patch: AppointmentPatch }
  | { type: "appointment.cancel"; id: string }
  | { type: "appointment.delete"; id: string }
  | { type: "appointment.deposit"; id: string; method: PaymentMethod }
  | { type: "appointment.charge"; id: string; method: PaymentMethod }
  | { type: "appointment.addProduct"; id: string; productId: string }
  | { type: "appointment.removeProduct"; id: string; productId: string }
  | { type: "service.upsert"; service: Service }
  | { type: "service.delete"; id: string }
  | { type: "product.upsert"; product: Product }
  | { type: "product.delete"; id: string }
  | { type: "product.stock"; id: string; delta: number }
  | { type: "barber.upsert"; barber: Barber }
  | { type: "barber.delete"; id: string }
  | { type: "client.upsert"; client: ClientProfile }
  | { type: "client.delete"; id: string }
  | { type: "block.create"; block: TimeBlock }
  | { type: "block.delete"; id: string }
  | { type: "settings.deposit"; allowCash: boolean }
  | { type: "settings.hours"; dayIndex: number; patch: Partial<DayHours> }
  | { type: "settings.info"; patch: Partial<BusinessInfo> }
  | { type: "cash.open" }
  | { type: "cash.close"; closure: Omit<CashClosure, "openedAt" | "closedAt"> }
  | { type: "demo.reset" };

const ADMIN_ONLY = new Set<Command["type"]>([
  "appointment.delete",
  "appointment.charge",
  "service.upsert",
  "service.delete",
  "product.upsert",
  "product.delete",
  "product.stock",
  "barber.upsert",
  "barber.delete",
  "client.delete",
  "block.create",
  "block.delete",
  "settings.deposit",
  "settings.hours",
  "settings.info",
  "cash.open",
  "cash.close",
  "demo.reset",
]);

const fail = (message: string, status = 400): never => {
  throw new DomainError(message, status);
};

function replace<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

function ownAppointment(state: DomainState, actor: Actor, id: string): Appointment {
  const appointment = state.appointments.find((a) => a.id === id) ?? fail("El turno no existe", 404);
  if (actor.role === "cliente" && appointment.clientId !== actor.clientId) fail("No tenés permiso sobre este turno", 403);
  return appointment;
}

function assertSlot(
  state: DomainState,
  a: Pick<Appointment, "id" | "barberId" | "date" | "time" | "durationMin">,
  now: Date,
) {
  const free = buildSlots({
    date: a.date,
    barberId: a.barberId,
    durationMin: a.durationMin,
    appointments: state.appointments,
    blocks: state.blocks,
    hours: state.businessHours,
    excludeAppointmentId: a.id,
    now,
  }).some((s) => s.time === a.time && s.available);
  if (!free) fail("Ese horario ya no está disponible. Elegí otro.", 409);
}

const cleanText = (value: string | undefined, max: number) => value?.trim().slice(0, max) || undefined;

function validPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

function restoreStock(products: Product[], appointment: Appointment): Product[] {
  return products.map((p) => {
    const item = appointment.products.find((i) => i.productId === p.id);
    return item ? { ...p, stock: p.stock + item.qty } : p;
  });
}

const isUpcoming = (a: Appointment, now: Date) =>
  a.status === "confirmado" && hoursUntil(a.date, a.time, now) * 60 + a.durationMin > 0;

export function applyCommand(state: DomainState, command: Command, actor: Actor, now = new Date()): DomainState {
  if (actor.role !== "admin" && ADMIN_ONLY.has(command.type)) fail("Acción reservada al staff", 403);
  const stamp = now.toISOString();

  switch (command.type) {
    case "appointment.book": {
      const p = command.payload;
      if (state.appointments.some((a) => a.id === p.id)) fail("Turno duplicado", 409);
      const service = state.services.find((s) => s.id === p.serviceId && s.active) ?? fail("El servicio no está disponible");
      const barber = state.barbers.find((b) => b.id === p.barberId && b.active) ?? fail("El barbero no está disponible");
      const { deposit } = splitDeposit(service.price);

      let clients = state.clients;
      let client: ClientProfile;
      let depositPaid = p.depositPaid;
      const method = p.depositMethod;

      if (actor.role === "cliente") {
        client = clients.find((c) => c.id === actor.clientId) ?? fail("Perfil de cliente inexistente", 403);
        if (method === "efectivo") {
          if (!state.depositSettings.allowCash) fail("El local no acepta seña en efectivo");
          const deadline = cashDepositDeadline(p.date, p.time, state.businessHours, CASH_DEPOSIT_DEADLINE_HOURS);
          if (deadline.getTime() <= now.getTime()) fail("Ya pasó el plazo para la seña en efectivo");
          depositPaid = false;
        } else if (method === "credito") {
          if (client.credit < deposit) fail("Tu crédito no alcanza para cubrir la seña");
          depositPaid = true;
          clients = clients.map((c) => (c.id === client.id ? { ...c, credit: c.credit - deposit } : c));
        } else if (!depositPaid) {
          fail("La seña online debe estar abonada para confirmar");
        }
      } else {
        const name = p.clientName.trim();
        if (name.length < 2) fail("Ingresá el nombre del cliente");
        if (!validPhone(p.clientPhone)) fail("Teléfono inválido");
        if (method === "credito") fail("El crédito lo usa el cliente desde la app");
        const existing = clients.find((c) => phoneKey(c.phone) === phoneKey(p.clientPhone));
        if (existing) {
          client = existing;
        } else {
          client = {
            id: p.newClientId ?? fail("Falta el id del cliente nuevo"),
            name,
            phone: p.clientPhone.trim(),
            notifications: { reminder24h: true, whatsapp: true, promos: false },
            credit: 0,
            createdAt: stamp,
          };
          clients = [...clients, client];
        }
      }

      const appointment: Appointment = {
        id: p.id,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        verified: actor.role === "cliente" || !!client.hasAccount,
        barberId: barber.id,
        serviceId: service.id,
        serviceName: service.name,
        servicePrice: service.price,
        durationMin: service.durationMin,
        date: p.date,
        time: p.time,
        notes: cleanText(p.notes, 160),
        deposit: {
          amount: deposit,
          method,
          status: depositPaid ? "abonada" : "pendiente",
          paidAt: depositPaid ? stamp : undefined,
        },
        products: [],
        status: "confirmado",
        source: actor.role === "cliente" ? "app" : "manual",
        createdAt: stamp,
      };
      assertSlot(state, appointment, now);
      return { ...state, clients, appointments: [...state.appointments, appointment] };
    }

    case "appointment.update": {
      const current = ownAppointment(state, actor, command.id);
      if (current.status !== "confirmado") fail("Solo se pueden modificar turnos confirmados");
      const patch = command.patch;
      if (actor.role === "cliente") {
        if (patch.serviceId || patch.barberId || patch.notes !== undefined) fail("Solo podés cambiar la fecha y hora", 403);
        if (hoursUntil(current.date, current.time, now) < FREE_CANCELLATION_HOURS)
          fail(`Solo podés reprogramar hasta ${FREE_CANCELLATION_HOURS}h antes`);
      }
      const service = patch.serviceId
        ? state.services.find((s) => s.id === patch.serviceId) ?? fail("Servicio inexistente")
        : undefined;
      if (patch.barberId && !state.barbers.some((b) => b.id === patch.barberId && b.active)) fail("Barbero no disponible");

      const next: Appointment = {
        ...current,
        barberId: patch.barberId ?? current.barberId,
        date: patch.date ?? current.date,
        time: patch.time ?? current.time,
        notes: patch.notes !== undefined ? cleanText(patch.notes, 160) : current.notes,
        ...(service && service.id !== current.serviceId
          ? { serviceId: service.id, serviceName: service.name, servicePrice: service.price, durationMin: service.durationMin }
          : {}),
      };
      if (next.deposit.status === "pendiente") {
        next.deposit = { ...next.deposit, amount: splitDeposit(next.servicePrice).deposit };
      }
      const moved = next.date !== current.date || next.time !== current.time || next.barberId !== current.barberId;
      if (moved) assertSlot(state, next, now);
      // Mismo horario con otra duración (p. ej. un turno en curso): solo se controla que no se superponga.
      else if (next.durationMin !== current.durationMin) assertSlot(state, next, fromISODate(next.date));
      if (next.date !== current.date || next.time !== current.time) {
        next.rescheduledFrom = { date: current.date, time: current.time, at: stamp };
      }
      return { ...state, appointments: replace(state.appointments, next) };
    }

    case "appointment.cancel": {
      const current = ownAppointment(state, actor, command.id);
      if (current.status !== "confirmado") fail("El turno ya no está activo");
      const inWindow = actor.role === "admin" || hoursUntil(current.date, current.time, now) >= FREE_CANCELLATION_HOURS;
      const credit = inWindow && current.deposit.status === "abonada" ? current.deposit.amount : 0;
      return {
        ...state,
        products: restoreStock(state.products, current),
        clients: credit
          ? state.clients.map((c) => (c.id === current.clientId ? { ...c, credit: c.credit + credit } : c))
          : state.clients,
        appointments: replace(state.appointments, {
          ...current,
          status: "cancelado",
          products: [],
          cancelledAt: stamp,
          creditIssued: credit || undefined,
        }),
      };
    }

    case "appointment.delete": {
      const current = ownAppointment(state, actor, command.id);
      if (current.status === "completado") fail("Un turno cobrado no se puede eliminar");
      return {
        ...state,
        products: current.status === "confirmado" ? restoreStock(state.products, current) : state.products,
        appointments: state.appointments.filter((a) => a.id !== current.id),
      };
    }

    case "appointment.deposit": {
      const current = ownAppointment(state, actor, command.id);
      if (current.status !== "confirmado") fail("El turno no está activo");
      if (current.deposit.status === "abonada") fail("La seña ya está abonada");
      if (actor.role === "cliente" && command.method !== "mercadopago" && command.method !== "transferencia")
        fail("Medio de pago no válido");
      if (actor.role === "admin" && !state.cashRegister.open) fail("Abrí la caja para registrar cobros");
      return {
        ...state,
        appointments: replace(state.appointments, {
          ...current,
          deposit: {
            amount: splitDeposit(current.servicePrice).deposit,
            method: command.method,
            status: "abonada",
            paidAt: stamp,
          },
        }),
      };
    }

    case "appointment.charge": {
      const current = ownAppointment(state, actor, command.id);
      if (!state.cashRegister.open) fail("Abrí la caja para registrar cobros");
      if (current.status !== "confirmado") fail("El turno no está pendiente de cobro");
      const t = appointmentTotals(current);
      const deposit =
        current.deposit.status === "abonada"
          ? current.deposit
          : { amount: t.deposit, method: command.method, status: "abonada" as const, paidAt: stamp };
      return {
        ...state,
        appointments: replace(state.appointments, {
          ...current,
          status: "completado",
          deposit,
          balancePayment: {
            amount: Math.max(0, current.servicePrice - deposit.amount) + t.products,
            method: command.method,
            paidAt: stamp,
          },
        }),
      };
    }

    case "appointment.addProduct": {
      const current = ownAppointment(state, actor, command.id);
      if (current.status !== "confirmado") fail("El turno no está activo");
      const product = state.products.find((p) => p.id === command.productId && p.active) ?? fail("Producto no disponible");
      if (product.stock <= 0) fail("Sin stock disponible");
      const existing = current.products.find((i) => i.productId === product.id);
      const products = existing
        ? current.products.map((i) => (i.productId === product.id ? { ...i, qty: i.qty + 1 } : i))
        : [...current.products, { productId: product.id, name: product.name, unitPrice: product.price, qty: 1 }];
      return {
        ...state,
        products: state.products.map((p) => (p.id === product.id ? { ...p, stock: p.stock - 1 } : p)),
        appointments: replace(state.appointments, { ...current, products }),
      };
    }

    case "appointment.removeProduct": {
      const current = ownAppointment(state, actor, command.id);
      if (current.status !== "confirmado") fail("El turno no está activo");
      if (!current.products.some((i) => i.productId === command.productId)) return state;
      return {
        ...state,
        products: state.products.map((p) => (p.id === command.productId ? { ...p, stock: p.stock + 1 } : p)),
        appointments: replace(state.appointments, {
          ...current,
          products: current.products
            .map((i) => (i.productId === command.productId ? { ...i, qty: i.qty - 1 } : i))
            .filter((i) => i.qty > 0),
        }),
      };
    }

    case "service.upsert": {
      const s = command.service;
      if (s.name.trim().length < 3) fail("El nombre del servicio es muy corto");
      if (!Number.isInteger(s.price) || s.price < 500) fail("Precio inválido");
      if (!Number.isInteger(s.durationMin) || s.durationMin < 15 || s.durationMin > 240) fail("Duración inválida");
      return {
        ...state,
        services: replace(state.services, { ...s, name: s.name.trim(), description: s.description.trim() }),
      };
    }

    case "service.delete":
      return { ...state, services: state.services.filter((s) => s.id !== command.id) };

    case "product.upsert": {
      const p = command.product;
      if (p.name.trim().length < 3) fail("El nombre del producto es muy corto");
      if (!Number.isInteger(p.price) || p.price < 100) fail("Precio inválido");
      if (!Number.isInteger(p.stock) || p.stock < 0) fail("Stock inválido");
      return { ...state, products: replace(state.products, { ...p, name: p.name.trim() }) };
    }

    case "product.delete":
      return { ...state, products: state.products.filter((p) => p.id !== command.id) };

    case "product.stock":
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === command.id ? { ...p, stock: Math.max(0, p.stock + command.delta) } : p,
        ),
      };

    case "barber.upsert": {
      const b = command.barber;
      if (b.name.trim().length < 3) fail("Ingresá el nombre del barbero");
      if (!Number.isInteger(b.chair) || b.chair < 1) fail("Número de sillón inválido");
      if (state.barbers.some((x) => x.chair === b.chair && x.id !== b.id)) fail(`El sillón #${b.chair} ya está asignado`);
      return { ...state, barbers: replace(state.barbers, { ...b, name: b.name.trim(), initials: initials(b.name) }) };
    }

    case "barber.delete": {
      if (state.appointments.some((a) => a.barberId === command.id && isUpcoming(a, now)))
        fail("Tiene turnos próximos. Reasignalos o desactivá al barbero.");
      if (state.barbers.length <= 1) fail("Tiene que quedar al menos un barbero");
      return {
        ...state,
        barbers: state.barbers.filter((b) => b.id !== command.id),
        blocks: state.blocks.filter((b) => b.barberId !== command.id),
      };
    }

    case "client.upsert": {
      const c = command.client;
      if (actor.role === "cliente" && c.id !== actor.clientId) fail("No podés editar otro perfil", 403);
      if (c.name.trim().length < 2) fail("Ingresá el nombre");
      if (!validPhone(c.phone)) fail("Celular inválido");
      if (state.clients.some((x) => x.id !== c.id && phoneKey(x.phone) === phoneKey(c.phone)))
        fail("Ya existe un cliente con ese celular");
      const previous = state.clients.find((x) => x.id === c.id);
      if (actor.role === "cliente" && !previous) fail("Perfil inexistente", 404);

      const base = previous ?? { ...c, credit: 0, createdAt: stamp };
      const next: ClientProfile = {
        ...base,
        name: c.name.trim(),
        phone: c.phone.trim(),
        email: cleanText(c.email, 80),
        preferences: cleanText(c.preferences, 160),
        notifications: c.notifications ?? base.notifications,
        ...(actor.role === "admin" ? { internalNotes: cleanText(c.internalNotes, 240) } : {}),
      };
      const appointments = state.appointments.map((a) =>
        a.clientId === next.id ? { ...a, clientName: next.name, clientPhone: next.phone } : a,
      );
      return { ...state, clients: replace(state.clients, next), appointments };
    }

    case "client.delete": {
      if (state.appointments.some((a) => a.clientId === command.id && isUpcoming(a, now)))
        fail("El cliente tiene turnos próximos. Cancelalos antes de eliminarlo.");
      return {
        ...state,
        clients: state.clients.filter((c) => c.id !== command.id),
        appointments: state.appointments.map((a) => (a.clientId === command.id ? { ...a, clientId: undefined } : a)),
      };
    }

    case "block.create": {
      const b = command.block;
      if (b.end <= b.start) fail("La hora de fin debe ser posterior al inicio");
      if (!b.reason.trim()) fail("Indicá un motivo");
      return { ...state, blocks: replace(state.blocks, b) };
    }

    case "block.delete":
      return { ...state, blocks: state.blocks.filter((b) => b.id !== command.id) };

    case "settings.deposit":
      return { ...state, depositSettings: { allowCash: command.allowCash } };

    case "settings.hours": {
      const day = state.businessHours[command.dayIndex] ?? fail("Día inválido");
      const merged = { ...day, ...command.patch };
      if (merged.close <= merged.open) fail("El cierre debe ser después de la apertura");
      return { ...state, businessHours: state.businessHours.map((d, i) => (i === command.dayIndex ? merged : d)) };
    }

    case "settings.info":
      return { ...state, businessInfo: { ...state.businessInfo, ...command.patch } };

    case "cash.open":
      return state.cashRegister.open ? state : { ...state, cashRegister: { open: true, openedAt: nowTime() } };

    case "cash.close":
      if (!state.cashRegister.open) fail("La caja ya está cerrada");
      return {
        ...state,
        cashRegister: { open: false },
        cashClosures: [
          { ...command.closure, openedAt: state.cashRegister.openedAt, closedAt: stamp },
          ...state.cashClosures,
        ],
      };

    case "demo.reset":
      // El servidor regenera los datos; en el cliente no hay cambio optimista.
      return state;
  }
}

