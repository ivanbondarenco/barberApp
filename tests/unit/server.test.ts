import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeTime } from "./support/fixtures";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ds-studio-test-"));
const dbFile = path.join(dir, "test.db");

async function loadServer() {
  vi.resetModules();
  delete (globalThis as { __dsDb?: unknown }).__dsDb;
  const repository = await import("@/server/repository");
  const db = await import("@/server/db");
  return { ...repository, ...db };
}

beforeAll(() => {
  process.env.DATABASE_PATH = dbFile;
});

afterAll(() => {
  delete (globalThis as { __dsDb?: unknown }).__dsDb;
  fs.rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  freezeTime();
});

describe("crypto", () => {
  it("hashea el PIN con sal y lo verifica", async () => {
    const { hashPin, verifyPin, normalizeIdentifier } = await import("@/server/crypto");
    const a = hashPin("1234");
    const b = hashPin("1234");
    expect(a).not.toBe(b);
    expect(a).not.toContain("1234");
    expect(verifyPin("1234", a)).toBe(true);
    expect(verifyPin("4321", a)).toBe(false);
    expect(verifyPin("1234", "corrupto")).toBe(false);
    expect(normalizeIdentifier(" Admin@DSStudio.com.ar ")).toBe("admin@dsstudio.com.ar");
    expect(normalizeIdentifier("+54 9 11 5555-0192")).toBe("tel:1155550192");
  });
});

describe("repositorio SQLite", () => {
  it("siembra la base una sola vez con usuarios demo", async () => {
    fs.rmSync(dbFile, { force: true });
    const { loadState, getDb, queryAll } = await loadServer();
    const { state, version } = await loadState();
    expect(version).toBe(1);
    expect(state.services.length).toBeGreaterThan(0);
    expect(state.clients.find((c) => c.id === "c-demo")?.hasAccount).toBe(true);
    const users = queryAll<{ identifier: string; pin_hash: string }>(await getDb(), "SELECT identifier, pin_hash FROM users ORDER BY identifier");
    expect(users.map((u) => u.identifier)).toEqual(["admin@dsstudio.com.ar", "tel:1155550192"]);
    expect(users.every((u) => u.pin_hash.includes(":"))).toBe(true);
    expect(fs.existsSync(dbFile)).toBe(true);
  });

  it("aplica comandos, sube la versión y persiste en disco", async () => {
    const { executeCommand } = await loadServer();
    const { state, version } = await executeCommand({ role: "admin" }, {
      type: "service.upsert",
      service: { id: "s-persist", name: "Servicio persistido", description: "", price: 5000, durationMin: 30, category: "corte", active: true },
    });
    expect(version).toBe(2);
    expect(state.services.some((s) => s.id === "s-persist")).toBe(true);

    // Nuevo "proceso": se recarga desde el archivo.
    const reloaded = await loadServer();
    const after = await reloaded.loadState();
    expect(after.version).toBe(2);
    expect(after.state.services.some((s) => s.id === "s-persist")).toBe(true);
  });

  it("si el comando falla no escribe nada (transacción)", async () => {
    const { executeCommand, loadState } = await loadServer();
    const before = await loadState();
    await expect(executeCommand({ role: "cliente", clientId: "c-demo" }, { type: "service.delete", id: "s-persist" })).rejects.toThrow(/reservada al staff/);
    const after = await loadState();
    expect(after.version).toBe(before.version);
    expect(after.state.services.some((s) => s.id === "s-persist")).toBe(true);
  });

  it("guarda turnos con columnas indexadas y borra filas eliminadas", async () => {
    const { executeCommand, getDb, queryAll } = await loadServer();
    await executeCommand({ role: "admin" }, { type: "appointment.cancel", id: "a-martin" });
    const rows = queryAll<{ status: string; date: string; barber_id: string }>(await getDb(), "SELECT status, date, barber_id FROM appointments WHERE id = ?", ["a-martin"]);
    expect(rows[0]).toEqual({ status: "cancelado", date: "2026-09-14", barber_id: "b-diego" });
    await executeCommand({ role: "admin" }, { type: "appointment.delete", id: "a-martin" });
    expect(queryAll(await getDb(), "SELECT id FROM appointments WHERE id = ?", ["a-martin"])).toHaveLength(0);
  });

  it("eliminar un cliente borra también su cuenta y sesiones", async () => {
    freezeTime(new Date(2026, 8, 14, 21, 0)); // después de su turno de hoy
    const { executeCommand, mutate, getDb, queryAll } = await loadServer();
    await mutate((db) => {
      db.run("INSERT INTO users (id, role, identifier, name, client_id, pin_hash, created_at) VALUES ('u-lucas','cliente','tel:1161204471','Lucas','c-lucas','x:y','now')");
      db.run("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('tok','u-lucas','2099-01-01')");
    });
    await executeCommand({ role: "admin" }, { type: "client.delete", id: "c-lucas" });
    const db = await getDb();
    expect(queryAll(db, "SELECT id FROM users WHERE id = 'u-lucas'")).toHaveLength(0);
    expect(queryAll(db, "SELECT token_hash FROM sessions WHERE user_id = 'u-lucas'")).toHaveLength(0);
  });

  it("demo.reset regenera los datos", async () => {
    const { executeCommand } = await loadServer();
    const { state } = await executeCommand({ role: "admin" }, { type: "demo.reset" });
    expect(state.services.some((s) => s.id === "s-persist")).toBe(false);
    expect(state.appointments.some((a) => a.id === "a-martin")).toBe(true);
  });
});

describe("visibilidad por rol", () => {
  it("anónimo: solo catálogo público", async () => {
    const { loadState } = await loadServer();
    const { stateForActor } = await import("@/server/visibility");
    const { state } = await loadState();
    const view = stateForActor(state, null);
    expect(view.clients).toEqual([]);
    expect(view.appointments).toEqual([]);
    expect(view.cashClosures).toEqual([]);
    expect(view.services.every((s) => s.active)).toBe(true);
  });

  it("cliente: sus datos completos y los ajenos anónimos", async () => {
    const { loadState } = await loadServer();
    const { stateForActor } = await import("@/server/visibility");
    const { state } = await loadState();
    const view = stateForActor(state, { role: "cliente", clientId: "c-demo" });
    expect(view.clients.map((c) => c.id)).toEqual(["c-demo"]);
    const own = view.appointments.filter((a) => a.clientId === "c-demo");
    const others = view.appointments.filter((a) => a.clientId !== "c-demo");
    expect(own.length).toBeGreaterThan(0);
    expect(others.length).toBeGreaterThan(0);
    for (const a of others) {
      expect(a.clientName).toBe("");
      expect(a.clientPhone).toBe("");
      expect(a.notes).toBeUndefined();
      expect(a.servicePrice).toBe(0);
    }
    expect(view.blocks.every((b) => b.reason === "")).toBe(true);
  });

  it("staff: ve todo", async () => {
    const { loadState } = await loadServer();
    const { stateForActor } = await import("@/server/visibility");
    const { state } = await loadState();
    expect(stateForActor(state, { role: "admin" })).toBe(state);
  });
});

describe("regresiones de seguridad", () => {
  it("un cliente no puede restablecer la base (demo.reset)", async () => {
    const { executeCommand, loadState } = await loadServer();
    const before = await loadState();
    await expect(executeCommand({ role: "cliente", clientId: "c-demo" }, { type: "demo.reset" })).rejects.toThrow(/reservada al staff/);
    expect((await loadState()).version).toBe(before.version);
  });
});
