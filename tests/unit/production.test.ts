import { afterEach, describe, expect, it, vi } from "vitest";
import { productionConfig, testModeAllowed } from "@/server/config";
import { publicBaseUrl } from "@/server/http";
import { reportError, resetAlertsForTests } from "@/server/monitor";
import { decryptSecret, encryptSecret, isEncrypted } from "@/server/secret-box";

const KEY = "clave-de-prueba-bien-larga-de-mas-de-32-caracteres";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetAlertsForTests();
});

describe("credenciales cifradas", () => {
  it("cifra y descifra, y el valor guardado no deja ver el token", () => {
    vi.stubEnv("SECRETS_KEY", KEY);
    const stored = encryptSecret("APP_USR-123456-token-real", "s-norte", "mp_access_token");
    expect(isEncrypted(stored)).toBe(true);
    expect(stored).not.toContain("APP_USR");
    expect(decryptSecret(stored, "s-norte", "mp_access_token")).toBe("APP_USR-123456-token-real");
  });

  it("dos cifrados del mismo valor no se parecen", () => {
    vi.stubEnv("SECRETS_KEY", KEY);
    expect(encryptSecret("igual", "s-a", "k")).not.toBe(encryptSecret("igual", "s-a", "k"));
  });

  it("un valor copiado a otra barbería o a otra credencial no descifra", () => {
    vi.stubEnv("SECRETS_KEY", KEY);
    const stored = encryptSecret("token", "s-norte", "mp_access_token");
    expect(() => decryptSecret(stored, "s-sur", "mp_access_token")).toThrow();
    expect(() => decryptSecret(stored, "s-norte", "mp_webhook_secret")).toThrow();
  });

  it("con otra clave no descifra", () => {
    vi.stubEnv("SECRETS_KEY", KEY);
    const stored = encryptSecret("token", "s-norte", "mp_access_token");
    vi.stubEnv("SECRETS_KEY", `${KEY}-otra`);
    expect(() => decryptSecret(stored, "s-norte", "mp_access_token")).toThrow();
  });

  it("un valor anterior al cifrado se lee tal cual", () => {
    expect(decryptSecret("TOKEN-VIEJO", "s-norte", "mp_access_token")).toBe("TOKEN-VIEJO");
  });

  it("en producción no cifra sin SECRETS_KEY, ni con una clave corta", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SECRETS_KEY", "");
    expect(() => encryptSecret("token", "s", "k")).toThrow(/SECRETS_KEY/);
    vi.stubEnv("SECRETS_KEY", "corta");
    expect(() => encryptSecret("token", "s", "k")).toThrow(/corta/);
  });
});

describe("configuración de producción", () => {
  const prod = {
    NODE_ENV: "production",
    SECRETS_KEY: KEY,
    APP_URL: "https://turnos.ejemplo.com",
    SMTP_HOST: "smtp.ejemplo.com",
    ALERT_WEBHOOK_URL: "https://hooks.ejemplo.com/x",
    DATABASE_PATH: "/data/ds-studio.db",
  };

  it("una configuración completa arranca sin errores ni avisos", () => {
    expect(productionConfig(prod)).toEqual({ errors: [], warnings: [] });
  });

  it("sin SECRETS_KEY, o con una corta, no arranca", () => {
    expect(productionConfig({ ...prod, SECRETS_KEY: undefined }).errors.join()).toMatch(/SECRETS_KEY/);
    expect(productionConfig({ ...prod, SECRETS_KEY: "corta" }).errors.join()).toMatch(/demasiado corta/);
  });

  it("no arranca con los códigos a la vista ni con la barbería de demostración", () => {
    expect(productionConfig({ ...prod, OTP_DEBUG: "1" }).errors.join()).toMatch(/OTP_DEBUG/);
    expect(productionConfig({ ...prod, SEED_DEMO: "1" }).errors.join()).toMatch(/SEED_DEMO/);
  });

  it("el modo de test E2E solo vale contra una dirección local", () => {
    const e2e = { ...prod, E2E_TEST_MODE: "1", OTP_DEBUG: "1", SEED_DEMO: "1", APP_URL: "http://localhost:3210" };
    expect(productionConfig(e2e).errors).toEqual([]);
    expect(testModeAllowed(e2e)).toBe(true);

    // En un servidor público no sirve para colar los códigos a la vista.
    const publico = { ...e2e, APP_URL: "https://turnos.ejemplo.com" };
    expect(testModeAllowed(publico)).toBe(false);
    expect(productionConfig(publico).errors.join()).toMatch(/E2E_TEST_MODE/);
    expect(productionConfig(publico).errors.join()).toMatch(/OTP_DEBUG/);
  });

  it("avisa lo que falta sin frenar el arranque", () => {
    const { errors, warnings } = productionConfig({ NODE_ENV: "production", SECRETS_KEY: KEY, APP_URL: "http://turnos.ejemplo.com" });
    expect(errors).toEqual([]);
    expect(warnings.join("\n")).toMatch(/https/);
    expect(warnings.join("\n")).toMatch(/SMTP_HOST/);
    expect(warnings.join("\n")).toMatch(/ALERT_WEBHOOK_URL/);
    expect(warnings.join("\n")).toMatch(/DATABASE_PATH/);
  });

  it("fuera de producción no exige nada", () => {
    expect(productionConfig({ NODE_ENV: "development", OTP_DEBUG: "1" })).toEqual({ errors: [], warnings: [] });
    expect(testModeAllowed({ NODE_ENV: "development" })).toBe(true);
  });
});

describe("avisos de errores", () => {
  it("sin ALERT_WEBHOOK_URL solo loguea", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("ALERT_WEBHOOK_URL", "");
    await reportError("mail", new Error("SMTP caído"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("con ALERT_WEBHOOK_URL avisa una vez, sin repetir el mismo error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.ejemplo.com/x");

    await reportError("mercadopago.webhook", new Error("pago sin acreditar"), { shopId: "s-norte" });
    await reportError("mercadopago.webhook", new Error("pago sin acreditar"), { shopId: "s-norte" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.ejemplo.com/x");
    const body = JSON.parse(init.body);
    // Sirve para Slack (text) y para Discord (content).
    expect(body.text).toMatch(/mercadopago\.webhook: pago sin acreditar/);
    expect(body.content).toBe(body.text);
    expect(body.context).toEqual({ shopId: "s-norte" });

    // Otro error distinto sí se avisa.
    await reportError("mail", new Error("SMTP caído"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("si el canal de alertas está caído, no rompe nada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sin red")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.ejemplo.com/x");
    await expect(reportError("api", new Error("boom"))).resolves.toBeUndefined();
  });
});

describe("dirección pública", () => {
  it("los links de Mercado Pago salen de APP_URL, no de la conexión interna del proxy", () => {
    vi.stubEnv("APP_URL", "https://turnos.ejemplo.com/");
    expect(publicBaseUrl(new Request("http://app:3000/api/payments/checkout"))).toBe("https://turnos.ejemplo.com");
  });

  it("sin APP_URL (desarrollo) usa el origen del pedido", () => {
    vi.stubEnv("APP_URL", "");
    expect(publicBaseUrl(new Request("http://localhost:3001/api/payments/checkout"))).toBe("http://localhost:3001");
  });
});
