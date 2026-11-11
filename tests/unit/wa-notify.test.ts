import { afterEach, describe, expect, it, vi } from "vitest";
import type { PendingReminder } from "@/lib/reminders";
import { applyCommand } from "@/lib/commands";
import { dueForWhatsapp, inSendingHours } from "@/server/reminder-worker";
import { evolutionConfig, sendWhatsappText, waNumber } from "@/server/wa-notify";
import { seedState } from "./support/fixtures";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("envío por Evolution API", () => {
  it("arma el número de WhatsApp argentino desde cualquier formato", () => {
    expect(waNumber("+54 9 11 3096-9716")).toBe("5491130969716");
    expect(waNumber("011 15 3096-9716")).toBe("5491130969716");
    expect(waNumber("123")).toBeUndefined();
  });

  it("sin URL o sin clave no está configurado", () => {
    expect(evolutionConfig({})).toBeUndefined();
    expect(evolutionConfig({ EVOLUTION_URL: "http://whatsapp:8080/" })).toBeUndefined();
    expect(evolutionConfig({ EVOLUTION_URL: "http://whatsapp:8080/", EVOLUTION_API_KEY: "k" })).toEqual({
      url: "http://whatsapp:8080",
      apiKey: "k",
      instance: "barberapp",
    });
  });

  it("manda el texto con la clave y nunca tira error", async () => {
    vi.stubEnv("EVOLUTION_URL", "http://whatsapp:8080");
    vi.stubEnv("EVOLUTION_API_KEY", "clave");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendWhatsappText("+54 9 11 3096-9716", "Hola")).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://whatsapp:8080/message/sendText/barberapp");
    expect(init.headers.apikey).toBe("clave");
    expect(JSON.parse(init.body)).toEqual({ number: "5491130969716", text: "Hola" });
  });

  it("sin configuración no llama a nadie", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendWhatsappText("+54 9 11 3096-9716", "Hola")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("recordatorios automáticos", () => {
  it("solo manda de 9 a 21 en hora argentina, aunque el servidor esté en UTC", () => {
    expect(inSendingHours(new Date("2026-09-14T12:00:00Z"))).toBe(true); // 09:00 AR
    expect(inSendingHours(new Date("2026-09-14T11:59:00Z"))).toBe(false); // 08:59 AR
    expect(inSendingHours(new Date("2026-09-15T00:00:00Z"))).toBe(false); // 21:00 AR
  });

  it("no le recuerda a quien acaba de reservar", () => {
    const now = new Date("2026-09-14T15:00:00Z");
    const reminder = (createdAt: string) => ({ appointment: { createdAt } }) as PendingReminder;
    expect(dueForWhatsapp(reminder("2026-09-14T14:00:00Z"), now)).toBe(false);
    expect(dueForWhatsapp(reminder("2026-09-14T12:00:00Z"), now)).toBe(true);
  });

  it("el sistema puede marcar el recordatorio, pero nada más", () => {
    const state = seedState();
    const target = state.appointments.find((a) => a.status === "confirmado")!;
    const system = { role: "sistema", shopId: "s" } as const;
    const next = applyCommand(state, { type: "appointment.reminderSent", id: target.id }, system);
    expect(next.appointments.find((a) => a.id === target.id)?.reminderSentAt).toBeTruthy();
    expect(() => applyCommand(state, { type: "appointment.cancel", id: target.id } as never, system)).toThrow();
  });
});
