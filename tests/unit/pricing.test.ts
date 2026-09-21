import { describe, expect, it } from "vitest";
import { appointmentTotals, DEFAULT_DEPOSIT_RATE, isValidDepositRate, noShowCount, productsTotal, splitDeposit } from "@/lib/pricing";
import type { Appointment } from "@/lib/types";

const base: Appointment = {
  id: "a1",
  clientName: "Test",
  clientPhone: "1155550000",
  verified: false,
  barberId: "b1",
  serviceId: "s1",
  serviceName: "Corte",
  servicePrice: 11000,
  durationMin: 45,
  date: "2026-09-16",
  time: "10:00",
  deposit: { amount: 5500, status: "abonada", method: "mercadopago" },
  products: [],
  status: "confirmado",
  source: "app",
  createdAt: "2026-09-14T09:00:00.000Z",
};

describe("splitDeposit", () => {
  it("usa el 50% cuando la barbería no configuró otra cosa", () => {
    expect(DEFAULT_DEPOSIT_RATE).toBe(0.5);
    expect(splitDeposit(11000)).toEqual({ total: 11000, deposit: 5500, balance: 5500 });
    expect(splitDeposit(16000)).toEqual({ total: 16000, deposit: 8000, balance: 8000 });
  });

  it("respeta la tasa de cada barbería", () => {
    expect(splitDeposit(10000, 0.3)).toEqual({ total: 10000, deposit: 3000, balance: 7000 });
    expect(splitDeposit(10000, 1)).toEqual({ total: 10000, deposit: 10000, balance: 0 });
    // Sin seña: todo se cobra en el sillón.
    expect(splitDeposit(10000, 0)).toEqual({ total: 10000, deposit: 0, balance: 10000 });
  });

  it("una tasa inválida cae en el valor por defecto en vez de romper la cuenta", () => {
    expect(isValidDepositRate(1.5)).toBe(false);
    expect(isValidDepositRate(-0.1)).toBe(false);
    expect(isValidDepositRate(Number.NaN)).toBe(false);
    expect(splitDeposit(10000, 1.5).deposit).toBe(5000);
  });

  it("con montos impares seña + saldo siempre suman el total", () => {
    for (const total of [9500, 7501, 1, 12345]) {
      for (const rate of [0, 0.3, 0.5, 1]) {
        const { deposit, balance } = splitDeposit(total, rate);
        expect(deposit + balance).toBe(total);
      }
    }
  });
});

describe("ausencias", () => {
  it("cuenta solo las del cliente", () => {
    const list = [
      { clientId: "c1", status: "no_show" },
      { clientId: "c1", status: "completado" },
      { clientId: "c2", status: "no_show" },
      { clientId: "c1", status: "no_show" },
    ];
    expect(noShowCount(list, "c1")).toBe(2);
    expect(noShowCount(list, "c2")).toBe(1);
    expect(noShowCount(list, "c3")).toBe(0);
  });
});

describe("appointmentTotals", () => {
  it("seña abonada: resta lo abonado en el sillón", () => {
    const t = appointmentTotals(base);
    expect(t).toMatchObject({ service: 11000, deposit: 5500, depositPaid: 5500, serviceBalance: 5500, dueAtChair: 5500, grandTotal: 11000 });
  });

  it("seña pendiente: se cobra todo en el sillón", () => {
    const t = appointmentTotals({ ...base, deposit: { ...base.deposit, status: "pendiente" } });
    expect(t.depositPaid).toBe(0);
    expect(t.dueAtChair).toBe(11000);
  });

  it("los productos se suman al saldo", () => {
    const withProducts = {
      ...base,
      products: [
        { productId: "p1", name: "Clay", unitPrice: 9800, qty: 1 },
        { productId: "p2", name: "Oil", unitPrice: 8200, qty: 2 },
      ],
    };
    expect(productsTotal(withProducts)).toBe(26200);
    const t = appointmentTotals(withProducts);
    expect(t.dueAtChair).toBe(5500 + 26200);
    expect(t.grandTotal).toBe(11000 + 26200);
  });

  it("si el servicio cambió después de pagar, usa la seña efectivamente abonada", () => {
    const t = appointmentTotals({ ...base, servicePrice: 16000 });
    expect(t.depositPaid).toBe(5500);
    expect(t.dueAtChair).toBe(10500);
  });
});
