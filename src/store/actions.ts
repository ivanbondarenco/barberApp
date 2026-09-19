"use client";

import type { AppointmentPatch, BookPayload, Command } from "@/lib/commands";
import { uid } from "@/lib/format";
import type { Barber, BusinessInfo, CashClosure, ClientProfile, DayHours, PaymentMethod, Product, Service, TimeBlock } from "@/lib/types";
import { useAppStore, type Result } from "./useAppStore";
import { toast, undoToast } from "./useToast";

const run = (command: Command) => useAppStore.getState().run(command);

/** Ejecuta y muestra el error (si lo hay) en un toast. */
async function runWithFeedback(command: Command, success?: string): Promise<Result> {
  const result = await run(command);
  if (!result.ok) toast(result.error, "error");
  else if (success) toast(success, "success");
  return result;
}

// ───────── Turnos ─────────
export async function bookAppointment(payload: Omit<BookPayload, "id" | "newClientId">): Promise<Result & { id: string }> {
  const id = uid("a");
  const result = await run({ type: "appointment.book", payload: { ...payload, id, newClientId: uid("c") } });
  return { ...result, id };
}

export const updateAppointment = (id: string, patch: AppointmentPatch, success = "Turno actualizado") =>
  runWithFeedback({ type: "appointment.update", id, patch }, success);

export const cancelAppointment = (id: string, success = "Turno cancelado") =>
  runWithFeedback({ type: "appointment.cancel", id }, success);

export const deleteAppointment = (id: string) => runWithFeedback({ type: "appointment.delete", id }, "Turno eliminado");

export const registerDeposit = (id: string, method: PaymentMethod, success = "Seña registrada") =>
  runWithFeedback({ type: "appointment.deposit", id, method }, success);

export const chargeAppointment = (id: string, method: PaymentMethod, success?: string) =>
  runWithFeedback({ type: "appointment.charge", id, method }, success);

export const addProductToAppointment = (id: string, productId: string) =>
  runWithFeedback({ type: "appointment.addProduct", id, productId });

export const removeProductFromAppointment = (id: string, productId: string) =>
  runWithFeedback({ type: "appointment.removeProduct", id, productId });

// ───────── Catálogo (ABM con deshacer) ─────────
export const saveService = (service: Service, isNew: boolean) =>
  runWithFeedback({ type: "service.upsert", service }, isNew ? "Servicio creado" : "Cambios guardados");

export async function deleteService(service: Service) {
  const result = await run({ type: "service.delete", id: service.id });
  if (!result.ok) return toast(result.error, "error");
  undoToast(`“${service.name}” eliminado`, () => void runWithFeedback({ type: "service.upsert", service }, "Servicio restaurado"));
}

export const saveProduct = (product: Product, isNew: boolean) =>
  runWithFeedback({ type: "product.upsert", product }, isNew ? "Producto creado" : "Cambios guardados");

export async function deleteProduct(product: Product) {
  const result = await run({ type: "product.delete", id: product.id });
  if (!result.ok) return toast(result.error, "error");
  undoToast(`“${product.name}” eliminado`, () => void runWithFeedback({ type: "product.upsert", product }, "Producto restaurado"));
}

export const adjustStock = (id: string, delta: number) => runWithFeedback({ type: "product.stock", id, delta });

// ───────── Equipo y clientes ─────────
export const saveBarber = (barber: Barber, isNew: boolean) =>
  runWithFeedback({ type: "barber.upsert", barber }, isNew ? "Barbero agregado" : "Cambios guardados");

export const deleteBarber = (id: string) => runWithFeedback({ type: "barber.delete", id }, "Barbero eliminado");

export const saveClient = (client: ClientProfile, isNew: boolean) =>
  runWithFeedback({ type: "client.upsert", client }, isNew ? "Cliente creado" : "Cambios guardados");

export const deleteClient = (id: string) => runWithFeedback({ type: "client.delete", id }, "Cliente eliminado");

// ───────── Agenda y local ─────────
export async function createBlock(block: Omit<TimeBlock, "id">) {
  return runWithFeedback({ type: "block.create", block: { ...block, id: uid("blk") } }, "Horario bloqueado");
}

export async function deleteBlock(block: TimeBlock) {
  const result = await run({ type: "block.delete", id: block.id });
  if (!result.ok) return toast(result.error, "error");
  undoToast("Bloqueo eliminado", () => void runWithFeedback({ type: "block.create", block }));
}

export const setAllowCash = (allowCash: boolean) =>
  runWithFeedback({ type: "settings.deposit", allowCash }, allowCash ? "Seña en efectivo habilitada" : "Seña en efectivo deshabilitada");

export const updateHours = (dayIndex: number, patch: Partial<DayHours>) => runWithFeedback({ type: "settings.hours", dayIndex, patch });

export const updateBusinessInfo = (patch: Partial<BusinessInfo>) =>
  runWithFeedback({ type: "settings.info", patch }, "Datos del negocio guardados");

export const openCash = () => runWithFeedback({ type: "cash.open" }, "Caja abierta");

export const closeCash = (closure: Omit<CashClosure, "id" | "openedAt" | "closedAt">) =>
  runWithFeedback({ type: "cash.close", closure: { ...closure, id: uid("cc") } }, "Caja cerrada");

export const resetDemo = () => runWithFeedback({ type: "demo.reset" }, "Datos demo restablecidos");

export { uid };
