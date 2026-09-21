import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Códigos de verificación. Es lo que da acceso a una cuenta, así que se prueba que sean
 * aleatorios, de un solo uso, con vencimiento y con un tope de intentos.
 */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ds-studio-otp-"));

beforeAll(() => {
  process.env.DATABASE_PATH = path.join(dir, "otp.db");
  // Sin cuenta de WhatsApp, el módulo devuelve el código en vez de enviarlo.
  process.env.OTP_DEBUG = "1";
  process.env.SEED_DEMO = "1";
});

afterEach(() => vi.useRealTimers());

afterAll(() => {
  delete (globalThis as { __dsDb?: unknown }).__dsDb;
  delete process.env.OTP_DEBUG;
  fs.rmSync(dir, { recursive: true, force: true });
});

async function otp() {
  return import("@/server/otp");
}

const SHOP = "s-default";
let n = 0;
/** Un identificador distinto por caso: el cooldown es por (barbería, identificador, trámite). */
const nextId = () => `tel:110000${n++}`;

describe("códigos de verificación", () => {
  it("emite un código de 6 dígitos y lo acepta una sola vez", async () => {
    const { issueOtp, consumeOtp } = await otp();
    const id = nextId();

    const { code } = await issueOtp(SHOP, id, "acceso", "+54 9 11 1000 0000");
    expect(code).toMatch(/^\d{6}$/);

    await expect(consumeOtp(SHOP, id, "acceso", code!)).resolves.toBeUndefined();
    // Consumido: no sirve de nuevo.
    await expect(consumeOtp(SHOP, id, "acceso", code!)).rejects.toThrow(/código nuevo/);
  });

  it("dos códigos seguidos nunca son el mismo", async () => {
    const { issueOtp } = await otp();
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const { code } = await issueOtp(SHOP, nextId(), "acceso", "+54 9 11 1000 0000");
      codes.add(code!);
    }
    // 20 códigos de 6 dígitos repetidos serían un generador roto, no mala suerte.
    expect(codes.size).toBeGreaterThan(18);
  });

  it("rechaza el código de otro trámite y el de otra barbería", async () => {
    const { issueOtp, consumeOtp } = await otp();
    const id = nextId();
    const { code } = await issueOtp(SHOP, id, "registro", "+54 9 11 1000 0000");

    await expect(consumeOtp(SHOP, id, "acceso", code!)).rejects.toThrow(/código nuevo/);
    await expect(consumeOtp("s-otra", id, "registro", code!)).rejects.toThrow(/código nuevo/);
    // El del trámite correcto sí entra.
    await expect(consumeOtp(SHOP, id, "registro", code!)).resolves.toBeUndefined();
  });

  it("corta después de 5 intentos fallidos y descarta el código", async () => {
    const { issueOtp, consumeOtp } = await otp();
    const id = nextId();
    const { code } = await issueOtp(SHOP, id, "acceso", "+54 9 11 1000 0000");

    for (let i = 0; i < 5; i++) {
      await expect(consumeOtp(SHOP, id, "acceso", "000000")).rejects.toThrow(/incorrecto/);
    }
    // Agotados los intentos, ni siquiera el código bueno sirve.
    await expect(consumeOtp(SHOP, id, "acceso", code!)).rejects.toThrow(/Demasiados intentos/);
  });

  it("agotar los intentos no habilita pedir otro código enseguida", async () => {
    const { issueOtp, consumeOtp } = await otp();
    const id = nextId();
    await issueOtp(SHOP, id, "acceso", "+54 9 11 1000 0000");
    for (let i = 0; i < 5; i++) {
      await expect(consumeOtp(SHOP, id, "acceso", "000000")).rejects.toThrow(/incorrecto/);
    }
    // Si quemar los intentos permitiera pedir otro código al instante, el tope de 5 no serviría
    // de nada: se podría adivinar en loop.
    await expect(issueOtp(SHOP, id, "acceso", "+54 9 11 1000 0000")).rejects.toThrow(/Esperá/);
  });

  it("vence a los 10 minutos", async () => {
    const { issueOtp, consumeOtp } = await otp();
    const id = nextId();
    const { code } = await issueOtp(SHOP, id, "acceso", "+54 9 11 1000 0000");

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.now() + 11 * 60_000));
    await expect(consumeOtp(SHOP, id, "acceso", code!)).rejects.toThrow(/venció/);
  });

  it("no deja pedir otro código antes del minuto", async () => {
    const { issueOtp } = await otp();
    const id = nextId();
    await issueOtp(SHOP, id, "acceso", "+54 9 11 1000 0000");
    await expect(issueOtp(SHOP, id, "acceso", "+54 9 11 1000 0000")).rejects.toThrow(/Esperá/);
  });

  it("pasado el cooldown, el código nuevo reemplaza al anterior", async () => {
    const { issueOtp, consumeOtp } = await otp();
    const id = nextId();
    const primero = await issueOtp(SHOP, id, "acceso", "+54 9 11 1000 0000");

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.now() + 61_000));
    const segundo = await issueOtp(SHOP, id, "acceso", "+54 9 11 1000 0000");
    expect(segundo.code).not.toBe(primero.code);

    await expect(consumeOtp(SHOP, id, "acceso", primero.code!)).rejects.toThrow(/incorrecto/);
    await expect(consumeOtp(SHOP, id, "acceso", segundo.code!)).resolves.toBeUndefined();
  });

  it("la verificación sin consumir deja el código vivo para el paso siguiente", async () => {
    const { issueOtp, consumeOtp } = await otp();
    const id = nextId();
    const { code } = await issueOtp(SHOP, id, "recuperacion", "+54 9 11 1000 0000");

    await expect(consumeOtp(SHOP, id, "recuperacion", code!, { consume: false })).resolves.toBeUndefined();
    // Sigue sirviendo: es el paso donde se guarda el PIN nuevo.
    await expect(consumeOtp(SHOP, id, "recuperacion", code!)).resolves.toBeUndefined();
    await expect(consumeOtp(SHOP, id, "recuperacion", code!)).rejects.toThrow(/código nuevo/);
  });

  it("sin WhatsApp configurado y sin modo debug no se emite nada", async () => {
    const { issueOtp } = await otp();
    delete process.env.OTP_DEBUG;
    try {
      await expect(issueOtp(SHOP, nextId(), "acceso", "+54 9 11 1000 0000")).rejects.toThrow(/no configuró WhatsApp/);
    } finally {
      process.env.OTP_DEBUG = "1";
    }
  });

  it("el código no se guarda en claro", async () => {
    const { issueOtp } = await otp();
    const { queryOne, getDb } = await import("@/server/db");
    const id = nextId();
    const { code } = await issueOtp(SHOP, id, "acceso", "+54 9 11 1000 0000");

    const row = queryOne<{ code_hash: string }>(
      await getDb(),
      "SELECT code_hash FROM otp_codes WHERE shop_id = ? AND identifier = ? AND purpose = 'acceso'",
      [SHOP, id],
    );
    expect(row?.code_hash).toBeTruthy();
    expect(row?.code_hash).not.toContain(code!);
  });
});
