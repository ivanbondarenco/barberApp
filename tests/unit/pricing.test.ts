import { describe, expect, it } from "vitest";
import { appointmentTotals, DEPOSIT_RATE, productsTotal, splitDeposit } from "@/lib/pricing";
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
  it("la seña es siempre exactamente el 50%", () => {
    expect(DEPOSIT_RATE).toBe(0.5);
    expect(splitDeposit(11000)).toEqual({ total: 11000, deposit: 5500, balance: 5500 });
    expect(splitDeposit(16000)).toEqual({ total: 16000, deposit: 8000, balance: 8000 });
  });

  it("con montos impares seña + saldo siempre suman el total", () => {
    for (const total of [9500, 7501, 1, 12345]) {
      const { deposit, balance } = splitDeposit(total);
      expect(deposit + balance).toBe(total);
      expect(Math.abs(deposit - balance)).toBeLessThanOrEqual(1);
    }
  });
});

describe("appointmentTotals", () => {
  it("seña abonada: resta el 50% en el sillón", () => {
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
