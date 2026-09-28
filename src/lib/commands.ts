/**
 * Reglas de negocio compartidas entre cliente (actualización optimista) y servidor (fuente de verdad).
 * Cada alta, baja o modificación es un `Command` que se aplica con `applyCommand`.
 */
import { fromISODate, hoursUntil } from "./dates";
import { initials, phoneKey } from "./format";
import {
  CASH_DEPOSIT_DEADLINE_HOURS,
  FREE_CANCELLATION_HOURS,
  HOLD_MINUTES,
  appointmentTotals,
  isDepositPaid,
  isValidDepositRate,
  NO_SHOW_DEPOSIT_LIMIT,
  noShowCount,
  splitDeposit,
} from "./pricing";
import { buildSlots, cashDepositDeadline, CLIENT_BOOKING_DAYS, withinClientWindow } from "./schedule";
import type {
  Appointment,
  Barber,
  BusinessHours,
  BusinessInfo,
  ClientProfile,
  DayHours,
  DepositSettings,
  PaymentMethod,
  IntegrationSettings,
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
  businessHours: BusinessHours;
  businessInfo: BusinessInfo;
  integrations: IntegrationSettings;
}

/**
 * Quién ejecuta el comando.
 * - `admin`: dueño del local, puede todo.
 * - `barbero`: solo su propia agenda; no toca catálogo, equipo ni configuración.
 * - `cliente`: solo lo propio, y únicamente los comandos de `CLIENT_COMMANDS`.
 * - `sistema`: webhook de la pasarela. Es el ÚNICO que puede acreditar un pago online.
 */
export type Actor =
  | { role: "admin"; shopId: string }
  | { role: "barbero"; shopId: string; barberId: string }
  | { role: "cliente"; shopId: string; clientId: string }
  | { role: "sistema"; shopId: string };

const isStaffActor = (actor: Actor): boolean => actor.role === "admin" || actor.role === "barbero";

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
  /**
   * Solo staff: ficha ya existente elegida del buscador. Manda sobre `clientName`/`clientPhone`.
   */
  clientId?: string;
  clientName: string;
  /**
   * Vacío solo en un turno manual "sin app": queda como recordatorio en la agenda, sin ficha
   * en el CRM ni recordatorios por WhatsApp.
   */
  clientPhone: string;
  barberId: string;
  serviceId: string;
  date: string;
  time: string;
  notes?: string;
  depositMethod: PaymentMethod;
  /**
   * Solo staff: la seña ya se cobró en el mostrador al agendar.
   * Para el cliente se ignora siempre — la acreditación la decide el servidor
   * (webhook de la pasarela, staff con el comprobante a la vista, o crédito a favor).
   */
  depositPaid?: boolean;
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
  | { type: "appointment.deposit"; id: string; method: PaymentMethod; reference?: string }
  | { type: "appointment.declareTransfer"; id: string; reference?: string }
  | { type: "appointment.rejectDeposit"; id: string }
  | { type: "appointment.noShow"; id: string }
  | { type: "appointment.reminderSent"; id: string }
  | { type: "appointment.rate"; id: string; rating: number }
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
  | { type: "settings.deposit"; allowCash?: boolean; rate?: number }
  | { type: "settings.hours"; dayIndex: number; patch: Partial<DayHours> }
  | { type: "settings.info"; patch: Partial<BusinessInfo> }
  | { type: "demo.reset" };

const fail = (message: string, status = 400): never => {
  throw new DomainError(message, status);
};

/** Lo único que puede pedir un cliente. Todo lo demás se le niega por defecto. */
const CLIENT_COMMANDS = new Set<Command["type"]>([
  "appointment.book",
  "appointment.update",
  "appointment.cancel",
  "appointment.declareTransfer",
  // Califica el turno que ya le hicieron.
  "appointment.rate",
  // Arma su pedido de la tienda para retirar en el sillón, sobre su propio turno.
  "appointment.addProduct",
  "appointment.removeProduct",
  "client.upsert",
]);

/** Reservado al dueño: catálogo, equipo y configuración del local. */
const OWNER_COMMANDS = new Set<Command["type"]>([
  "service.upsert",
  "service.delete",
  "product.upsert",
  "product.delete",
  "product.stock",
  "barber.upsert",
  "barber.delete",
  "client.delete",
  "settings.deposit",
  "settings.hours",
  "settings.info",
  "demo.reset",
]);

/** El webhook de la pasarela solo acredita señas; no puede hacer nada más. */
const SYSTEM_COMMANDS = new Set<Command["type"]>(["appointment.deposit"]);

function assertAllowed(actor: Actor, type: Command["type"]) {
  if (actor.role === "admin") return;
  if (actor.role === "sistema") {
    if (!SYSTEM_COMMANDS.has(type)) fail("Acción no permitida", 403);
    return;
  }
  if (actor.role === "barbero") {
    if (OWNER_COMMANDS.has(type)) fail("Acción reservada al dueño del local", 403);
    return;
  }
  if (!CLIENT_COMMANDS.has(type)) fail("Acción reservada al staff", 403);
}

function replace<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

function ownAppointment(state: DomainState, actor: Actor, id: string): Appointment {
  const appointment = state.appointments.find((a) => a.id === id) ?? fail("El turno no existe", 404);
  if (actor.role === "cliente" && appointment.clientId !== actor.clientId) fail("No tenés permiso sobre este turno", 403);
  if (actor.role === "barbero" && appointment.barberId !== actor.barberId)
    fail("Ese turno es de otro barbero", 403);
  return appointment;
}

/** Un barbero solo agenda y bloquea sobre su propio sillón. */
function assertOwnChair(actor: Actor, barberId: string) {
  if (actor.role === "barbero" && barberId !== actor.barberId) fail("Solo podés operar sobre tu agenda", 403);
}

/**
 * Libera las reservas digitales que vencieron sin acreditarse.
 * Corre al principio de cada comando, así el horario se devuelve solo, sin cron ni barrido externo.
 */
export function releaseExpiredHolds(state: DomainState, now: Date): DomainState {
  const stamp = now.toISOString();
  const expired = state.appointments.filter(
    (a) => a.status === "confirmado" && a.holdUntil !== undefined && a.holdUntil <= stamp,
  );
  if (!expired.length) return state;

  let products = state.products;
  for (const a of expired) products = restoreStock(products, a);
  const ids = new Set(expired.map((a) => a.id));
  return {
    ...state,
    products,
    appointments: state.appointments.map((a) =>
      ids.has(a.id)
        ? { ...a, status: "cancelado" as const, products: [], cancelledAt: stamp, holdExpired: true, holdUntil: undefined }
        : a,
    ),
  };
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

/**
 * El cliente reserva hasta dos semanas por adelantado; el staff, cuando quiera.
 * Vive acá (y no solo en la pantalla) para que también la respete quien llame a la API.
 */
function assertClientWindow(date: string, now: Date) {
  if (!withinClientWindow(date, now))
    fail(`Podés reservar hasta ${CLIENT_BOOKING_DAYS / 7} semanas por adelantado. Para una fecha más lejana, escribinos.`);
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
  assertAllowed(actor, command.type);
  state = releaseExpiredHolds(state, now);
  const stamp = now.toISOString();

  switch (command.type) {
    case "appointment.book": {
      const p = command.payload;
      if (state.appointments.some((a) => a.id === p.id)) fail("Turno duplicado", 409);
      const service = state.services.find((s) => s.id === p.serviceId && s.active) ?? fail("El servicio no está disponible");
      const barber = state.barbers.find((b) => b.id === p.barberId && b.active) ?? fail("El barbero no está disponible");
      const { deposit } = splitDeposit(service.price, state.depositSettings.rate);

      assertOwnChair(actor, barber.id);

      let clients = state.clients;
      /** Ficha del cliente. Queda sin definir en un turno manual sin app. */
      let client: ClientProfile | undefined;
      /** Turno sin ficha: solo el nombre que dictó el cliente en el mostrador. */
      let walkIn: { name: string } | undefined;
      // El cliente nunca decide si pagó: arranca en `pendiente` salvo que el crédito lo cubra.
      let depositPaid = false;
      let holdUntil: string | undefined;
      const method = p.depositMethod;

      if (actor.role === "cliente") {
        const self = clients.find((c) => c.id === actor.clientId) ?? fail("Perfil de cliente inexistente", 403);
        client = self;
        assertClientWindow(p.date, now);
        if (deposit === 0) {
          // El local no pide seña: no hay nada que acreditar ni horario que retener.
          depositPaid = true;
        } else if (method === "efectivo") {
          if (!state.depositSettings.allowCash) fail("El local no acepta seña en efectivo");
          // Quien ya faltó sin avisar reserva pagando por adelantado: es la política publicada.
          if (noShowCount(state.appointments, self.id) >= NO_SHOW_DEPOSIT_LIMIT)
            fail("Por ausencias anteriores, este local te pide abonar la seña por adelantado");
          const deadline = cashDepositDeadline(p.date, p.time, state.businessHours, CASH_DEPOSIT_DEADLINE_HOURS);
          if (deadline.getTime() <= now.getTime()) fail("Ya pasó el plazo para la seña en efectivo");
        } else if (method === "credito") {
          // Único caso en que el turno nace pago: el crédito se verifica y se descuenta acá.
          if (self.credit < deposit) fail("Tu crédito no alcanza para cubrir la seña");
          depositPaid = true;
          clients = clients.map((c) => (c.id === self.id ? { ...c, credit: c.credit - deposit } : c));
        } else {
          if (method === "mercadopago" && !state.integrations.mercadopagoReady)
            fail("El pago online no está disponible. Elegí otro medio.");
          // Retiene el horario mientras paga; si no se acredita, se libera solo.
          holdUntil = new Date(now.getTime() + HOLD_MINUTES * 60_000).toISOString();
        }
      } else {
        if (method === "credito") fail("El crédito lo usa el cliente desde la app");
        // El staff sí puede marcarla cobrada: tiene la plata o el comprobante delante.
        // Con seña 0 no hay nada que cobrar, así que queda saldada sola.
        depositPaid = deposit === 0 || p.depositPaid === true;
        const name = p.clientName.trim();
        const phone = p.clientPhone.trim();
        if (p.clientId) {
          // Ficha elegida del buscador: el nombre y el teléfono salen de ella.
          client = clients.find((c) => c.id === p.clientId) ?? fail("El cliente no existe", 404);
        } else if (!phone) {
          // Cliente sin app: solo para organizar la agenda, no se abre ficha en el CRM.
          if (name.length < 2) fail("Ingresá el nombre del cliente");
          walkIn = { name };
        } else {
          if (name.length < 2) fail("Ingresá el nombre del cliente");
          if (!validPhone(phone)) fail("Teléfono inválido");
          const existing = clients.find((c) => phoneKey(c.phone) === phoneKey(phone));
          if (existing) {
            client = existing;
          } else {
            client = {
              id: p.newClientId ?? fail("Falta el id del cliente nuevo"),
              name,
              phone,
              notifications: { reminder24h: true, whatsapp: true },
              credit: 0,
              createdAt: stamp,
            };
            clients = [...clients, client];
          }
        }
      }

      const appointment: Appointment = {
        id: p.id,
        clientId: client?.id,
        clientName: client?.name ?? walkIn?.name ?? fail("Falta el cliente del turno"),
        clientPhone: client?.phone ?? "",
        verified: actor.role === "cliente" || !!client?.hasAccount,
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
        ...(holdUntil ? { holdUntil } : {}),
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
        if (patch.date) assertClientWindow(patch.date, now);
      }
      const service = patch.serviceId
        ? state.services.find((s) => s.id === patch.serviceId) ?? fail("Servicio inexistente")
        : undefined;
      if (patch.barberId && !state.barbers.some((b) => b.id === patch.barberId && b.active)) fail("Barbero no disponible");
      if (patch.barberId) assertOwnChair(actor, patch.barberId);

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
        next.deposit = { ...next.deposit, amount: splitDeposit(next.servicePrice, state.depositSettings.rate).deposit };
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
      // El staff puede cancelar sin cargo en cualquier momento; el cliente, hasta el plazo libre.
      const inWindow = isStaffActor(actor) || hoursUntil(current.date, current.time, now) >= FREE_CANCELLATION_HOURS;
      // Solo vuelve como crédito la plata efectivamente acreditada: `en_revision` no entró todavía.
      const credit = inWindow && isDepositPaid(current.deposit) ? current.deposit.amount : 0;
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
          holdUntil: undefined,
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

    /**
     * Acredita la seña. Inalcanzable para el cliente (no está en `CLIENT_COMMANDS`):
     * la plata la confirma el webhook de la pasarela (`sistema`) o el staff con el comprobante.
     */
    case "appointment.deposit": {
      const current = ownAppointment(state, actor, command.id);
      if (current.status !== "confirmado") fail("El turno no está activo");
      if (isDepositPaid(current.deposit)) fail("La seña ya está abonada");
      return {
        ...state,
        appointments: replace(state.appointments, {
          ...current,
          deposit: {
            amount: splitDeposit(current.servicePrice, state.depositSettings.rate).deposit,
            method: command.method,
            status: "abonada",
            paidAt: stamp,
            declaredAt: current.deposit.declaredAt,
            reference: command.reference ?? current.deposit.reference,
          },
          holdUntil: undefined,
        }),
      };
    }

    /**
     * El cliente avisa que transfirió. No acredita nada: deja la seña `en_revision`
     * y mantiene el horario hasta que el staff vea el comprobante.
     */
    case "appointment.declareTransfer": {
      const current = ownAppointment(state, actor, command.id);
      if (current.status !== "confirmado") fail("El turno no está activo");
      if (isDepositPaid(current.deposit)) fail("La seña ya está abonada");
      if (current.deposit.status === "en_revision") fail("Ya avisaste de esta transferencia");
      return {
        ...state,
        appointments: replace(state.appointments, {
          ...current,
          deposit: {
            ...current.deposit,
            amount: splitDeposit(current.servicePrice, state.depositSettings.rate).deposit,
            method: "transferencia",
            status: "en_revision",
            declaredAt: stamp,
            reference: cleanText(command.reference, 40),
          },
          holdUntil: undefined,
        }),
      };
    }

    /** El staff no encontró la transferencia: vuelve a pendiente y se reanuda el plazo. */
    case "appointment.rejectDeposit": {
      const current = ownAppointment(state, actor, command.id);
      if (current.deposit.status !== "en_revision") fail("No hay una transferencia para revisar");
      return {
        ...state,
        appointments: replace(state.appointments, {
          ...current,
          deposit: { ...current.deposit, status: "pendiente", declaredAt: undefined, reference: undefined },
        }),
      };
    }

    /**
     * El cliente no se presentó. La seña queda para el local: no genera crédito.
     * Para perdonar la ausencia, el staff cancela en vez de marcar ausente.
     */
    case "appointment.noShow": {
      const current = ownAppointment(state, actor, command.id);
      if (current.status !== "confirmado") fail("El turno no está activo");
      if (hoursUntil(current.date, current.time, now) > 0) fail("El turno todavía no empezó");
      const forfeited = isDepositPaid(current.deposit) ? current.deposit.amount : 0;
      return {
        ...state,
        products: restoreStock(state.products, current),
        appointments: replace(state.appointments, {
          ...current,
          status: "no_show",
          products: [],
          noShowAt: stamp,
          depositForfeited: forfeited || undefined,
          holdUntil: undefined,
        }),
      };
    }

    /** Reseña del cliente sobre un turno terminado. Es lo único que mueve el rating del barbero. */
    case "appointment.rate": {
      // Solo el cliente. Si el staff pudiera calificar, la barbería se pondría cinco estrellas
      // sola y el número dejaría de significar algo para quien lo lee.
      if (actor.role !== "cliente") fail("Solo el cliente puede calificar su turno", 403);
      const current = ownAppointment(state, actor, command.id);
      if (current.status !== "completado") fail("Solo podés calificar un turno que ya te hicieron");
      if (current.rating) fail("Ya calificaste este turno");
      if (!Number.isInteger(command.rating) || command.rating < 1 || command.rating > 5)
        fail("La calificación va de 1 a 5");
      return {
        ...state,
        appointments: replace(state.appointments, { ...current, rating: command.rating }),
      };
    }

    case "appointment.reminderSent": {
      const current = ownAppointment(state, actor, command.id);
      return {
        ...state,
        appointments: replace(state.appointments, { ...current, reminderSentAt: stamp }),
      };
    }

    case "appointment.charge": {
      const current = ownAppointment(state, actor, command.id);
      if (current.status !== "confirmado") fail("El turno no está pendiente de cobro");
      const t = appointmentTotals(current);
      // Si la seña no se había acreditado (pendiente o en revisión), se cobra entera en el sillón.
      const deposit = isDepositPaid(current.deposit)
        ? current.deposit
        : { amount: t.deposit, method: command.method, status: "abonada" as const, paidAt: stamp };
      return {
        ...state,
        appointments: replace(state.appointments, {
          ...current,
          status: "completado",
          deposit,
          holdUntil: undefined,
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
        ...(isStaffActor(actor) ? { internalNotes: cleanText(c.internalNotes, 240) } : {}),
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
      assertOwnChair(actor, b.barberId);
      return { ...state, blocks: replace(state.blocks, b) };
    }

    case "block.delete": {
      const block = state.blocks.find((b) => b.id === command.id);
      if (block) assertOwnChair(actor, block.barberId);
      return { ...state, blocks: state.blocks.filter((b) => b.id !== command.id) };
    }

    case "settings.deposit": {
      const next = { ...state.depositSettings };
      if (command.allowCash !== undefined) next.allowCash = command.allowCash;
      if (command.rate !== undefined) {
        if (!isValidDepositRate(command.rate)) fail("La seña tiene que estar entre 0% y 100%");
        next.rate = command.rate;
      }
      return { ...state, depositSettings: next };
    }

    case "settings.hours": {
      const day = state.businessHours[command.dayIndex] ?? fail("Día inválido");
      const merged = { ...day, ...command.patch };
      if (merged.close <= merged.open) fail("El cierre debe ser después de la apertura");
      return { ...state, businessHours: state.businessHours.map((d, i) => (i === command.dayIndex ? merged : d)) };
    }

    case "settings.info": {
      const patch = { ...command.patch };
      if (patch.name !== undefined) {
        // El nombre es con lo que el local aparece ante sus clientes: no puede quedar vacío.
        patch.name = patch.name.trim();
        if (patch.name.length < 3) fail("Ingresá el nombre de la barbería");
      }
      return { ...state, businessInfo: { ...state.businessInfo, ...patch } };
    }

    case "demo.reset":
      // El servidor regenera los datos; en el cliente no hay cambio optimista.
      return state;
  }
}

