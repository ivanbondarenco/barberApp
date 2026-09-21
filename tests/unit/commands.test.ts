import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCommand, DomainError, type Command, type DomainState } from "@/lib/commands";
import { HOLD_MINUTES } from "@/lib/pricing";
import { admin, barberNico, barberOther, bookPayload, demoClient, freezeTime, MONDAY_9AM, otherClient, seedState, system, TODAY, TUESDAY, WEDNESDAY } from "./support/fixtures";

let state: DomainState;

beforeEach(() => {
  freezeTime();
  state = seedState();
});
afterEach(() => vi.useRealTimers());

const run = (command: Command, actor = admin, s = state, now = MONDAY_9AM) => applyCommand(s, command, actor, now);

function expectError(fn: () => unknown, message: RegExp, status?: number) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).message).toMatch(message);
    if (status) expect((error as DomainError).status).toBe(status);
    return;
  }
  throw new Error(`Se esperaba un error: ${message}`);
}

const find = (s: DomainState, id: string) => s.appointments.find((a) => a.id === id)!;

describe("reserva del cliente", () => {
  it("crea el turno con la seña del 50% pendiente y reserva el horario mientras paga", () => {
    const next = run({ type: "appointment.book", payload: bookPayload({ clientName: "Otro nombre" }) }, demoClient);
    const a = find(next, "a-test");
    expect(a).toMatchObject({ clientId: "c-demo", clientName: "Tomás Ferreyra", servicePrice: 9500, durationMin: 30, source: "app", status: "confirmado" });
    // Nace pendiente: la acredita el webhook, nunca el navegador.
    expect(a.deposit).toMatchObject({ amount: 4750, status: "pendiente", method: "mercadopago" });
    expect(a.holdUntil).toBe(new Date(MONDAY_9AM.getTime() + HOLD_MINUTES * 60_000).toISOString());
  });

  it("el cliente no puede declararse la seña como pagada", () => {
    // Aunque mande depositPaid: true, el servidor lo ignora.
    const next = run({ type: "appointment.book", payload: bookPayload({ depositPaid: true }) }, demoClient);
    expect(find(next, "a-test").deposit.status).toBe("pendiente");
    // Y tampoco puede acreditarla después: `appointment.deposit` no es un comando de cliente.
    expectError(() => run({ type: "appointment.deposit", id: "a-test", method: "mercadopago" }, demoClient, next), /reservada al staff/, 403);
  });

  it("sin Mercado Pago configurado no ofrece el pago online", () => {
    const offline = { ...state, integrations: { ...state.integrations, mercadopagoReady: false } };
    expectError(() => run({ type: "appointment.book", payload: bookPayload() }, demoClient, offline), /no está disponible/);
    // La transferencia sigue disponible: no depende de la pasarela.
    expect(find(run({ type: "appointment.book", payload: bookPayload({ depositMethod: "transferencia" }) }, demoClient, offline), "a-test").deposit.method).toBe("transferencia");
  });

  it("seña en efectivo queda pendiente y respeta el plazo y la configuración", () => {
    const next = run({ type: "appointment.book", payload: bookPayload({ depositMethod: "efectivo", depositPaid: true }) }, demoClient);
    expect(find(next, "a-test").deposit.status).toBe("pendiente");

    expectError(
      () => run({ type: "appointment.book", payload: bookPayload({ depositMethod: "efectivo", date: TODAY, time: "11:00" }) }, demoClient),
      /plazo/,
    );
    const noCash = { ...state, depositSettings: { allowCash: false, rate: 0.5 } };
    expectError(() => run({ type: "appointment.book", payload: bookPayload({ depositMethod: "efectivo" }) }, demoClient, noCash), /efectivo/);
  });

  it("usa el crédito a favor como seña y lo descuenta", () => {
    const withCredit = { ...state, clients: state.clients.map((c) => (c.id === "c-demo" ? { ...c, credit: 6000 } : c)) };
    const next = run({ type: "appointment.book", payload: bookPayload({ depositMethod: "credito", depositPaid: false }) }, demoClient, withCredit);
    expect(find(next, "a-test").deposit.status).toBe("abonada");
    expect(next.clients.find((c) => c.id === "c-demo")?.credit).toBe(6000 - 4750);

    expectError(() => run({ type: "appointment.book", payload: bookPayload({ depositMethod: "credito" }) }, demoClient), /crédito no alcanza/);
  });

  it("rechaza horarios ocupados, bloqueados o fuera de horario", () => {
    // Diego tiene turno el miércoles 11:00 (45 min)
    expectError(() => run({ type: "appointment.book", payload: bookPayload({ barberId: "b-diego", time: "11:00" }) }, demoClient), /no está disponible/, 409);
    // Diego almuerza hoy 13 a 14
    expectError(() => run({ type: "appointment.book", payload: bookPayload({ barberId: "b-diego", date: TODAY, time: "13:00" }) }, demoClient), /no está disponible/);
    expectError(() => run({ type: "appointment.book", payload: bookPayload({ date: "2026-09-20" }) }, demoClient), /no está disponible/);
    expectError(() => run({ type: "appointment.book", payload: bookPayload({ time: "19:45" }) }, demoClient), /no está disponible/);
  });

  it("rechaza servicios o barberos inactivos e ids duplicados", () => {
    const inactive = { ...state, services: state.services.map((s) => ({ ...s, active: false })) };
    expectError(() => run({ type: "appointment.book", payload: bookPayload() }, demoClient, inactive), /servicio no está disponible/);
    const noBarber = { ...state, barbers: state.barbers.map((b) => ({ ...b, active: false })) };
    expectError(() => run({ type: "appointment.book", payload: bookPayload() }, demoClient, noBarber), /barbero no está disponible/);
    expectError(() => run({ type: "appointment.book", payload: bookPayload({ id: "a-mateo" }) }, demoClient), /duplicado/);
  });
});

describe("turno manual (staff)", () => {
  it("crea la ficha del cliente si el celular es nuevo", () => {
    const next = run({ type: "appointment.book", payload: bookPayload({ clientName: "Walk In", clientPhone: "+54 9 11 1234 5678", depositPaid: false, depositMethod: "efectivo" }) });
    expect(next.clients.find((c) => c.id === "c-new")).toMatchObject({ name: "Walk In", credit: 0 });
    expect(find(next, "a-test")).toMatchObject({ clientId: "c-new", source: "manual" });
  });

  it("reutiliza el cliente existente por celular aunque cambie el formato", () => {
    const next = run({ type: "appointment.book", payload: bookPayload({ clientName: "Mateo", clientPhone: "1143218890" }) });
    expect(find(next, "a-test").clientId).toBe("c-mateo");
    expect(next.clients).toHaveLength(state.clients.length);
  });

  it("valida nombre, teléfono y no permite crédito", () => {
    expectError(() => run({ type: "appointment.book", payload: bookPayload({ clientName: "A" }) }), /nombre/);
    expectError(() => run({ type: "appointment.book", payload: bookPayload({ clientPhone: "123" }) }), /Teléfono/);
    expectError(() => run({ type: "appointment.book", payload: bookPayload({ depositMethod: "credito" }) }), /crédito/);
  });
});

describe("permisos", () => {
  const adminOnly: Command[] = [
    { type: "service.delete", id: "s-tijera" },
    { type: "appointment.charge", id: "a-demo-client", method: "efectivo" },
    { type: "client.delete", id: "c-mateo" },
    { type: "cash.open" },
    { type: "settings.deposit", allowCash: false },
    { type: "demo.reset" },
  ];

  it.each(adminOnly)("el cliente no puede ejecutar $type", (command) => {
    expectError(() => run(command, demoClient), /reservada al staff/, 403);
  });

  it("un cliente no puede tocar turnos ni perfiles ajenos", () => {
    expectError(() => run({ type: "appointment.cancel", id: "a-demo-client" }, otherClient), /permiso/, 403);
    const profile = state.clients.find((c) => c.id === "c-demo")!;
    expectError(() => run({ type: "client.upsert", client: profile }, otherClient), /otro perfil/, 403);
  });
});

describe("modificación de turnos", () => {
  it("el cliente reprograma solo fecha y hora, con registro del cambio", () => {
    const next = run({ type: "appointment.update", id: "a-demo-client", patch: { date: WEDNESDAY, time: "15:00" } }, demoClient);
    expect(find(next, "a-demo-client")).toMatchObject({ time: "15:00", rescheduledFrom: { date: WEDNESDAY, time: "11:00" } });
    expectError(() => run({ type: "appointment.update", id: "a-demo-client", patch: { serviceId: "s-tijera" } }, demoClient), /fecha y hora/);
  });

  it("no se reprograma con menos de 3 horas", () => {
    const late = new Date(2026, 8, 16, 9, 30);
    expectError(() => run({ type: "appointment.update", id: "a-demo-client", patch: { time: "15:00" } }, demoClient, state, late), /3h antes/);
  });

  it("el staff cambia servicio y barbero: recalcula precio y seña pendiente", () => {
    const next = run({ type: "appointment.update", id: "a-julian", patch: { serviceId: "s-combo-barba", barberId: "b-nico", time: "12:30" } });
    const a = find(next, "a-julian");
    expect(a).toMatchObject({ serviceName: "Combo Corte + Barba Clásica", servicePrice: 16000, durationMin: 60 });
    expect(a.deposit).toMatchObject({ status: "pendiente", amount: 8000 });
  });

  it("no mueve un turno a un horario ocupado", () => {
    expectError(() => run({ type: "appointment.update", id: "a-lucas", patch: { time: "10:30" } }), /no está disponible/);
  });
});

describe("cancelación y crédito", () => {
  it("con 3 h o más de anticipación la seña queda como crédito y vuelve el stock", () => {
    const withProduct = run({ type: "appointment.addProduct", id: "a-demo-client", productId: "p-elixir" }, demoClient);
    expect(withProduct.products.find((p) => p.id === "p-elixir")?.stock).toBe(2);
    const next = run({ type: "appointment.cancel", id: "a-demo-client" }, demoClient, withProduct);
    const a = find(next, "a-demo-client");
    expect(a).toMatchObject({ status: "cancelado", creditIssued: 6000, products: [] });
    expect(next.clients.find((c) => c.id === "c-demo")?.credit).toBe(6000);
    expect(next.products.find((p) => p.id === "p-elixir")?.stock).toBe(3);
  });

  it("con menos de 3 h no genera crédito", () => {
    const late = new Date(2026, 8, 16, 9, 0);
    const next = run({ type: "appointment.cancel", id: "a-demo-client" }, demoClient, state, late);
    expect(find(next, "a-demo-client").creditIssued).toBeUndefined();
    expect(next.clients.find((c) => c.id === "c-demo")?.credit).toBe(0);
  });

  it("cancelado por el local siempre deja la seña como crédito", () => {
    const late = new Date(2026, 8, 16, 10, 50);
    const next = run({ type: "appointment.cancel", id: "a-demo-client" }, admin, state, late);
    expect(find(next, "a-demo-client").creditIssued).toBe(6000);
  });

  it("solo se eliminan turnos no cobrados", () => {
    const charged = run({ type: "appointment.charge", id: "a-mateo", method: "efectivo" });
    expectError(() => run({ type: "appointment.delete", id: "a-mateo" }, admin, charged), /cobrado/);
    expect(run({ type: "appointment.delete", id: "a-julian" }).appointments.some((a) => a.id === "a-julian")).toBe(false);
  });
});

describe("cobros", () => {
  it("cobra el saldo con productos y marca el turno como completado", () => {
    const withProduct = run({ type: "appointment.addProduct", id: "a-mateo", productId: "p-clay" });
    const next = run({ type: "appointment.charge", id: "a-mateo", method: "mercadopago" }, admin, withProduct);
    expect(find(next, "a-mateo")).toMatchObject({ status: "completado", balancePayment: { amount: 6000 + 9800, method: "mercadopago" } });
  });

  it("si la seña estaba pendiente cobra el total", () => {
    const next = run({ type: "appointment.charge", id: "a-julian", method: "efectivo" });
    expect(find(next, "a-julian").deposit.status).toBe("abonada");
    expect(find(next, "a-julian").balancePayment?.amount).toBe(3750);
    expect(find(next, "a-julian").deposit.amount + (find(next, "a-julian").balancePayment?.amount ?? 0)).toBe(7500);
  });

  it("sin caja abierta no se cobra", () => {
    const closed = { ...state, cashRegister: { open: false } };
    expectError(() => run({ type: "appointment.charge", id: "a-mateo", method: "efectivo" }, admin, closed), /caja/);
    expectError(() => run({ type: "appointment.deposit", id: "a-julian", method: "efectivo" }, admin, closed), /caja/);
  });

  it("la transferencia que declara el cliente queda en revisión, no abonada", () => {
    const pending = run({ type: "appointment.book", payload: bookPayload({ depositMethod: "transferencia" }) }, demoClient);
    const declared = run({ type: "appointment.declareTransfer", id: "a-test", reference: "1234" }, demoClient, pending);
    const deposit = find(declared, "a-test").deposit;
    expect(deposit).toMatchObject({ status: "en_revision", method: "transferencia", reference: "1234" });
    // Al declararla se suelta el hold: el horario queda tomado hasta que el staff revise.
    expect(find(declared, "a-test").holdUntil).toBeUndefined();
    expectError(() => run({ type: "appointment.declareTransfer", id: "a-test" }, demoClient, declared), /Ya avisaste/);

    // Una seña en revisión todavía no es plata: no genera crédito al cancelar.
    const cancelled = run({ type: "appointment.cancel", id: "a-test" }, demoClient, declared);
    expect(find(cancelled, "a-test").creditIssued).toBeUndefined();
    expect(cancelled.clients.find((c) => c.id === "c-demo")?.credit).toBe(0);
  });

  it("el staff confirma o rechaza la transferencia declarada", () => {
    const pending = run({ type: "appointment.book", payload: bookPayload({ depositMethod: "transferencia" }) }, demoClient);
    const declared = run({ type: "appointment.declareTransfer", id: "a-test" }, demoClient, pending);

    const rejected = run({ type: "appointment.rejectDeposit", id: "a-test" }, admin, declared);
    expect(find(rejected, "a-test").deposit).toMatchObject({ status: "pendiente", declaredAt: undefined });

    const confirmed = run({ type: "appointment.deposit", id: "a-test", method: "transferencia" }, admin, declared);
    expect(find(confirmed, "a-test").deposit).toMatchObject({ status: "abonada", method: "transferencia" });
    expectError(() => run({ type: "appointment.deposit", id: "a-test", method: "transferencia" }, admin, confirmed), /ya está abonada/);
  });

  it("el webhook de la pasarela acredita la seña y solo puede hacer eso", () => {
    const pending = run({ type: "appointment.book", payload: bookPayload() }, demoClient);
    const paid = run({ type: "appointment.deposit", id: "a-test", method: "mercadopago", reference: "MP-99" }, system, pending);
    expect(find(paid, "a-test").deposit).toMatchObject({ status: "abonada", method: "mercadopago", reference: "MP-99" });
    // Acreditar libera el hold: el turno ya está pago.
    expect(find(paid, "a-test").holdUntil).toBeUndefined();
    expectError(() => run({ type: "appointment.cancel", id: "a-test" }, system, paid), /no permitida/, 403);
  });

  it("apertura y cierre de caja", () => {
    const closed = run({ type: "cash.close", closure: { id: "cc-1", date: TODAY, expectedCash: 6000, countedCash: 5000, digital: 0, total: 6000 } });
    expect(closed.cashRegister.open).toBe(false);
    expect(closed.cashClosures[0]).toMatchObject({ id: "cc-1", openedAt: "08:30", countedCash: 5000 });
    expectError(() => run({ type: "cash.close", closure: { id: "cc-2", date: TODAY, expectedCash: 0, countedCash: 0, digital: 0, total: 0 } }, admin, closed), /ya está cerrada/);
    expect(run({ type: "cash.open" }, admin, closed).cashRegister.open).toBe(true);
  });
});

describe("reserva que vence sin pagar", () => {
  const bookDigital = () => run({ type: "appointment.book", payload: bookPayload() }, demoClient);

  it("libera el horario y devuelve el stock al vencer el plazo", () => {
    const held = bookDigital();
    const after = new Date(MONDAY_9AM.getTime() + (HOLD_MINUTES + 1) * 60_000);

    // Cualquier comando posterior barre las reservas vencidas: no hace falta cron.
    const swept = run({ type: "cash.open" }, admin, held, after);
    expect(find(swept, "a-test")).toMatchObject({ status: "cancelado", holdExpired: true, holdUntil: undefined });
    // Y el horario vuelve a estar disponible para otro cliente.
    expect(() => run({ type: "appointment.book", payload: bookPayload({ id: "a-otro" }) }, demoClient, swept, after)).not.toThrow();
  });

  it("dentro del plazo el horario sigue tomado", () => {
    const held = bookDigital();
    expectError(
      () => run({ type: "appointment.book", payload: bookPayload({ id: "a-otro" }) }, otherClient, held),
      /no está disponible/,
      409,
    );
  });

  it("acreditada la seña, el turno ya no vence", () => {
    const paid = run({ type: "appointment.deposit", id: "a-test", method: "mercadopago" }, system, bookDigital());
    const after = new Date(MONDAY_9AM.getTime() + (HOLD_MINUTES + 1) * 60_000);
    expect(find(run({ type: "cash.open" }, admin, paid, after), "a-test").status).toBe("confirmado");
  });
});

describe("ausencia del cliente (no show)", () => {
  // a-demo-client es el miércoles 11:00 con la seña abonada.
  const afterSlot = new Date(2026, 8, 16, 12, 0);

  it("retiene la seña y no genera crédito", () => {
    const next = run({ type: "appointment.noShow", id: "a-demo-client" }, admin, state, afterSlot);
    expect(find(next, "a-demo-client")).toMatchObject({ status: "no_show", depositForfeited: 6000 });
    expect(next.clients.find((c) => c.id === "c-demo")?.credit).toBe(0);
  });

  it("no se puede marcar antes de que empiece el turno", () => {
    expectError(() => run({ type: "appointment.noShow", id: "a-demo-client" }, admin), /todavía no empezó/);
  });

  it("el cliente no puede marcarse ausente a sí mismo", () => {
    expectError(() => run({ type: "appointment.noShow", id: "a-demo-client" }, demoClient, state, afterSlot), /reservada al staff/, 403);
  });

  it("para perdonar la ausencia el staff cancela, que sí devuelve el crédito", () => {
    const next = run({ type: "appointment.cancel", id: "a-demo-client" }, admin, state, afterSlot);
    expect(find(next, "a-demo-client").creditIssued).toBe(6000);
  });
});

describe("alcance del barbero", () => {
  it("opera sus turnos y no los de otro sillón", () => {
    // a-julian es de Nico; a-lucas, de Diego.
    expect(find(run({ type: "appointment.charge", id: "a-julian", method: "efectivo" }, barberNico), "a-julian").status).toBe("completado");
    expectError(() => run({ type: "appointment.charge", id: "a-julian", method: "efectivo" }, barberOther), /otro barbero/, 403);
  });

  it("no agenda ni bloquea sobre el sillón de otro", () => {
    expectError(() => run({ type: "appointment.book", payload: bookPayload({ barberId: "b-diego" }) }, barberNico), /tu agenda/, 403);
    expectError(
      () => run({ type: "block.create", block: { id: "blk-x", barberId: "b-diego", date: WEDNESDAY, start: "10:00", end: "11:00", reason: "Franco" } }, barberNico),
      /tu agenda/,
      403,
    );
    expect(run({ type: "block.create", block: { id: "blk-x", barberId: "b-nico", date: WEDNESDAY, start: "10:00", end: "11:00", reason: "Franco" } }, barberNico).blocks.some((b) => b.id === "blk-x")).toBe(true);
  });

  it("no toca la plata del local, el catálogo ni el equipo", () => {
    const ownerOnly: Command[] = [
      { type: "cash.open" },
      { type: "cash.close", closure: { id: "cc-x", date: TODAY, expectedCash: 0, countedCash: 0, digital: 0, total: 0 } },
      { type: "service.delete", id: "s-tijera" },
      { type: "product.stock", id: "p-clay", delta: 1 },
      { type: "barber.delete", id: "b-diego" },
      { type: "client.delete", id: "c-mateo" },
      { type: "settings.hours", dayIndex: 1, patch: { closed: true } },
    ];
    for (const command of ownerOnly) expectError(() => run(command, barberNico), /reservada al dueño/, 403);
  });
});

describe("seña configurable por barbería", () => {
  const withRate = (rate: number) => ({ ...state, depositSettings: { ...state.depositSettings, rate } });

  it("usa la tasa del local para calcular la seña", () => {
    const next = run({ type: "appointment.book", payload: bookPayload() }, demoClient, withRate(0.3));
    // 30% de $9.500
    expect(find(next, "a-test").deposit.amount).toBe(2850);
  });

  it("con seña 0 el turno queda confirmado sin nada que cobrar ni horario retenido", () => {
    const next = run({ type: "appointment.book", payload: bookPayload() }, demoClient, withRate(0));
    const a = find(next, "a-test");
    expect(a.deposit).toMatchObject({ amount: 0, status: "abonada" });
    expect(a.holdUntil).toBeUndefined();
    expect(a.status).toBe("confirmado");
  });

  it("el dueño cambia la tasa y se valida el rango", () => {
    expect(run({ type: "settings.deposit", rate: 0.3 }).depositSettings.rate).toBe(0.3);
    expect(run({ type: "settings.deposit", rate: 0 }).depositSettings.rate).toBe(0);
    expectError(() => run({ type: "settings.deposit", rate: 1.4 }), /entre 0% y 100%/);
    expectError(() => run({ type: "settings.deposit", rate: -1 }), /entre 0% y 100%/);
    // Cambiar la tasa no toca el switch de efectivo.
    expect(run({ type: "settings.deposit", rate: 0.3 }).depositSettings.allowCash).toBe(true);
  });

  it("cambiar la tasa no altera la seña de los turnos ya reservados", () => {
    const booked = run({ type: "appointment.book", payload: bookPayload() }, demoClient);
    const antes = find(booked, "a-test").deposit.amount;
    const despues = run({ type: "settings.deposit", rate: 1 }, admin, booked);
    expect(find(despues, "a-test").deposit.amount).toBe(antes);
  });
});

describe("ausencias reiteradas", () => {
  /** Deja al cliente demo con N ausencias registradas. */
  const withNoShows = (n: number) => ({
    ...state,
    appointments: [
      ...state.appointments,
      ...Array.from({ length: n }, (_, i) => ({
        ...state.appointments[0],
        id: `a-falta-${i}`,
        clientId: "c-demo",
        status: "no_show" as const,
      })),
    ],
  });

  it("con dos ausencias ya no puede reservar con seña en efectivo", () => {
    expectError(
      () => run({ type: "appointment.book", payload: bookPayload({ depositMethod: "efectivo" }) }, demoClient, withNoShows(2)),
      /por adelantado/,
    );
  });

  it("con una sola ausencia sigue pudiendo", () => {
    const next = run(
      { type: "appointment.book", payload: bookPayload({ depositMethod: "efectivo" }) },
      demoClient,
      withNoShows(1),
    );
    expect(find(next, "a-test").deposit.status).toBe("pendiente");
  });

  it("igual puede reservar pagando por adelantado", () => {
    const next = run({ type: "appointment.book", payload: bookPayload() }, demoClient, withNoShows(3));
    expect(find(next, "a-test").status).toBe("confirmado");
  });
});

describe("reseñas", () => {
  /** a-mateo es de hoy; se lo cobra para poder calificarlo. */
  const completed = () => run({ type: "appointment.charge", id: "a-mateo", method: "efectivo" });
  const mateo: typeof demoClient = { role: "cliente", shopId: "s-default", clientId: "c-mateo" };

  it("el cliente califica su turno terminado, una sola vez", () => {
    const done = completed();
    const rated = run({ type: "appointment.rate", id: "a-mateo", rating: 4 }, mateo, done);
    expect(find(rated, "a-mateo").rating).toBe(4);
    expectError(() => run({ type: "appointment.rate", id: "a-mateo", rating: 5 }, mateo, rated), /Ya calificaste/);
  });

  it("no se califica un turno que todavía no ocurrió", () => {
    expectError(() => run({ type: "appointment.rate", id: "a-demo-client", rating: 5 }, demoClient), /ya te hicieron/);
  });

  it("valida el rango de estrellas", () => {
    const done = completed();
    for (const rating of [0, 6, 2.5]) {
      expectError(() => run({ type: "appointment.rate", id: "a-mateo", rating }, mateo, done), /de 1 a 5/);
    }
  });

  it("nadie puede calificar el turno de otro", () => {
    const done = completed();
    expectError(() => run({ type: "appointment.rate", id: "a-mateo", rating: 5 }, demoClient, done), /permiso/, 403);
    // Ni el propio local: si no, se pondría cinco estrellas solo.
    expectError(() => run({ type: "appointment.rate", id: "a-mateo", rating: 5 }, admin, done), /Solo el cliente/, 403);
    expectError(() => run({ type: "appointment.rate", id: "a-mateo", rating: 5 }, barberNico, done), /Solo el cliente/, 403);
  });
});

describe("productos en el turno", () => {
  it("suma, resta y controla el stock", () => {
    let s = run({ type: "appointment.addProduct", id: "a-demo-client", productId: "p-elixir" }, demoClient);
    s = run({ type: "appointment.addProduct", id: "a-demo-client", productId: "p-elixir" }, demoClient, s);
    expect(find(s, "a-demo-client").products[0].qty).toBe(2);
    s = run({ type: "appointment.removeProduct", id: "a-demo-client", productId: "p-elixir" }, demoClient, s);
    expect(find(s, "a-demo-client").products[0].qty).toBe(1);
    s = run({ type: "appointment.removeProduct", id: "a-demo-client", productId: "p-elixir" }, demoClient, s);
    expect(find(s, "a-demo-client").products).toHaveLength(0);
    expect(s.products.find((p) => p.id === "p-elixir")?.stock).toBe(3);
  });

  it("sin stock no se puede agregar", () => {
    const empty = { ...state, products: state.products.map((p) => ({ ...p, stock: 0 })) };
    expectError(() => run({ type: "appointment.addProduct", id: "a-demo-client", productId: "p-clay" }, demoClient, empty), /stock/);
  });
});

describe("ABM de catálogo, equipo y clientes", () => {
  it("servicios: alta, modificación con validación y baja", () => {
    const service = { id: "s-x", name: "Afeitado", description: "", price: 6000, durationMin: 30, category: "barba" as const, active: true };
    let s = run({ type: "service.upsert", service });
    expect(s.services.at(-1)).toMatchObject({ id: "s-x", price: 6000 });
    s = run({ type: "service.upsert", service: { ...service, price: 7000 } }, admin, s);
    expect(s.services.filter((x) => x.id === "s-x")).toHaveLength(1);
    expect(s.services.find((x) => x.id === "s-x")?.price).toBe(7000);
    expectError(() => run({ type: "service.upsert", service: { ...service, price: 100 } }), /Precio/);
    expectError(() => run({ type: "service.upsert", service: { ...service, durationMin: 10 } }), /Duración/);
    expect(run({ type: "service.delete", id: "s-x" }, admin, s).services.some((x) => x.id === "s-x")).toBe(false);
  });

  it("productos: stock nunca negativo", () => {
    const s = run({ type: "product.stock", id: "p-elixir", delta: -10 });
    expect(s.products.find((p) => p.id === "p-elixir")?.stock).toBe(0);
    expectError(() => run({ type: "product.upsert", product: { ...state.products[0], stock: -1 } }), /Stock/);
  });

  it("barberos: sillón único, no se borra con turnos próximos ni el último", () => {
    const barber = { id: "b-x", name: "Lucía F.", initials: "LF", title: "Barber", chair: 3, rating: 5, reviews: 0, active: true };
    const s = run({ type: "barber.upsert", barber });
    expect(s.barbers.find((b) => b.id === "b-x")?.initials).toBe("LF");
    expectError(() => run({ type: "barber.upsert", barber: { ...barber, chair: 1 } }), /sillón #1/);
    expectError(() => run({ type: "barber.delete", id: "b-diego" }), /turnos próximos/);
    expect(run({ type: "barber.delete", id: "b-x" }, admin, s).barbers.some((b) => b.id === "b-x")).toBe(false);
    const alone = { ...state, barbers: [state.barbers[0]], appointments: [] };
    expectError(() => run({ type: "barber.delete", id: state.barbers[0].id }, admin, alone), /al menos un barbero/);
  });

  it("clientes: celular único, sincroniza turnos y protege campos del staff", () => {
    const mateo = state.clients.find((c) => c.id === "c-mateo")!;
    const renamed = run({ type: "client.upsert", client: { ...mateo, name: "Mateo R." } });
    expect(renamed.appointments.filter((a) => a.clientId === "c-mateo").every((a) => a.clientName === "Mateo R.")).toBe(true);
    expectError(() => run({ type: "client.upsert", client: { ...mateo, phone: "+54 9 11 6120-4471" } }), /Ya existe/);

    const demo = state.clients.find((c) => c.id === "c-demo")!;
    const self = run({ type: "client.upsert", client: { ...demo, name: "Tomás F.", credit: 99999, internalNotes: "hack" } }, demoClient);
    expect(self.clients.find((c) => c.id === "c-demo")).toMatchObject({ name: "Tomás F.", credit: 0 });
    expect(self.clients.find((c) => c.id === "c-demo")?.internalNotes).toBeUndefined();
  });

  it("clientes: no se borran con turnos próximos; al borrar se desvincula el historial", () => {
    expectError(() => run({ type: "client.delete", id: "c-demo" }), /turnos próximos/);
    const s = run({ type: "client.delete", id: "c-santiago" }, admin, state, new Date(2026, 8, 14, 21, 0));
    expect(s.clients.some((c) => c.id === "c-santiago")).toBe(false);
    expect(s.appointments.find((a) => a.id === "a-santiago")?.clientId).toBeUndefined();
  });

  it("bloqueos y configuración", () => {
    const block = { id: "k1", barberId: "b-nico", date: TUESDAY, start: "10:00", end: "11:00", reason: "Franco" };
    const s = run({ type: "block.create", block });
    expect(s.blocks.some((b) => b.id === "k1")).toBe(true);
    expectError(() => run({ type: "block.create", block: { ...block, end: "09:00" } }), /posterior/);
    expect(run({ type: "block.delete", id: "k1" }, admin, s).blocks.some((b) => b.id === "k1")).toBe(false);
    expectError(() => run({ type: "settings.hours", dayIndex: 1, patch: { close: "08:00" } }), /cierre/);
    expect(run({ type: "settings.hours", dayIndex: 0, patch: { closed: false } }).businessHours[0].closed).toBe(false);
    expect(run({ type: "settings.info", patch: { transferAlias: "NUEVO.ALIAS" } }).businessInfo.transferAlias).toBe("NUEVO.ALIAS");
  });
});

it("applyCommand no muta el estado recibido", () => {
  const snapshot = JSON.stringify(state);
  run({ type: "appointment.cancel", id: "a-demo-client" }, demoClient);
  run({ type: "service.delete", id: "s-tijera" });
  expect(JSON.stringify(state)).toBe(snapshot);
});

it("el staff puede cambiar el servicio de un turno en curso sin mover su horario", () => {
  const during = new Date(2026, 8, 14, 10, 45); // Mateo empezó a las 10:30
  const next = run({ type: "appointment.update", id: "a-mateo", patch: { serviceId: "s-combo-barba" } }, admin, state, during);
  expect(find(next, "a-mateo")).toMatchObject({ time: "10:30", durationMin: 60 });
  // Pero no puede superponerse con el turno siguiente del mismo barbero.
  const longer = { ...state, services: state.services.map((s) => (s.id === "s-combo-barba" ? { ...s, durationMin: 90 } : s)) };
  expect(() => run({ type: "appointment.update", id: "a-mateo", patch: { serviceId: "s-combo-barba" } }, admin, longer, during)).toThrow(/no está disponible/);
});
