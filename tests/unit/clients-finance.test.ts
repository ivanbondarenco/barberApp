import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCommand } from "@/lib/commands";
import { buildClients, summarizeClient } from "@/lib/clients";
import { daySummary } from "@/lib/finance";
import { admin, freezeTime, MONDAY_9AM, seedState, TODAY } from "./support/fixtures";

beforeEach(() => freezeTime());
afterEach(() => vi.useRealTimers());

describe("CRM", () => {
  it("resume visitas, gasto y próximo turno", () => {
    const state = seedState();
    const demo = state.clients.find((c) => c.id === "c-demo")!;
    const summary = summarizeClient(demo, state.appointments, MONDAY_9AM.getTime());
    expect(summary.visits).toBe(2);
    expect(summary.cancelled).toBe(1);
    expect(summary.totalSpent).toBe(12000 + 9800 + 16000);
    expect(summary.averageTicket).toBe(Math.round((12000 + 9800 + 16000) / 2));
    expect(summary.nextAppointment?.id).toBe("a-demo-client");
  });

  it("ordena por próximo turno y luego por nombre", () => {
    const state = seedState();
    const list = buildClients(state.clients, state.appointments, MONDAY_9AM.getTime());
    expect(list[0].profile.id).toBe("c-mateo"); // 10:30 hoy
    const withoutNext = list.filter((c) => !c.nextAppointment).map((c) => c.profile.name);
    expect(withoutNext).toEqual([...withoutNext].sort((a, b) => a.localeCompare(b)));
  });
});

describe("resumen financiero del día", () => {
  it("separa efectivo, digital y lo pendiente", () => {
    const state = seedState();
    const s = daySummary(state.appointments, TODAY);
    // Señas abonadas hoy: Mateo 6000 efectivo, Lucas 4750 MP, Santiago 8000 transferencia, Martín 5500 MP
    expect(s.cash).toBe(6000);
    expect(s.digital).toBe(4750 + 8000 + 5500);
    expect(s.total).toBe(6000 + 4750 + 8000 + 5500);
    expect(s.pendingCount).toBe(5);
    expect(s.count).toBe(5);
  });

  it("incluye los saldos cobrados y excluye cancelados", () => {
    let state = seedState();
    state = applyCommand(state, { type: "appointment.charge", id: "a-mateo", method: "efectivo" }, admin, MONDAY_9AM);
    state = applyCommand(state, { type: "appointment.cancel", id: "a-martin" }, admin, MONDAY_9AM);
    const s = daySummary(state.appointments, TODAY);
    expect(s.balances).toBe(6000);
    expect(s.cash).toBe(12000);
    expect(s.completed).toBe(1);
    expect(s.count).toBe(4);
    expect(s.digital).toBe(4750 + 8000);
  });
});
