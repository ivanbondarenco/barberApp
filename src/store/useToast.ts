"use client";

import { create } from "zustand";

export type ToastTone = "info" | "success" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, tone?: ToastTone, action?: ToastAction) => number;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToast = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (message, tone = "info", action) => {
    const id = ++counter;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone, action }] }));
    setTimeout(() => get().dismiss(id), action ? 5000 : 3000);
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message: string, tone?: ToastTone, action?: ToastAction) =>
  useToast.getState().show(message, tone, action);

/** Snackbar con "Deshacer" para bajas reversibles. */
export const undoToast = (message: string, onUndo: () => void) => toast(message, "info", { label: "Deshacer", onClick: onUndo });
