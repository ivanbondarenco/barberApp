import type { PaymentMethod } from "./types";

export interface DepositPaymentRequest {
  appointmentRef: string;
  amount: number;
  description: string;
  method: Extract<PaymentMethod, "mercadopago" | "transferencia">;
}

export interface DepositPaymentResult {
  status: "approved" | "rejected";
  paymentId: string;
}

export const TRANSFER_ALIAS = "D.S.BARBERIA";
export const TRANSFER_CBU = "0000003100092837465019";

/**
 * Punto de integración con Mercado Pago.
 * En producción: un Route Handler (server) crea la preferencia con el Access Token
 * (Checkout Pro) y el webhook confirma el pago antes de marcar la seña como abonada.
 * Aquí se simula una aprobación para la demo local.
 */
export async function requestDepositPayment(request: DepositPaymentRequest): Promise<DepositPaymentResult> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  return {
    status: request.amount > 0 ? "approved" : "rejected",
    paymentId: `MP-${Date.now().toString(36).toUpperCase()}`,
  };
}
