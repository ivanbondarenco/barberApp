import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Mails: plantillas y link de confirmación.
 *
 * Lo que importa acá es que sin SMTP configurado nada explote —registrarse y reservar tienen
 * que seguir andando— y que los links de confirmación sirvan una sola vez.
 */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ds-studio-mail-"));

beforeAll(() => {
  process.env.DATABASE_PATH = path.join(dir, "mail.db");
  process.env.APP_URL = "https://turnos.test";
  delete process.env.SMTP_HOST;
  delete process.env.MAIL_FROM;
});

afterAll(() => {
  delete (globalThis as { __dsDb?: unknown }).__dsDb;
  fs.rmSync(dir, { recursive: true, force: true });
});

const turno = {
  id: "a-1",
  clientId: "c-1",
  clientName: "Tomás Ferreyra",
  clientPhone: "+54 9 11 5555 0192",
  verified: true,
  barberId: "b-1",
  serviceId: "s-1",
  serviceName: "Corte de pelo",
  servicePrice: 10000,
  durationMin: 45,
  date: "2026-10-02",
  time: "15:30",
  deposit: { amount: 5000, status: "pendiente" as const, method: "efectivo" as const },
  products: [],
  status: "confirmado" as const,
  source: "app" as const,
  createdAt: "2026-09-26T10:00:00.000Z",
};
const info = { name: "D.S Studio", address: "Honduras 4820", email: "hola@dsstudio.com" };

describe("plantillas", () => {
  it("la bienvenida saluda por el nombre y nombra la barbería", async () => {
    const { welcomeClientEmail } = await import("@/server/emails");
    const { html, subject } = welcomeClientEmail("Tomás Ferreyra", "D.S Studio");
    expect(subject).toBe("Tu cuenta ya está lista");
    expect(html).toContain("¡Bienvenido, Tomás!");
    expect(html).toContain("D.S Studio");
    expect(html).toContain("https://turnos.test/cliente/reservar");
  });

  it("el mail de la barbería nueva lleva su link público", async () => {
    const { welcomeShopEmail } = await import("@/server/emails");
    const { html } = welcomeShopEmail("Marcos Duarte", "Barbería Del Sur", "barberia-del-sur");
    expect(html).toContain("https://turnos.test/b/barberia-del-sur");
    expect(html).toContain("¡Listo, Marcos!");
  });

  it("el código de recuperación va en el asunto y en el cuerpo", async () => {
    const { passwordResetEmail } = await import("@/server/emails");
    const { subject, html } = passwordResetEmail("Tomás", "482913");
    expect(subject).toContain("482913");
    expect(html).toContain("482913");
    expect(html).toContain("Vence en 10 minutos");
  });

  it("el turno reservado muestra cuándo, qué y la seña pendiente", async () => {
    const { appointmentBookedEmail } = await import("@/server/emails");
    const { subject, html } = appointmentBookedEmail(turno, info);
    expect(subject).toContain("15:30");
    expect(html).toContain("Corte de pelo");
    expect(html).toContain("15:30");
    expect(html).toContain("Honduras 4820");
    expect(html).toContain("$5.000"); // la seña que falta abonar
  });

  it("la cancelación avisa el crédito a favor", async () => {
    const { appointmentCancelledEmail } = await import("@/server/emails");
    const { html } = appointmentCancelledEmail({ ...turno, status: "cancelado", creditIssued: 5000 }, info);
    expect(html).toContain("$5.000");
    expect(html).toContain("crédito a favor");
  });

  it("escapa lo que viene de la base: un nombre no puede meter HTML", async () => {
    const { welcomeClientEmail } = await import("@/server/emails");
    const { html } = welcomeClientEmail("<script>alert(1)</script> Pérez", "Barbería <b>X</b>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Barbería &lt;b&gt;X&lt;/b&gt;");
  });
});

describe("sin SMTP configurado", () => {
  it("no manda nada y no lanza", async () => {
    vi.resetModules();
    const { mailReady, sendMail } = await import("@/server/mail");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(mailReady()).toBe(false);
    await expect(sendMail({ to: "alguien@test.com", subject: "Hola", html: "<p>Hola</p>" })).resolves.toBe(false);
    warn.mockRestore();
  });

  it("registrar un cliente no intenta enviar ni crea tokens", async () => {
    vi.resetModules();
    delete (globalThis as { __dsDb?: unknown }).__dsDb;
    const { notifyClientRegistered } = await import("@/server/notify");
    const { getDb, queryAll } = await import("@/server/db");
    await notifyClientRegistered({ id: "u-1", name: "Tomás", email: "tomas@test.com" });
    expect(queryAll(await getDb(), "SELECT token_hash FROM email_tokens")).toEqual([]);
  });
});

describe("link para confirmar el email", () => {
  it("sirve una sola vez y deja la cuenta verificada", async () => {
    vi.resetModules();
    delete (globalThis as { __dsDb?: unknown }).__dsDb;
    const { getDb, queryOne } = await import("@/server/db");
    const { consumeEmailVerification, issueEmailVerification } = await import("@/server/notify");
    const db = await getDb();
    db.run(
      `INSERT INTO users (id, shop_id, role, identifier, name, password_hash, created_at)
       VALUES ('u-verif', NULL, 'cliente', 'verif@test.com', 'Vera', 'sal:hash', '2026-09-26')`,
    );

    const link = await issueEmailVerification("u-verif");
    expect(link.startsWith("https://turnos.test/api/auth/verificar?token=")).toBe(true);
    const token = new URL(link).searchParams.get("token")!;
    // El token viaja en el link pero en la base solo queda su hash.
    expect(queryOne(db, "SELECT token_hash FROM email_tokens WHERE token_hash = ?", [token])).toBeUndefined();

    expect(await consumeEmailVerification(token)).toBe(true);
    expect(queryOne<{ email_verified_at: string }>(db, "SELECT email_verified_at FROM users WHERE id = 'u-verif'")?.email_verified_at).toBeTruthy();
    // Usado: ya no vale.
    expect(await consumeEmailVerification(token)).toBe(false);
    expect(await consumeEmailVerification("token-inventado")).toBe(false);
  });

  it("un link vencido no verifica nada", async () => {
    vi.resetModules();
    delete (globalThis as { __dsDb?: unknown }).__dsDb;
    const { getDb, queryOne } = await import("@/server/db");
    const { consumeEmailVerification, issueEmailVerification } = await import("@/server/notify");
    const db = await getDb();
    db.run(
      `INSERT INTO users (id, shop_id, role, identifier, name, password_hash, created_at)
       VALUES ('u-vencido', NULL, 'cliente', 'vencido@test.com', 'Ven', 'sal:hash', '2026-09-26')`,
    );
    const token = new URL(await issueEmailVerification("u-vencido")).searchParams.get("token")!;
    db.run("UPDATE email_tokens SET expires_at = '2020-01-01T00:00:00.000Z' WHERE user_id = 'u-vencido'");

    expect(await consumeEmailVerification(token)).toBe(false);
    expect(queryOne<{ email_verified_at: string | null }>(db, "SELECT email_verified_at FROM users WHERE id = 'u-vencido'")?.email_verified_at).toBeNull();
  });
});
