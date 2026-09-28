"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PublicShell } from "@/components/layout/PublicShell";
import { NAV } from "@/components/motion/Page";
import { Field } from "@/components/ui/Field";
import { PASSWORD_MIN, passwordSchema } from "@/lib/password";
import { AR_PHONE_ERROR, AR_PREFIX, isArPhone, toArPhone } from "@/lib/phone";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

const schema = z
  .object({
    name: z.string().trim().min(3, "Ingresá el nombre de la barbería"),
    address: z.string().trim().min(3, "Ingresá la dirección del local"),
    whatsapp: z.string().trim().refine(isArPhone, AR_PHONE_ERROR),
    ownerName: z.string().trim().min(3, "Ingresá tu nombre"),
    identifier: z.email("Ingresá un email válido"),
    password: passwordSchema,
    passwordConfirm: z.string().min(1, "Repetí la contraseña"),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: "Las contraseñas no coinciden",
    path: ["passwordConfirm"],
  });
type Values = z.infer<typeof schema>;

/** Alta de una barbería nueva. Al terminar queda la sesión abierta como dueño. */
export default function NuevaBarberiaPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    // Valida al salir de cada campo (y en cada tecla una vez marcado) para que los avisos
    // aparezcan antes de tocar "Crear barbería".
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { name: "", address: "", whatsapp: "", ownerName: "", identifier: "", password: "", passwordConfirm: "" },
  });

  const password = watch("password");
  const passwordConfirm = watch("passwordConfirm");
  const longEnough = password.length >= PASSWORD_MIN;
  const matches = password.length > 0 && password === passwordConfirm;

  const onSubmit = async (values: Values) => {
    setServerError(null);
    try {
      const res = await fetch("/api/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          address: values.address,
          whatsapp: toArPhone(values.whatsapp),
          ownerName: values.ownerName,
          identifier: values.identifier,
          password: values.password,
        }),
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
        <Field
          label="Tu número de teléfono"
          htmlFor="sh-wa"
          error={errors.whatsapp?.message}
          hint="Código de área y número, sin 0 ni 15"
        >
          <div className="field flex items-center gap-2 py-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
            <span aria-hidden className="shrink-0 text-secondary">
              {AR_PREFIX}
            </span>
            <input
              id="sh-wa"
              className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted sm:text-sm"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="11 3096-9716"
              {...register("whatsapp")}
            />
          </div>
        </Field>
        <Field label="Tu nombre" htmlFor="sh-owner" error={errors.ownerName?.message}>
          <input id="sh-owner" className="field py-3" autoComplete="name" {...register("ownerName")} />
        </Field>
        <Field label="Tu email" htmlFor="sh-id" error={errors.identifier?.message} hint="Es con lo que vas a ingresar">
          <input id="sh-id" className="field py-3" inputMode="email" autoComplete="email" {...register("identifier")} />
        </Field>
        <Field label="Contraseña" htmlFor="sh-password" error={errors.password?.message}>
          <input id="sh-password" type="password" autoComplete="new-password" className="field py-3" {...register("password")} />
        </Field>
        <Field label="Repetir contraseña" htmlFor="sh-password2" error={errors.passwordConfirm?.message}>
          <input id="sh-password2" type="password" autoComplete="new-password" className="field py-3" {...register("passwordConfirm")} />
        </Field>

        <ul aria-live="polite" className="flex flex-col gap-1 text-xs">
          <Check ok={longEnough}>Al menos {PASSWORD_MIN} caracteres</Check>
          <Check ok={matches}>Las dos contraseñas coinciden</Check>
        </ul>

        {serverError && (
          <p role="alert" className="rounded-2xl bg-error-container px-4 py-3 text-[13px] text-error">
            {serverError}
          </p>
        )}
      </form>
    </PublicShell>
  );
}

/** Requisito de la contraseña, en verde cuando ya está cumplido. */
function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={ok ? "flex items-center gap-1.5 font-medium text-mint-ink" : "flex items-center gap-1.5 text-muted"}>
      <span aria-hidden>{ok ? "✓" : "○"}</span>
      {children}
    </li>
  );
}
