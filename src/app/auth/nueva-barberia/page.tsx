"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PublicShell } from "@/components/layout/PublicShell";
import { NAV } from "@/components/motion/Page";
import { Field } from "@/components/ui/Field";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

const schema = z.object({
  name: z.string().trim().min(3, "Ingresá el nombre de la barbería"),
  address: z.string().trim().min(3, "Ingresá la dirección del local"),
  whatsapp: z
    .string()
    .trim()
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Celular inválido"),
  ownerName: z.string().trim().min(3, "Ingresá tu nombre"),
  identifier: z.string().trim().min(3, "Ingresá tu celular o email"),
  pin: z.string().regex(/^\d{4}$/, "El PIN tiene 4 dígitos"),
});
type Values = z.infer<typeof schema>;

/** Alta de una barbería nueva. Al terminar queda la sesión abierta como dueño. */
export default function NuevaBarberiaPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Values) => {
    setServerError(null);
    try {
      const res = await fetch("/api/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setServerError(data.error ?? "No pudimos crear la barbería");
      await useAppStore.getState().refresh(true);
      toast("¡Barbería creada! Cargá tus servicios y horarios.", "success");
      router.replace("/admin/agenda", { transitionTypes: [...NAV.forward] });
    } catch {
      setServerError("Sin conexión. Revisá tu internet.");
    }
  };

  return (
    <PublicShell
      title="Registrar mi barbería"
      fallbackHref="/"
      footer={
        <button type="submit" form="shop-form" disabled={isSubmitting} className="tap btn-primary">
          {isSubmitting ? "Creando…" : "Crear barbería"}
        </button>
      }
    >
      <form id="shop-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3 px-5 pb-6 pt-2">
        <p className="text-[15px] text-secondary">
          Creamos tu local con un catálogo básico y tu cuenta de dueño. Después cargás servicios, horarios y equipo.
        </p>

        <Field label="Nombre de la barbería" htmlFor="sh-name" error={errors.name?.message}>
          <input id="sh-name" className="field py-3" autoComplete="organization" {...register("name")} />
        </Field>
        <Field label="Dirección" htmlFor="sh-address" error={errors.address?.message} hint="La ven tus clientes al reservar">
          <input id="sh-address" className="field py-3" autoComplete="street-address" {...register("address")} />
        </Field>
        <Field label="WhatsApp del local" htmlFor="sh-wa" error={errors.whatsapp?.message}>
          <input id="sh-wa" className="field py-3" inputMode="tel" placeholder="+54 9 11 …" {...register("whatsapp")} />
        </Field>
        <Field label="Tu nombre" htmlFor="sh-owner" error={errors.ownerName?.message}>
          <input id="sh-owner" className="field py-3" autoComplete="name" {...register("ownerName")} />
        </Field>
        <Field label="Tu celular o email" htmlFor="sh-id" error={errors.identifier?.message}>
          <input id="sh-id" className="field py-3" autoComplete="username" {...register("identifier")} />
        </Field>
        <Field label="PIN de 4 dígitos" htmlFor="sh-pin" error={errors.pin?.message}>
          <input
            id="sh-pin"
            inputMode="numeric"
            maxLength={4}
            autoComplete="new-password"
            className="field py-3 tracking-[0.5em]"
            placeholder="••••"
            {...register("pin")}
          />
        </Field>

        {serverError && (
          <p role="alert" className="rounded-2xl bg-error-container px-4 py-3 text-[13px] text-error">
            {serverError}
          </p>
        )}
      </form>
    </PublicShell>
  );
}
