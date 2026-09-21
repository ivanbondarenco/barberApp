"use client";

import { CheckoutSheet, type DigitalMethod } from "@/components/booking/CheckoutSheet";
import type { Appointment } from "@/lib/types";
import { declareTransfer, startCheckout } from "@/store/actions";
import { toast } from "@/store/useToast";

/**
 * Paga la seña de un turno que ya existe.
 *
 * Mercado Pago sale de la app al checkout y vuelve por las back_urls; la transferencia solo
 * deja avisado al local. En ninguno de los dos casos el navegador marca la seña como abonada.
 */
export function PayDepositSheet({
  appointment,
  open,
  onClose,
}: {
  appointment: Appointment;
  open: boolean;
  onClose: () => void;
}) {
  // La seña del turno ya está fijada: no se recalcula con la tasa de hoy.
  const amount = appointment.deposit.amount;

  const confirm = async (method: DigitalMethod) => {
    if (method === "mercadopago") {
      const checkout = await startCheckout(appointment.id);
      if (checkout.ok && checkout.initPoint) {
        window.location.href = checkout.initPoint;
        return;
      }
      toast(checkout.ok ? "No pudimos abrir el pago" : checkout.error, "error");
      onClose();
      return;
    }

    // El estado ya vuelve confirmado por el servidor en la misma llamada: no hace falta refrescar.
    await declareTransfer(appointment.id);
    onClose();
  };

  return (
    <CheckoutSheet
      open={open}
      onClose={onClose}
      amount={amount}
      description={`${appointment.serviceName} · ${appointment.time} hs`}
      mode="pay"
      onConfirm={confirm}
    />
  );
}
